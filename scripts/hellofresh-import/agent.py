"""
HELLO CAL HelloFresh-agent.

Katalogiserer HelloFresh Danmarks offentlige opskrifter som Product-rækker
(category "Retter", externalSource=HELLOFRESH) med billede, energifordeling
og ingrediens-sammensætning (gram + andel af rettens vægt), plus et delt
Ingredient-billedkatalog (category "Ingredienser") der genbruges på tværs af
opskrifter.

Kilder, bevidst valgt for at undgå at ramme private/interne API'er:
  - `sitemap_recipe_pages.xml`, som HelloFreshs eget robots.txt eksplicit
    linker til crawling af (`Sitemap:`-linjen) — giver alle opskrifts-URL'er
    uden at bruge den `?page=`-parameter robots.txt selv forbyder
    (`Disallow: /*?*page=`).
  - Hver opskrifts egen offentlige side (samme HTML enhver besøgende får)
    indlejrer den fulde opskrift-JSON i `<script id="__NEXT_DATA__">` —
    ingen login, ingen skjult API, intet der omgår adgangskontrol. Det
    interne `recipe.search`-API bag "Se flere"-knappen peger på en
    Kubernetes-intern hostname (`products-service.live-k8s.hellofresh.io`,
    kun privat DNS) og bruges bevidst IKKE.

Billeder hostes af HelloFresh på media.hellofresh.com; downloades i høj
opløsning (bruger widen=2000 — Cloudinary-stilens `c_limit` skalerer aldrig
op, så dette giver altid kildefilens fulde opløsning).

Genkørsel opdaterer eksisterende rækker (matchet på recipeId) i stedet for
at duplikere — HelloFresh genudgiver ofte den samme ret med et nyt recipeId
hver uge/sæson; en fuld "samme ret, ny kloning"-kæde er ikke forsøgt
sammenkædet i denne første version (se docs/DECISIONS.md, 2026-08-29).
"""

import json
import logging
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import psycopg2
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("hellofresh-agent")

# Prisma's DATABASE_URL carries a `?schema=public` query param that
# psycopg2/libpq doesn't recognize; Postgres already defaults to "public".
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
POLL_INTERVAL_SECONDS = int(os.environ.get("HELLOFRESH_POLL_INTERVAL_SECONDS", "120"))
REQUEST_DELAY_SECONDS = float(os.environ.get("HELLOFRESH_REQUEST_DELAY_SECONDS", "0.6"))
BATCH_SIZE = int(os.environ.get("HELLOFRESH_BATCH_SIZE", "30"))
OUTPUT_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/hellofresh-images")

SITE = "https://www.hellofresh.dk"
SITEMAP_URL = f"{SITE}/sitemap_recipe_pages.xml"
IMAGE_WIDTH = 2000
USER_AGENT = (
    "HelloCalRecipeCatalogBot/1.0 "
    "(+https://hellocal.packroff.dk; personal recipe-catalog import for a private app; "
    "contact: pep@sydtrafik.dk)"
)

NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)
RECIPE_ID_RE = re.compile(r"-([0-9a-f]{24})$")
SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# HelloFresh's per-ingredient/-recipe allergen `type` -> the 14 EU-mandated
# allergen keys used elsewhere in this codebase (src/lib/allergens.ts).
# "wheat" is intentionally dropped — "gluten" already covers it.
ALLERGEN_TYPE_TO_KEY = {
    "gluten": "gluten",
    "nuts": "nuts",
    "milk": "milk",
    "egg": "eggs",
    "mustard": "mustard",
    "fish": "fish",
    "crustaceans": "crustaceans",
    "soya": "soybeans",
    "sesame": "sesame-seeds",
    "lupin": "lupin",
    "molluscs": "molluscs",
    "celery": "celery",
    "sulphites": "sulphur-dioxide-and-sulphites",
}

# Recipe-level nutrition beyond the four core macros, kept as a JSON blob on
# Product.nutritionExtra rather than dedicated columns (varies per recipe,
# see docs/DECISIONS.md 2026-08-29). Values are per the recipe's own
# servingSize, NOT scaled to 100g like the core macro columns.
NUTRITION_EXTRA_MAP = {
    "Mættet fedt": "saturatedFatG",
    "Sukker": "sugarG",
    "Kostfibre": "fiberG",
    "Kolesterol": "cholesterolMg",
    "Salt": "saltG",
    "Potassium": "potassiumMg",
    "Calcium": "calciumMg",
    "Iron": "ironMg",
}


def fetch_sitemap_entries():
    resp = requests.get(SITEMAP_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)
    entries = []
    for url_el in root.findall("sm:url", SITEMAP_NS):
        loc = url_el.findtext("sm:loc", default="", namespaces=SITEMAP_NS)
        lastmod = url_el.findtext("sm:lastmod", default="", namespaces=SITEMAP_NS)
        if loc:
            entries.append((loc, lastmod))
    return entries


def recipe_id_from_url(url):
    match = RECIPE_ID_RE.search(url.rstrip("/"))
    return match.group(1) if match else None


def fetch_recipe(url):
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20)
    resp.raise_for_status()
    match = NEXT_DATA_RE.search(resp.text)
    if not match:
        return None
    data = json.loads(match.group(1))
    return data.get("props", {}).get("pageProps", {}).get("ssrPayload", {}).get("recipe")


def media_url(image_path, width=IMAGE_WIDTH):
    return f"https://media.hellofresh.com/q_100,w_{width},f_auto,c_limit,fl_lossy/recipes{image_path}"


def download_image(image_path):
    resp = requests.get(media_url(image_path), headers={"User-Agent": USER_AGENT}, timeout=20)
    resp.raise_for_status()
    return resp.content


def save_image(subdir, filename, content):
    out_path = os.path.join(OUTPUT_DIR, subdir, filename)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as fh:
        fh.write(content)
    return f"{PUBLIC_PATH_PREFIX}/{subdir}/{filename}"


def get_category_id(conn, name):
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM categories WHERE name = %s', (name,))
        row = cur.fetchone()
        return row[0] if row else None


def already_up_to_date(conn, recipe_id, lastmod):
    if not lastmod:
        return False
    with conn.cursor() as cur:
        cur.execute(
            """SELECT "sourceCheckedAt" FROM products WHERE "externalSource" = 'HELLOFRESH' AND "externalId" = %s""",
            (recipe_id,),
        )
        row = cur.fetchone()
    if not row or not row[0]:
        return False
    try:
        lastmod_dt = datetime.fromisoformat(lastmod)
    except ValueError:
        return False
    checked_at = row[0]
    if checked_at.tzinfo is None:
        checked_at = checked_at.replace(tzinfo=timezone.utc)
    if lastmod_dt.tzinfo is None:
        lastmod_dt = lastmod_dt.replace(tzinfo=timezone.utc)
    return checked_at >= lastmod_dt


def ensure_ingredient(conn, ingredient):
    external_id = ingredient["id"]
    with conn.cursor() as cur:
        cur.execute('SELECT id, "imageUrl" FROM ingredients WHERE "externalId" = %s', (external_id,))
        existing = cur.fetchone()

    db_id = existing[0] if existing else f"hf_ing_{external_id}"
    image_url = existing[1] if existing else None

    if not image_url and ingredient.get("imagePath"):
        try:
            content = download_image(ingredient["imagePath"])
            ext = os.path.splitext(ingredient["imagePath"])[1] or ".png"
            image_url = save_image("ingredients", f"{external_id}{ext}", content)
            time.sleep(REQUEST_DELAY_SECONDS)
        except Exception:  # noqa: BLE001 - one bad ingredient image must not stop the recipe
            log.warning("failed to download ingredient image for %s", ingredient.get("name"))

    with conn.cursor() as cur:
        if existing:
            cur.execute(
                'UPDATE ingredients SET name = %s, slug = %s, "imageUrl" = COALESCE(%s, "imageUrl") WHERE id = %s',
                (ingredient["name"], ingredient.get("slug"), image_url, db_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO ingredients (id, name, slug, "externalSource", "externalId", "imageUrl")
                VALUES (%s, %s, %s, 'HELLOFRESH', %s, %s)
                """,
                (db_id, ingredient["name"], ingredient.get("slug"), external_id, image_url),
            )
    return db_id


def reference_yield(recipe):
    yields = recipe.get("yields") or []
    if not yields:
        return None
    return min(yields, key=lambda y: y.get("yields", 0))


def upsert_recipe(conn, recipe, retter_category_id):
    recipe_id = recipe["recipeId"]
    nutrition = {item["name"]: item["amount"] for item in recipe.get("nutrition", [])}

    kcal = nutrition.get("Kalorier (kcal)")
    protein = nutrition.get("Protein")
    carbs = nutrition.get("Kulhydrat")
    fat = nutrition.get("Fedt")
    serving_size = recipe.get("servingSize")
    if kcal is None or protein is None or carbs is None or fat is None or not serving_size:
        log.warning("skipping %s (%s) — missing core macros or servingSize", recipe.get("name"), recipe_id)
        return None

    factor = 100.0 / serving_size
    extra = {key: nutrition[label] for label, key in NUTRITION_EXTRA_MAP.items() if label in nutrition}

    image_url = None
    if recipe.get("imagePath"):
        try:
            content = download_image(recipe["imagePath"])
            ext = os.path.splitext(recipe["imagePath"])[1] or ".jpg"
            image_url = save_image("dishes", f"{recipe_id}{ext}", content)
            time.sleep(REQUEST_DELAY_SECONDS)
        except Exception:  # noqa: BLE001 - a missing photo must not block the rest of the import
            log.warning("failed to download dish image for %s (%s)", recipe.get("name"), recipe_id)

    allergen_keys = sorted(
        {
            ALLERGEN_TYPE_TO_KEY[a["type"]]
            for a in recipe.get("allergens", [])
            if not a.get("tracesOf") and a.get("type") in ALLERGEN_TYPE_TO_KEY
        }
    )
    ingredients_text = ", ".join(i["name"] for i in recipe.get("ingredients", []))

    product_id = f"hf_{recipe_id}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO products
                (id, name, "categoryId", "imageUrl", "kcalPer100g", "proteinPer100g",
                 "carbsPer100g", "fatPer100g", "servingSizeGrams", "ingredientsText",
                 allergens, "nutritionExtra", "externalSource", "externalId",
                 "sourceCheckedAt", status, discontinued, "createdAt")
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'HELLOFRESH', %s, NOW(), 'APPROVED', false, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                "imageUrl" = COALESCE(EXCLUDED."imageUrl", products."imageUrl"),
                "kcalPer100g" = EXCLUDED."kcalPer100g",
                "proteinPer100g" = EXCLUDED."proteinPer100g",
                "carbsPer100g" = EXCLUDED."carbsPer100g",
                "fatPer100g" = EXCLUDED."fatPer100g",
                "servingSizeGrams" = EXCLUDED."servingSizeGrams",
                "ingredientsText" = EXCLUDED."ingredientsText",
                allergens = EXCLUDED.allergens,
                "nutritionExtra" = EXCLUDED."nutritionExtra",
                "sourceCheckedAt" = NOW()
            """,
            (
                product_id,
                recipe["name"],
                retter_category_id,
                image_url,
                round(kcal * factor, 1),
                round(protein * factor, 1),
                round(carbs * factor, 1),
                round(fat * factor, 1),
                serving_size,
                ingredients_text,
                allergen_keys,
                json.dumps(extra) if extra else None,
                recipe_id,
            ),
        )
    return product_id


def upsert_recipe_ingredients(conn, product_id, recipe):
    ref = reference_yield(recipe)
    if not ref:
        return
    amounts = {item["id"]: (item["amount"], item["unit"]) for item in ref.get("ingredients", [])}
    gram_total = sum(amount for amount, unit in amounts.values() if unit == "g")

    for ingredient in recipe.get("ingredients", []):
        amount_unit = amounts.get(ingredient["id"])
        if amount_unit is None:
            continue
        raw_amount, raw_unit = amount_unit
        ingredient_db_id = ensure_ingredient(conn, ingredient)
        amount_grams = raw_amount if raw_unit == "g" else None
        proportion = (raw_amount / gram_total) if (raw_unit == "g" and gram_total) else None
        pi_id = f"hf_pi_{product_id}_{ingredient_db_id}"
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO product_ingredients
                    (id, "productId", "ingredientId", "rawAmount", "rawUnit", "amountGrams", "proportion")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT ("productId", "ingredientId") DO UPDATE SET
                    "rawAmount" = EXCLUDED."rawAmount",
                    "rawUnit" = EXCLUDED."rawUnit",
                    "amountGrams" = EXCLUDED."amountGrams",
                    "proportion" = EXCLUDED."proportion"
                """,
                (pi_id, product_id, ingredient_db_id, raw_amount, raw_unit, amount_grams, proportion),
            )


def run_once(conn):
    retter_category_id = get_category_id(conn, "Retter")
    if not retter_category_id:
        log.error('category "Retter" not found — has migration 20260829010000_hellofresh_catalog run?')
        return

    entries = fetch_sitemap_entries()
    log.info("sitemap has %d recipe urls", len(entries))

    processed = 0
    for url, lastmod in entries:
        if processed >= BATCH_SIZE:
            break
        recipe_id = recipe_id_from_url(url)
        if not recipe_id or already_up_to_date(conn, recipe_id, lastmod):
            continue

        try:
            recipe = fetch_recipe(url)
            time.sleep(REQUEST_DELAY_SECONDS)
            if not recipe:
                log.warning("no recipe JSON found at %s", url)
                continue

            product_id = upsert_recipe(conn, recipe, retter_category_id)
            if product_id:
                upsert_recipe_ingredients(conn, product_id, recipe)
                conn.commit()
                processed += 1
                log.info("imported %s (%s)", recipe.get("name"), recipe_id)
        except Exception:  # noqa: BLE001 - one bad recipe must not stop the batch
            conn.rollback()
            log.exception("failed to import recipe at %s", url)

    log.info("cycle complete — processed %d recipes this pass", processed)


def main():
    log.info(
        "hellofresh agent started, polling every %ss (batch size %d)",
        POLL_INTERVAL_SECONDS,
        BATCH_SIZE,
    )
    while True:
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                run_once(conn)
        except Exception:  # noqa: BLE001 - a broken cycle must not kill the service
            log.exception("cycle failed")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
