"""
HELLO CAL RetNemt-agent (natligt job).

Katalogiserer RetNemts offentlige opskrifter som Product-rækker
(externalSource = RETNEMT, category "Retter") på samme måde som HelloFresh:
billede, ingredienser med mængde (og ingrediensbilleder i det delte
Ingredient-katalog), fremgangsmåde, allergener og RetNemts egne
næringsværdier pr. portion og pr. 100 g.

Kilder (samme HTML enhver besøgende får — intet login, ingen skjult API):
  - `/ugens-menu`: de aktuelle ugers retter.
  - `/opskrifter/<kategori>/<side>`: opskriftsarkivet, bladret igennem pr.
    kategori (robots.txt tillader alt undtagen /app/ og /studio/). Arkivet
    gennemgås højst hver `RETNEMT_ARCHIVE_EVERY_DAYS` dag.
  - Hver opskrifts egen side `/opskrift/<id>` indlejrer hele opskriften i
    `<script id="__NEXT_DATA__">` (recipeAndSteps): portioner, ingredienser,
    trin, allergener og `nutritionFacts` (totalvægt, pr. portion, pr. 100 g).

RetNemt genudgiver samme ret med nyt recipeId; rækken nøgles derfor på
`mainRecipeId`, og den nyeste udgave (højeste recipeId) vinder. Døde links
(siden findes ikke længere) spærrer retten (discontinued), som Valdemarsro.
"""

import html
import json
import logging
import os
import re
import time

import requests

from job_control import run_forever

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("retnemt-agent")

DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
RUN_AT_TIME = os.environ.get("RETNEMT_RUN_AT_TIME", "03:45")
BATCH_SIZE = int(os.environ.get("RETNEMT_BATCH_SIZE", "1000"))
LINK_CHECK_BATCH = int(os.environ.get("RETNEMT_LINK_CHECK_BATCH", "200"))
ARCHIVE_EVERY_DAYS = int(os.environ.get("RETNEMT_ARCHIVE_EVERY_DAYS", "7"))
REQUEST_DELAY_SECONDS = float(os.environ.get("RETNEMT_REQUEST_DELAY_SECONDS", "0.8"))
OUTPUT_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/hellofresh-images")

SITE = "https://www.retnemt.dk"
SOURCE = "RETNEMT"
ARCHIVE_MARKER_URL = f"{SITE}/opskrifter"
USER_AGENT = (
    "HelloCalRecipeCatalogBot/1.0 "
    "(+https://hellocal.io; personal recipe-catalog import for a private app; "
    "contact: pep@sydtrafik.dk)"
)

NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)
RECIPE_LINK_RE = re.compile(r"/opskrift/(\d+)(?:/([a-z0-9-]+))?")
TAG_RE = re.compile(r"<[^>]+>")

# RetNemts allergennavne -> de 14 EU-nøgler i src/lib/allergens.ts.
# Hvede/Laktose dækkes af Gluten/Mælk og udelades som nøgler.
ALLERGEN_NAME_TO_KEY = {
    "gluten": "gluten",
    "mælk": "milk",
    "æg": "eggs",
    "fisk": "fish",
    "krebsdyr": "crustaceans",
    "skaldyr": "crustaceans",
    "jordnødder": "peanuts",
    "nødder": "nuts",
    "soja": "soybeans",
    "selleri": "celery",
    "sennep": "mustard",
    "sesam": "sesame-seeds",
    "sesamfrø": "sesame-seeds",
    "lupin": "lupin",
    "bløddyr": "molluscs",
    "svovldioxid": "sulphur-dioxide-and-sulphites",
    "sulfit": "sulphur-dioxide-and-sulphites",
    "sulfitter": "sulphur-dioxide-and-sulphites",
}


def session():
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def next_data(page_html):
    match = NEXT_DATA_RE.search(page_html)
    return json.loads(match.group(1)) if match else None


def clean_text(value):
    """HTML-trin ("<strong>Risoni</strong>: Kog …") -> ren tekst."""
    if not isinstance(value, str):
        return None
    text = html.unescape(TAG_RE.sub("", html.unescape(value)))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def to_number(value):
    try:
        number = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


# ---------------------------------------------------------------- discovery


def discover_menu(http):
    resp = http.get(f"{SITE}/ugens-menu", timeout=60)
    resp.raise_for_status()
    return {int(m.group(1)) for m in RECIPE_LINK_RE.finditer(resp.text)}


def archive_due(conn):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT "checkedAt" > now() - make_interval(days => %s) FROM recipe_source_urls WHERE url = %s""",
            (ARCHIVE_EVERY_DAYS, ARCHIVE_MARKER_URL),
        )
        row = cur.fetchone()
    return not row or not row[0]


def listing_page(http, path):
    resp = http.get(f"{SITE}{path}", timeout=60)
    time.sleep(REQUEST_DELAY_SECONDS)
    resp.raise_for_status()
    data = next_data(resp.text) or {}
    return data.get("props", {}).get("pageProps", {})


def discover_archive(http):
    """Alle opskrifter i arkivet: hver hovedkategori bladres helt igennem."""
    root = listing_page(http, "/opskrifter")
    slugs = []
    for category in root.get("categories") or []:
        href = (category.get("href") or "").strip("/")
        if href and "/" not in href and href not in slugs:
            slugs.append(href)
    ids = set()
    for slug in slugs:
        page, total = 1, 1
        while page <= total:
            props = listing_page(http, f"/opskrifter/{slug}" + (f"/{page}" if page > 1 else ""))
            total = props.get("totalPages") or 0
            for recipe in props.get("recipes") or []:
                if isinstance(recipe.get("recipeId"), int):
                    ids.add(recipe["recipeId"])
            page += 1
    log.info("arkivet: %d kategorier, %d opskrifter", len(slugs), len(ids))
    return ids


def known_recipe_ids(conn):
    """recipeId -> httpStatus (0 = fundet, men endnu ikke hentet)."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT url, "httpStatus" FROM recipe_source_urls WHERE source = %s AND url LIKE %s""",
            (SOURCE, f"{SITE}/opskrift/%"),
        )
        rows = cur.fetchall()
    known = {}
    for url, status in rows:
        match = RECIPE_LINK_RE.search(url)
        if match:
            recipe_id = int(match.group(1))
            known[recipe_id] = status if status != 0 else known.get(recipe_id, 0)
    return known


def remember_url(conn, url, is_recipe, lastmod=None, status=200):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO recipe_source_urls (url, source, "isRecipe", lastmod, "httpStatus", "checkedAt")
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (url) DO UPDATE SET "isRecipe" = EXCLUDED."isRecipe", lastmod = EXCLUDED.lastmod,
                "httpStatus" = EXCLUDED."httpStatus", "checkedAt" = NOW()
            """,
            (url, SOURCE, is_recipe, lastmod, status),
        )


# ------------------------------------------------------------------- import


def fetch_recipe(http, recipe_id):
    """(recipeAndSteps, kanonisk URL) eller (None, status) hvis siden ikke er en opskrift."""
    resp = http.get(f"{SITE}/opskrift/{recipe_id}", timeout=30, allow_redirects=True)
    if resp.status_code in (404, 410) or "/opskrift/" not in resp.url:
        return None, 404
    resp.raise_for_status()
    data = next_data(resp.text) or {}
    queries = data.get("props", {}).get("pageProps", {}).get("initialState", {}).get("api", {}).get("queries", {})
    url = f"{SITE}/opskrift/{recipe_id}"
    for key, value in queries.items():
        if key.startswith("recipeAndSteps"):
            recipe = (value.get("data") or {}).get("recipeAndSteps")
            if recipe:
                return recipe, url
    return None, 200


def reference_portion(recipe):
    """Mindste portionsstørrelse (typisk 2), som HelloFreshs reference-yield."""
    portions = [p for p in (recipe.get("instructions") or {}).get("portions") or [] if to_number(p.get("size"))]
    if not portions:
        return None
    return min(portions, key=lambda p: to_number(p["size"]))


def image_url_of(images, *sizes):
    urls = {u.get("size"): u.get("url") for u in (images or {}).get("urls") or []}
    for size in sizes:
        if urls.get(size):
            return urls[size]
    return None


def download_image(http, url, subdir, filename_stem):
    if not url:
        return None
    try:
        resp = http.get(url, timeout=30)
        resp.raise_for_status()
        ext = os.path.splitext(url.split("?")[0])[1] or ".jpg"
        out_dir = os.path.join(OUTPUT_DIR, subdir)
        os.makedirs(out_dir, exist_ok=True)
        filename = f"{filename_stem}{ext}"
        with open(os.path.join(out_dir, filename), "wb") as fh:
            fh.write(resp.content)
        time.sleep(REQUEST_DELAY_SECONDS / 2)
        return f"{PUBLIC_PATH_PREFIX}/{subdir}/{filename}"
    except Exception:  # noqa: BLE001 - et manglende billede må ikke stoppe opskriften
        log.warning("billede kunne ikke hentes: %s", url)
        return None


def ensure_ingredient(conn, http, ingredient):
    external_id = f"rn_{ingredient['ingredientId']}"
    with conn.cursor() as cur:
        cur.execute('SELECT id, "imageUrl" FROM ingredients WHERE "externalId" = %s', (external_id,))
        existing = cur.fetchone()
    db_id = existing[0] if existing else f"rn_ing_{ingredient['ingredientId']}"
    image_url = existing[1] if existing else None
    if not image_url:
        image_url = download_image(
            http, image_url_of(ingredient.get("images"), "large", "small"), "retnemt/ingredients", ingredient["ingredientId"]
        )
    name = ingredient.get("name") or ""
    with conn.cursor() as cur:
        if existing:
            cur.execute('UPDATE ingredients SET name = %s, "imageUrl" = COALESCE(%s, "imageUrl") WHERE id = %s', (name, image_url, db_id))
        else:
            cur.execute(
                """INSERT INTO ingredients (id, name, "externalSource", "externalId", "imageUrl") VALUES (%s, %s, %s, %s, %s)""",
                (db_id, name, SOURCE, external_id, image_url),
            )
    return db_id


def flatten_ingredients(portion):
    for section in portion.get("ingredientSections") or []:
        for ingredient in sorted(section.get("ingredients") or [], key=lambda i: to_number(i.get("order")) or 0):
            if ingredient.get("name") and ingredient.get("ingredientId") is not None:
                yield ingredient


def build_details(conn, http, recipe, portion, url, ingredient_rows):
    per_portion = ((portion.get("nutritionFacts") or {}).get("recipeNutritionPerPortion")) or {}
    nutrition = [
        {"name": label, "amount": to_number(per_portion.get(key)), "unit": unit}
        for label, key, unit in (
            ("Kalorier (kcal)", "energyKcal", "kcal"),
            ("Fedt", "fat", "g"),
            ("Kulhydrat", "carbs", "g"),
            ("Protein", "protein", "g"),
        )
        if to_number(per_portion.get(key)) is not None
    ]
    steps = []
    for section in portion.get("stepSections") or []:
        for step in sorted(section.get("steps") or [], key=lambda s: s.get("order") or 0):
            text = clean_text(step.get("step"))
            if text:
                steps.append({"text": text})
    tags = []
    for taxonomy in recipe.get("taxonomies") or []:
        name = (taxonomy.get("name") or "").strip()
        if taxonomy.get("type") == "category_tag" and name and name not in tags:
            tags.append(name)
    allergens = [
        a["name"]
        for a in portion.get("allergies") or []
        if a.get("name") and a.get("showAllergy", True) and not a.get("hasTraceOf")
    ]
    max_minutes = to_number(recipe.get("cookingTimeMax")) or to_number(recipe.get("cookingTimeMin"))
    return {
        "headline": None,
        "description": clean_text(recipe.get("recipeDescription")),
        "chefTip": clean_text(recipe.get("chefTip")),
        "totalTime": f"PT{int(max_minutes)}M" if max_minutes else None,
        "difficulty": None,
        "tags": tags,
        "allergens": allergens,
        "yields": to_number(portion.get("size")),
        "ingredients": [
            {
                "ingredientId": db_id,
                "name": ingredient["name"],
                "amount": to_number(ingredient.get("amount")),
                "unit": (ingredient.get("ingredientAmountType") or "").strip() or None,
                "isBasis": bool(ingredient.get("isBasis")),
            }
            for ingredient, db_id in ingredient_rows
        ],
        "steps": steps,
        "nutrition": nutrition,
        "nutritionBasis": "portion",
        "websiteUrl": url,
        "source": "retnemt",
        "recipeId": recipe.get("recipeId"),
        "mainRecipeId": recipe.get("mainRecipeId"),
        "rating": to_number(recipe.get("averageRating")),
        "ratingCount": recipe.get("numberOfRatings"),
        "servings": to_number(portion.get("size")),
    }


def stored_recipe_id(conn, product_id):
    with conn.cursor() as cur:
        cur.execute("""SELECT ("recipeDetails"->>'recipeId')::bigint FROM products WHERE id = %s""", (product_id,))
        row = cur.fetchone()
    return row[0] if row and row[0] is not None else None


def allergen_keys(portion):
    keys = set()
    for allergy in portion.get("allergies") or []:
        key = ALLERGEN_NAME_TO_KEY.get((allergy.get("name") or "").strip().lower())
        if key and not allergy.get("hasTraceOf"):
            keys.add(key)
    return sorted(keys)


def upsert_recipe(conn, http, recipe, url, category_id):
    main_id = recipe.get("mainRecipeId") or recipe["recipeId"]
    product_id = f"rn_{main_id}"
    known = stored_recipe_id(conn, product_id)
    if known and known > recipe["recipeId"]:
        return product_id, False  # en nyere udgave af samme ret er allerede gemt

    portion = reference_portion(recipe)
    if not portion:
        log.warning("springer %s over — ingen portioner", recipe.get("recipeName"))
        return None, False
    facts = portion.get("nutritionFacts") or {}
    per100 = facts.get("recipeNutritionPer100g") or {}
    size = to_number(portion.get("size"))
    total_weight = to_number(facts.get("totalWeight"))
    core = [to_number(per100.get(k)) for k in ("energyKcal", "protein", "carbs", "fat")]
    nutrition_missing = any(v is None for v in core)
    serving_grams = round(total_weight / size, 1) if total_weight and size else None

    ingredient_rows = [(i, ensure_ingredient(conn, http, i)) for i in flatten_ingredients(portion)]
    details = build_details(conn, http, recipe, portion, url, ingredient_rows)
    image_url = download_image(
        http, image_url_of(recipe.get("images"), "original", "large", "small"), "retnemt", recipe["recipeId"]
    )
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO products
                (id, name, "categoryId", "imageUrl", "kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g",
                 "servingSizeGrams", "servingSizeUnitSingular", "servingSizeUnitPlural", "ingredientsText",
                 allergens, "recipeDetails", "externalSource", "externalId", "sourceCheckedAt", "nutritionMissing",
                 status, discontinued, "createdAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'portion', 'portioner', %s, %s, %s, %s, %s, NOW(), %s,
                    'APPROVED', false, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                "imageUrl" = COALESCE(EXCLUDED."imageUrl", products."imageUrl"),
                "kcalPer100g" = EXCLUDED."kcalPer100g", "proteinPer100g" = EXCLUDED."proteinPer100g",
                "carbsPer100g" = EXCLUDED."carbsPer100g", "fatPer100g" = EXCLUDED."fatPer100g",
                "servingSizeGrams" = EXCLUDED."servingSizeGrams",
                "ingredientsText" = EXCLUDED."ingredientsText",
                allergens = EXCLUDED.allergens,
                "recipeDetails" = EXCLUDED."recipeDetails",
                "nutritionMissing" = EXCLUDED."nutritionMissing",
                "sourceCheckedAt" = NOW()
            """,
            (
                product_id,
                (recipe.get("recipeName") or "").strip(),
                category_id,
                image_url,
                *[round(v, 1) if v is not None else 0 for v in core],
                serving_grams,
                ", ".join(i["name"] for i, _ in ingredient_rows),
                allergen_keys(portion),
                json.dumps(details),
                SOURCE,
                str(main_id),
                nutrition_missing,
            ),
        )
        cur.execute('DELETE FROM product_ingredients WHERE "productId" = %s', (product_id,))
    gram_total = sum(to_number(i.get("amount")) or 0 for i, _ in ingredient_rows if i.get("ingredientAmountType") == "g")
    for ingredient, db_id in ingredient_rows:
        amount = to_number(ingredient.get("amount"))
        unit = (ingredient.get("ingredientAmountType") or "").strip()
        if amount is None or not unit:
            continue
        grams = amount if unit == "g" else None
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO product_ingredients
                    (id, "productId", "ingredientId", "rawAmount", "rawUnit", "amountGrams", "proportion")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT ("productId", "ingredientId") DO UPDATE SET
                    "rawAmount" = EXCLUDED."rawAmount", "rawUnit" = EXCLUDED."rawUnit",
                    "amountGrams" = EXCLUDED."amountGrams", "proportion" = EXCLUDED."proportion"
                """,
                (
                    f"rn_pi_{product_id}_{db_id}",
                    product_id,
                    db_id,
                    amount,
                    unit,
                    grams,
                    (grams / gram_total) if grams and gram_total else None,
                ),
            )
    return product_id, True


def import_new(conn, http, category_id):
    candidates = discover_menu(http)
    time.sleep(REQUEST_DELAY_SECONDS)
    if archive_due(conn):
        candidates |= discover_archive(http)
        remember_url(conn, ARCHIVE_MARKER_URL, False)
    known = known_recipe_ids(conn)
    # Nye fund huskes som "ventende" (status 0), så de hentes de følgende
    # nætter, også når der er flere end BATCH_SIZE.
    for recipe_id in candidates - set(known):
        remember_url(conn, f"{SITE}/opskrift/{recipe_id}", False, status=0)
        known[recipe_id] = 0
    conn.commit()
    todo = sorted((rid for rid, status in known.items() if status == 0), reverse=True)  # nyeste først
    log.info("%d kendte, %d ventende at hente", len(known), len(todo))
    imported = failed = 0
    for recipe_id in todo:
        if imported + failed >= BATCH_SIZE:
            break
        url = f"{SITE}/opskrift/{recipe_id}"
        try:
            recipe, canonical = fetch_recipe(http, recipe_id)
            time.sleep(REQUEST_DELAY_SECONDS)
            if not recipe:
                remember_url(conn, url, False, status=canonical)
                conn.commit()
                continue
            product_id, changed = upsert_recipe(conn, http, recipe, canonical, category_id)
            remember_url(conn, url, bool(product_id), lastmod=str(recipe.get("mainRecipeId") or ""))
            conn.commit()
            if changed:
                imported += 1
                log.info("importeret %s (%s)", recipe.get("recipeName"), recipe_id)
        except Exception:  # noqa: BLE001 - én fejlende opskrift må ikke stoppe natten
            conn.rollback()
            failed += 1
            log.exception("kunne ikke importere %s", url)
    return imported, failed


def check_links(conn, http):
    """Døde opskriftslinks spærrer retten; lever linket igen, åbnes den igen.

    Kun retter, som linktjekket selv har spærret (husket med httpStatus 404 i
    recipe_source_urls), genåbnes — en ret admin har deaktiveret, forbliver
    deaktiveret."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT p.id, p."recipeDetails"->>'websiteUrl', p.discontinued, COALESCE(u."httpStatus", 200)
               FROM products p
               LEFT JOIN recipe_source_urls u ON u.url = p."recipeDetails"->>'websiteUrl'
               WHERE p."externalSource" = %s AND p."recipeDetails"->>'websiteUrl' IS NOT NULL
               ORDER BY p."sourceCheckedAt" ASC NULLS FIRST LIMIT %s""",
            (SOURCE, LINK_CHECK_BATCH),
        )
        rows = cur.fetchall()
    closed = reopened = 0
    for product_id, url, discontinued, last_status in rows:
        try:
            resp = http.get(url, timeout=20, allow_redirects=True)
            time.sleep(REQUEST_DELAY_SECONDS / 2)
            if resp.status_code >= 500:
                continue  # midlertidig fejl: ændr intet
            dead = resp.status_code in (404, 410) or "/opskrift/" not in resp.url
            closed_by_us = last_status in (404, 410)
            with conn.cursor() as cur:
                if dead and not discontinued:
                    cur.execute('UPDATE products SET discontinued = true WHERE id = %s', (product_id,))
                    closed += 1
                elif not dead and discontinued and closed_by_us:
                    cur.execute('UPDATE products SET discontinued = false WHERE id = %s', (product_id,))
                    reopened += 1
                cur.execute('UPDATE products SET "sourceCheckedAt" = NOW() WHERE id = %s', (product_id,))
            remember_url(conn, url, True, status=404 if dead else 200)
            conn.commit()
        except Exception:  # noqa: BLE001
            conn.rollback()
            log.warning("linktjek fejlede for %s", url)
    return closed, reopened


def get_category_id(conn, name):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM categories WHERE name = %s", (name,))
        row = cur.fetchone()
        return row[0] if row else None


def run_once(conn):
    category_id = get_category_id(conn, "Retter")
    if not category_id:
        raise RuntimeError('Kategorien "Retter" findes ikke')
    http = session()
    imported, failed = import_new(conn, http, category_id)
    closed, reopened = check_links(conn, http)
    message = f"{imported} nye/ændrede retter, {closed} døde links spærret, {reopened} genåbnet"
    if failed:
        message += f", {failed} fejlede"
    return message, imported + closed + reopened


def main():
    log.info("retnemt agent startet, kører dagligt kl. %s", RUN_AT_TIME)
    run_forever(DATABASE_URL, "retnemt-import", run_once, run_at_time=RUN_AT_TIME)


if __name__ == "__main__":
    main()
