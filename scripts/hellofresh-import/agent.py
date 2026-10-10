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
Ugemenuernes retter (/menus/<uge>) er sådanne kloner, som viderestiller til
opskrifter, der allerede står i sitemap'en, så sitemap'en er fortsat kilden.

Automatisk vedligehold (docs/DECISIONS.md 2026-10-10), ved siden af nye og
ændrede opskrifter:
  - Opdatering: sitemap'ens lastmod ændres sjældent, så hver opskrift hentes
    igen, når den er ældre end HELLOFRESH_REFRESH_DAYS (et par stykker pr.
    kørsel); opskrifter uden billede prøves igen efter et døgn.
  - Fjernede retter: en ret, der ikke længere står i sitemap'en, og hvis side
    svarer 404/410, spærres (discontinued, markeret retiredByAgent); står den
    i sitemap'en igen, åbnes den. En ret, admin har deaktiveret, røres ikke.
"""

import json
import logging
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import psycopg2

from job_control import run_forever
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("hellofresh-agent")

# Prisma's DATABASE_URL carries a `?schema=public` query param that
# psycopg2/libpq doesn't recognize; Postgres already defaults to "public".
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
POLL_INTERVAL_SECONDS = int(os.environ.get("HELLOFRESH_POLL_INTERVAL_SECONDS", "120"))
REQUEST_DELAY_SECONDS = float(os.environ.get("HELLOFRESH_REQUEST_DELAY_SECONDS", "0.6"))
BATCH_SIZE = int(os.environ.get("HELLOFRESH_BATCH_SIZE", "30"))
REFRESH_DAYS = int(os.environ.get("HELLOFRESH_REFRESH_DAYS", "30"))
REFRESH_BATCH = int(os.environ.get("HELLOFRESH_REFRESH_BATCH", "2"))
REMOVED_CHECK_BATCH = int(os.environ.get("HELLOFRESH_REMOVED_CHECK_BATCH", "5"))
OUTPUT_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/hellofresh-images")

SITE = "https://www.hellofresh.dk"
SITEMAP_URL = f"{SITE}/sitemap_recipe_pages.xml"
IMAGE_WIDTH = 2000
USER_AGENT = (
    "HelloCalRecipeCatalogBot/1.0 "
    "(+https://hellocal.io; personal recipe-catalog import for a private app; "
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
            """SELECT "sourceCheckedAt", "recipeDetails" IS NOT NULL FROM products WHERE "externalSource" = 'HELLOFRESH' AND "externalId" = %s""",
            (recipe_id,),
        )
        row = cur.fetchone()
    # Rækker importeret før recipeDetails fandtes hentes igen én gang.
    if not row or not row[0] or not row[1]:
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


def text_or_none(value):
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def build_recipe_details(conn, recipe):
    """Visningsdata til opskriftssiden (docs/DECISIONS.md 2026-09-27).

    Gemmer HelloFreshs egne værdier uændret (tekst, tal og enheder), så appen
    kan vise opskriften præcis som HelloFresh — kun ingrediensbilleder peger
    på vores eget Ingredient-katalog.
    """
    ref = reference_yield(recipe) or {}
    amounts = {item["id"]: (item.get("amount"), item.get("unit")) for item in ref.get("ingredients", [])}

    ingredients = []
    for ingredient in recipe.get("ingredients", []):
        if ingredient["id"] not in amounts:
            continue
        amount, unit = amounts[ingredient["id"]]
        ingredients.append(
            {
                "ingredientId": ensure_ingredient(conn, ingredient),
                "name": ingredient["name"],
                "amount": amount,
                "unit": text_or_none(unit),
            }
        )

    steps = []
    for step in sorted(recipe.get("steps") or [], key=lambda s: s.get("index", 0)):
        text = text_or_none(step.get("instructions"))
        if text:
            steps.append({"text": text})

    nutrition = [
        {"name": item["name"], "amount": item["amount"], "unit": text_or_none(item.get("unit"))}
        for item in recipe.get("nutrition", [])
        if item.get("name") and isinstance(item.get("amount"), (int, float))
    ]

    return {
        "headline": text_or_none(recipe.get("headline")),
        "description": text_or_none(recipe.get("description")),
        "totalTime": text_or_none(recipe.get("totalTime")),
        "prepTime": text_or_none(recipe.get("prepTime")),
        "difficulty": recipe.get("difficulty") if isinstance(recipe.get("difficulty"), int) else None,
        "tags": [t["name"] for t in recipe.get("tags", []) if text_or_none(t.get("name"))],
        "allergens": [
            a["name"] for a in recipe.get("allergens", []) if not a.get("tracesOf") and text_or_none(a.get("name"))
        ],
        "yields": ref.get("yields"),
        "ingredients": ingredients,
        "steps": steps,
        "nutrition": nutrition,
        "websiteUrl": text_or_none(recipe.get("websiteUrl")),
    }


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
    recipe_details = build_recipe_details(conn, recipe)

    product_id = f"hf_{recipe_id}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO products
                (id, name, "categoryId", "imageUrl", "kcalPer100g", "proteinPer100g",
                 "carbsPer100g", "fatPer100g", "servingSizeGrams",
                 "servingSizeUnitSingular", "servingSizeUnitPlural", "ingredientsText",
                 allergens, "nutritionExtra", "recipeDetails", "externalSource", "externalId",
                 "sourceCheckedAt", status, discontinued, "createdAt")
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'HELLOFRESH', %s, NOW(), 'APPROVED', false, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                "imageUrl" = COALESCE(EXCLUDED."imageUrl", products."imageUrl"),
                "kcalPer100g" = EXCLUDED."kcalPer100g",
                "proteinPer100g" = EXCLUDED."proteinPer100g",
                "carbsPer100g" = EXCLUDED."carbsPer100g",
                "fatPer100g" = EXCLUDED."fatPer100g",
                "servingSizeGrams" = EXCLUDED."servingSizeGrams",
                "servingSizeUnitSingular" = EXCLUDED."servingSizeUnitSingular",
                "servingSizeUnitPlural" = EXCLUDED."servingSizeUnitPlural",
                "ingredientsText" = EXCLUDED."ingredientsText",
                allergens = EXCLUDED.allergens,
                "nutritionExtra" = EXCLUDED."nutritionExtra",
                "recipeDetails" = EXCLUDED."recipeDetails",
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
                "portion",
                "portioner",
                ingredients_text,
                allergen_keys,
                json.dumps(extra) if extra else None,
                json.dumps(recipe_details),
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
        if raw_amount is None or not raw_unit:
            continue
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


def skipped_urls(conn):
    """Sider uden brugbar opskrift (fx uden næring) -> lastmod, så de ikke
    hentes igen hver kørsel, før HelloFresh ændrer dem."""
    with conn.cursor() as cur:
        cur.execute("""SELECT url, lastmod FROM recipe_source_urls WHERE source = 'HELLOFRESH' AND "isRecipe" = false""")
        return {url: lastmod or "" for url, lastmod in cur.fetchall()}


def remember_skipped(conn, url, lastmod):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO recipe_source_urls (url, source, "isRecipe", lastmod, "httpStatus", "checkedAt")
            VALUES (%s, 'HELLOFRESH', false, %s, 200, NOW())
            ON CONFLICT (url) DO UPDATE SET "isRecipe" = false, lastmod = EXCLUDED.lastmod, "checkedAt" = NOW()
            """,
            (url, lastmod or None),
        )


def import_one(conn, url, retter_category_id):
    """Henter og gemmer én opskrift; returnerer product_id eller None."""
    recipe = fetch_recipe(url)
    time.sleep(REQUEST_DELAY_SECONDS)
    if not recipe:
        log.warning("no recipe JSON found at %s", url)
        return None
    product_id = upsert_recipe(conn, recipe, retter_category_id)
    if product_id:
        upsert_recipe_ingredients(conn, product_id, recipe)
    return product_id


def refresh_stale(conn, url_by_id, retter_category_id):
    """Henter de ældste opskrifter igen (og dem uden billede), så kataloget
    holdes opdateret, selvom sitemap'ens lastmod ikke ændres."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT "externalId" FROM products
               WHERE "externalSource" = 'HELLOFRESH' AND discontinued = false
                 AND ("sourceCheckedAt" IS NULL
                      OR "sourceCheckedAt" < now() - make_interval(days => %s)
                      OR ("imageUrl" IS NULL AND "sourceCheckedAt" < now() - interval '1 day'))
               ORDER BY ("imageUrl" IS NULL) DESC, "sourceCheckedAt" ASC NULLS FIRST
               LIMIT %s""",
            (REFRESH_DAYS, REFRESH_BATCH),
        )
        ids = [row[0] for row in cur.fetchall()]
    refreshed = 0
    for recipe_id in ids:
        url = url_by_id.get(recipe_id)
        if not url:
            continue  # ikke i sitemap'en: håndteres af sync_removed
        try:
            if import_one(conn, url, retter_category_id):
                conn.commit()
                refreshed += 1
        except Exception:  # noqa: BLE001 - én fejlende opskrift må ikke stoppe kørslen
            conn.rollback()
            log.exception("failed to refresh recipe %s", recipe_id)
    return refreshed


def page_is_gone(url):
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20, allow_redirects=True)
    if resp.status_code >= 500:
        return None  # midlertidig fejl: ændr intet
    return resp.status_code in (404, 410)


def sync_removed(conn, sitemap_ids):
    """Spærrer retter, HelloFresh har fjernet, og genåbner dem, der er tilbage."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM products WHERE "externalSource" = 'HELLOFRESH'"""
        )
        known = cur.fetchone()[0]
    # En halv eller tom sitemap må aldrig spærre kataloget.
    if not sitemap_ids or len(sitemap_ids) < 0.8 * known:
        log.warning("sitemap has %d ids for %d known recipes — skipping removal check", len(sitemap_ids), known)
        return 0, 0
    reopened = 0
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE products SET discontinued = false, "recipeDetails" = "recipeDetails" - 'retiredByAgent'
               WHERE "externalSource" = 'HELLOFRESH' AND discontinued = true
                 AND ("recipeDetails"->>'retiredByAgent') = 'true' AND "externalId" = ANY(%s)""",
            (list(sitemap_ids),),
        )
        reopened = cur.rowcount
        cur.execute(
            """SELECT id, "externalId", "recipeDetails"->>'websiteUrl' FROM products
               WHERE "externalSource" = 'HELLOFRESH' AND discontinued = false
                 AND NOT ("externalId" = ANY(%s))
                 AND "recipeDetails"->>'websiteUrl' IS NOT NULL
                 AND ("sourceCheckedAt" IS NULL OR "sourceCheckedAt" < now() - interval '7 days')
               ORDER BY "sourceCheckedAt" ASC NULLS FIRST LIMIT %s""",
            (list(sitemap_ids), REMOVED_CHECK_BATCH),
        )
        candidates = cur.fetchall()
    conn.commit()
    closed = 0
    for product_id, recipe_id, url in candidates:
        try:
            gone = page_is_gone(url)
            time.sleep(REQUEST_DELAY_SECONDS)
            if gone is None:
                continue
            with conn.cursor() as cur:
                if gone:
                    cur.execute(
                        """UPDATE products SET discontinued = true,
                               "recipeDetails" = COALESCE("recipeDetails", '{}'::jsonb) || '{"retiredByAgent": true}'::jsonb
                           WHERE id = %s""",
                        (product_id,),
                    )
                    closed += 1
                    log.info("recipe %s is gone from HelloFresh — disabled", recipe_id)
                cur.execute('UPDATE products SET "sourceCheckedAt" = NOW() WHERE id = %s', (product_id,))
            conn.commit()
        except Exception:  # noqa: BLE001
            conn.rollback()
            log.warning("removal check failed for %s", url)
    return closed, reopened


def run_once(conn):
    # Returnerer (besked, antal udført) til admin "Robotter"/"Nattens kørsler".
    retter_category_id = get_category_id(conn, "Retter")
    if not retter_category_id:
        log.error('category "Retter" not found — has migration 20260829010000_hellofresh_catalog run?')
        raise RuntimeError('Kategorien "Retter" findes ikke — er migration 20260829010000_hellofresh_catalog kørt?')

    entries = fetch_sitemap_entries()
    log.info("sitemap has %d recipe urls", len(entries))

    processed = 0
    failed = 0
    skipped = skipped_urls(conn)
    for url, lastmod in entries:
        if processed >= BATCH_SIZE:
            break
        recipe_id = recipe_id_from_url(url)
        if not recipe_id or skipped.get(url) == (lastmod or "") or already_up_to_date(conn, recipe_id, lastmod):
            continue

        try:
            product_id = import_one(conn, url, retter_category_id)
            if product_id:
                processed += 1
                log.info("imported %s", recipe_id)
            else:
                remember_skipped(conn, url, lastmod)
            conn.commit()
        except Exception:  # noqa: BLE001 - one bad recipe must not stop the batch
            conn.rollback()
            failed += 1
            log.exception("failed to import recipe at %s", url)

    url_by_id = {}
    for url, _ in entries:
        recipe_id = recipe_id_from_url(url)
        if recipe_id:
            url_by_id[recipe_id] = url
    refreshed = refresh_stale(conn, url_by_id, retter_category_id)
    closed, reopened = sync_removed(conn, set(url_by_id))

    log.info(
        "cycle complete — %d imported, %d refreshed, %d disabled, %d reopened",
        processed, refreshed, closed, reopened,
    )
    total = processed + refreshed + closed + reopened
    if total == 0 and failed == 0:
        return "Ingen nye eller ændrede opskrifter", 0
    parts = [f"{processed} opskrifter importeret"]
    if refreshed:
        parts.append(f"{refreshed} opdateret")
    if closed:
        parts.append(f"{closed} fjernet af HelloFresh spærret")
    if reopened:
        parts.append(f"{reopened} genåbnet")
    if failed:
        parts.append(f"{failed} fejlede")
    return ", ".join(parts), total


def main():
    log.info(
        "hellofresh agent started, polling every %ss (batch size %d)",
        POLL_INTERVAL_SECONDS,
        BATCH_SIZE,
    )
    # Planlægning/pause/"kør nu" styres fra admin "Cron-jobs" (job_control.py);
    # POLL_INTERVAL_SECONDS er kun standard-intervallet første gang.
    run_forever(DATABASE_URL, "hellofresh-import", run_once, interval_minutes=max(1, POLL_INTERVAL_SECONDS // 60))


if __name__ == "__main__":
    main()
