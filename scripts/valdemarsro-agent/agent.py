"""
HELLO CAL Valdemarsro-agent (natligt job).

Katalogiserer Valdemarsros opskrifter som Product-rækker (externalSource =
VALDEMARSRO, category "Retter") med billede, ingredienser, fremgangsmåde og
et link til kildesiden (recipeDetails.websiteUrl), som appen åbner med den
grønne knap "Gå til opskrift". Hver nat:

  1. Finder nye eller ændrede opskrifter via sitemap (`sitemap_index.xml`, som
     Valdemarsros egen robots.txt linker til) og henter dem i små portioner.
  2. Sikrer at alle gemte opskrifters links stadig lever: 404/410 betyder, at
     retten spærres (discontinued = true); lever linket igen, åbnes den igen.

Næringsværdier står kun i Valdemarsros Premium, så de beregnes af os: hver
ingrediens med en vægt matches mod en godkendt vare i databasen, og først når
mindst 70 % af ingredienslinjerne kan regnes med, bruges tallene; ellers
markeres retten som "næring ukendt" (nutritionMissing).

Siderne læses som almindelig HTML (samme side enhver besøgende får): ingredienser
i `ul.ingredientlist li`, trin i `[itemprop=recipeInstructions]`, nøgletal i
`.recipe-stats`. Siderne uden ingrediensliste (blogindlæg) huskes i
`recipe_source_urls`, så de ikke hentes igen.
"""

import json
import logging
import os
import re
import time
import xml.etree.ElementTree as ET
from fractions import Fraction

import psycopg2
import requests
from bs4 import BeautifulSoup

from job_control import run_forever

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("valdemarsro-agent")

DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
RUN_AT_TIME = os.environ.get("VALDEMARSRO_RUN_AT_TIME", "03:30")
BATCH_SIZE = int(os.environ.get("VALDEMARSRO_BATCH_SIZE", "150"))
LINK_CHECK_BATCH = int(os.environ.get("VALDEMARSRO_LINK_CHECK_BATCH", "300"))
REQUEST_DELAY_SECONDS = float(os.environ.get("VALDEMARSRO_REQUEST_DELAY_SECONDS", "1.0"))
OUTPUT_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/hellofresh-images")

SITE = "https://www.valdemarsro.dk"
SITEMAP_INDEX = f"{SITE}/sitemap_index.xml"
USER_AGENT = (
    "HelloCalRecipeCatalogBot/1.0 "
    "(+https://hellocal.io; personal recipe-catalog import for a private app; "
    "contact: pep@sydtrafik.dk)"
)
SOURCE = "VALDEMARSRO"
SM_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# Enhed -> gram (kun enheder med fast vægt).
UNIT_GRAMS = {"g": 1, "kg": 1000, "mg": 0.001, "ml": 1, "cl": 10, "dl": 100, "l": 1000, "tbsp": 15, "tsp": 5, "pinch": 0.5}
UNIT_ALIASES = {
    "g": "g", "gr": "g", "gr.": "g", "gram": "g", "kg": "kg", "kilo": "kg", "mg": "mg",
    "ml": "ml", "cl": "cl", "dl": "dl", "l": "l", "liter": "l",
    "spsk": "tbsp", "spsk.": "tbsp", "tsk": "tsp", "tsk.": "tsp",
    "knsp": "pinch", "knsp.": "pinch", "knivspids": "pinch",
    "stk": "pcs", "stk.": "pcs", "fed": "clove", "dåse": "can", "dåser": "can", "pakke": "pack", "pakker": "pack",
    "bundt": "bunch", "håndfuld": "handful", "skive": "slice", "skiver": "slice",
}
UNICODE_FRACTIONS = {"½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8"}
QUANTITY_RE = re.compile(
    r"^(?:ca\.?\s*|cirka\s+)?(?P<q>\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)(?![\d/])"
    r"(?:\s*(?:-|–|til)\s*(?P<q2>\d+/\d+|\d+(?:[.,]\d+)?))?\s*",
    re.IGNORECASE,
)


def session():
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def parse_number(text):
    total = 0.0
    for part in text.replace(",", ".").split():
        total += float(Fraction(part)) if "/" in part else float(part)
    return total


def parse_ingredient_line(raw):
    """"2 spsk olivenolie, ekstra jomfru" -> (mængde, enhed, navn)."""
    text = re.sub(r"\s+", " ", raw).strip()
    for symbol, replacement in UNICODE_FRACTIONS.items():
        text = re.sub(rf"(\d)\s*{symbol}", rf"\1 {replacement}", text)
        text = text.replace(symbol, replacement)
    quantity = None
    match = QUANTITY_RE.match(text)
    if match:
        low = parse_number(match.group("q"))
        high = parse_number(match.group("q2")) if match.group("q2") else low
        quantity = round((low + high) / 2, 3)
        text = text[match.end():]
    unit = None
    first, _, rest = text.partition(" ")
    if first.lower() in UNIT_ALIASES and quantity is not None:
        unit = UNIT_ALIASES[first.lower()]
        text = rest
    name = text.partition(",")[0].strip()
    return quantity, unit, name


def minutes_from_text(value):
    """"1 time 30 min" / "45 min." -> minutter."""
    if not value:
        return None
    hours = re.search(r"(\d+)\s*(?:time|timer|t\b)", value)
    minutes = re.search(r"(\d+)\s*min", value)
    total = (int(hours.group(1)) * 60 if hours else 0) + (int(minutes.group(1)) if minutes else 0)
    return total or None


def fetch_sitemap_entries(http):
    index = http.get(SITEMAP_INDEX, timeout=30)
    index.raise_for_status()
    maps = [el.findtext("sm:loc", namespaces=SM_NS) for el in ET.fromstring(index.content).findall("sm:sitemap", SM_NS)]
    entries = []
    for loc in maps:
        # Kun indlæg; sider/kategorier/tags er ikke opskrifter.
        if not loc or "post-sitemap" not in loc:
            continue
        resp = http.get(loc, timeout=60)
        resp.raise_for_status()
        for url_el in ET.fromstring(resp.content).findall("sm:url", SM_NS):
            url = url_el.findtext("sm:loc", default="", namespaces=SM_NS)
            if url:
                entries.append((url, url_el.findtext("sm:lastmod", default="", namespaces=SM_NS)))
        time.sleep(REQUEST_DELAY_SECONDS)
    return entries


def slug_of(url):
    return url.rstrip("/").rsplit("/", 1)[-1]


def parse_recipe(html, url):
    soup = BeautifulSoup(html, "html.parser")
    lines = []
    for li in soup.select("ul.ingredientlist li"):
        if "ingredient-header" in (li.get("class") or []):
            continue
        raw = li.get_text(" ", strip=True)
        if raw:
            lines.append(raw)
    if not lines:
        return None
    steps = [el.get_text(" ", strip=True) for el in soup.select('[itemprop="recipeInstructions"] p, [itemprop="recipeInstructions"] li')]
    stats = {}
    for stat in soup.select(".recipe-stats .recipe-stat"):
        label, value = stat.select_one(".recipe-stat-label"), stat.select_one("strong")
        if label and value:
            stats[label.get_text(strip=True)] = value.get_text(" ", strip=True)
    name_el = soup.select_one('h2[itemprop="name"]') or soup.select_one(".recipe-print-header-title") or soup.select_one("h1")
    image_el = soup.select_one('meta[property="og:image"]')
    yield_el = soup.select_one('[itemprop="recipeYield"]')
    servings_match = re.match(r"\s*(\d+(?:[.,]\d+)?)", stats.get("Antal") or (yield_el.get_text(" ", strip=True) if yield_el else ""))
    servings = parse_number(servings_match.group(1)) if servings_match else None
    return {
        "name": name_el.get_text(" ", strip=True) if name_el else slug_of(url),
        "lines": lines,
        "steps": [s for s in steps if s],
        "total_minutes": minutes_from_text(stats.get("Tid i alt")),
        "servings": servings or 4,
        "image_url": image_el.get("content") if image_el else None,
    }


def download_image(http, image_url, slug):
    if not image_url:
        return None
    try:
        resp = http.get(image_url, timeout=30)
        resp.raise_for_status()
        ext = os.path.splitext(image_url.split("?")[0])[1] or ".jpg"
        out_dir = os.path.join(OUTPUT_DIR, "valdemarsro")
        os.makedirs(out_dir, exist_ok=True)
        filename = f"{slug}{ext}"
        with open(os.path.join(out_dir, filename), "wb") as fh:
            fh.write(resp.content)
        return f"{PUBLIC_PATH_PREFIX}/valdemarsro/{filename}"
    except Exception:  # noqa: BLE001 - et manglende billede må ikke stoppe opskriften
        log.warning("billede kunne ikke hentes for %s", slug)
        return None


def match_product(cur, name):
    """Sikkert match mod en godkendt vare: alle ord skal indgå som hele ord."""
    words = [w for w in re.split(r"[^\w]+", name.lower()) if len(w) > 2][:3]
    if not words:
        return None
    clauses = " AND ".join(["name ILIKE %s"] * len(words))
    cur.execute(
        f"""SELECT name, "kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g" FROM products
            WHERE status = 'APPROVED' AND discontinued = false AND "nutritionMissing" = false
              AND "privateOwnerId" IS NULL AND "externalSource" IS NULL AND {clauses}
            ORDER BY length(name) LIMIT 30""",
        [f"%{w}%" for w in words],
    )
    for row in cur.fetchall():
        row_words = re.split(r"[^\w]+", row[0].lower())
        if all(w in row_words for w in words):
            return row
    return None


def compute_nutrition(cur, parsed_lines):
    """(gram i alt, kcal, protein, kulhydrat, fedt) eller None, hvis for lidt kan regnes med."""
    counted = 0
    grams_total = kcal = protein = carbs = fat = 0.0
    for quantity, unit, name in parsed_lines:
        if quantity is None or unit not in UNIT_GRAMS:
            continue
        product = match_product(cur, name)
        if not product:
            continue
        grams = quantity * UNIT_GRAMS[unit]
        f = grams / 100
        grams_total += grams
        kcal += product[1] * f
        protein += product[2] * f
        carbs += product[3] * f
        fat += product[4] * f
        counted += 1
    if not parsed_lines or counted / len(parsed_lines) < 0.7 or grams_total <= 0:
        return None
    return grams_total, kcal, protein, carbs, fat


def get_category_id(conn, name):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM categories WHERE name = %s", (name,))
        row = cur.fetchone()
        return row[0] if row else None


def upsert_recipe(conn, http, url, parsed, category_id):
    slug = slug_of(url)
    product_id = f"vm_{slug}"[:120]
    parsed_lines = [parse_ingredient_line(line) for line in parsed["lines"]]
    with conn.cursor() as cur:
        nutrition = compute_nutrition(cur, parsed_lines)
    servings = parsed["servings"]
    if nutrition:
        grams_total, kcal, protein, carbs, fat = nutrition
        factor = 100.0 / grams_total
        per100 = (round(kcal * factor, 1), round(protein * factor, 1), round(carbs * factor, 1), round(fat * factor, 1))
        serving_grams = round(grams_total / servings, 1)
        nutrition_missing = False
    else:
        per100, serving_grams, nutrition_missing = (0, 0, 0, 0), None, True

    details = {
        "totalTime": f"PT{parsed['total_minutes']}M" if parsed["total_minutes"] else None,
        "ingredients": [
            {"name": name or raw, "amount": quantity, "unit": unit}
            for raw, (quantity, unit, name) in zip(parsed["lines"], parsed_lines)
        ],
        "steps": [{"text": step} for step in parsed["steps"]],
        "nutrition": [],
        "websiteUrl": url,
        "source": "valdemarsro",
    }
    image_url = download_image(http, parsed["image_url"], slug)
    ingredients_text = ", ".join(name or raw for raw, (_, _, name) in zip(parsed["lines"], parsed_lines))
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
                "recipeDetails" = EXCLUDED."recipeDetails",
                "nutritionMissing" = EXCLUDED."nutritionMissing",
                discontinued = false,
                "sourceCheckedAt" = NOW()
            """,
            (
                product_id, parsed["name"], category_id, image_url, *per100, serving_grams, ingredients_text,
                [], json.dumps(details), SOURCE, slug, nutrition_missing,
            ),
        )
    return product_id


def remember_url(conn, url, is_recipe, lastmod, status=200):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO recipe_source_urls (url, source, "isRecipe", lastmod, "httpStatus", "checkedAt")
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (url) DO UPDATE SET "isRecipe" = EXCLUDED."isRecipe", lastmod = EXCLUDED.lastmod,
                "httpStatus" = EXCLUDED."httpStatus", "checkedAt" = NOW()
            """,
            (url, SOURCE, is_recipe, lastmod or None, status),
        )


def known_urls(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT url, lastmod FROM recipe_source_urls WHERE source = %s", (SOURCE,))
        return {url: lastmod or "" for url, lastmod in cur.fetchall()}


def import_new(conn, http, category_id):
    known = known_urls(conn)
    entries = fetch_sitemap_entries(http)
    log.info("sitemap har %d indlæg, %d kendte", len(entries), len(known))
    imported = failed = 0
    for url, lastmod in entries:
        if imported + failed >= BATCH_SIZE:
            break
        if url in known and known[url] == (lastmod or ""):
            continue
        try:
            resp = http.get(url, timeout=30)
            time.sleep(REQUEST_DELAY_SECONDS)
            if resp.status_code in (404, 410):
                remember_url(conn, url, False, lastmod, resp.status_code)
                conn.commit()
                continue
            resp.raise_for_status()
            parsed = parse_recipe(resp.text, url)
            if not parsed:
                remember_url(conn, url, False, lastmod)
                conn.commit()
                continue
            upsert_recipe(conn, http, url, parsed, category_id)
            remember_url(conn, url, True, lastmod)
            conn.commit()
            imported += 1
            log.info("importeret %s", parsed["name"])
        except Exception:  # noqa: BLE001 - én fejlende side må ikke stoppe natten
            conn.rollback()
            failed += 1
            log.exception("kunne ikke importere %s", url)
    return imported, failed


def check_links(conn, http):
    """Sikrer at alle gemte opskrifters links lever: døde spærres, levende genåbnes."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, "recipeDetails"->>'websiteUrl', discontinued FROM products
               WHERE "externalSource" = %s AND "recipeDetails"->>'websiteUrl' IS NOT NULL
               ORDER BY "sourceCheckedAt" ASC NULLS FIRST LIMIT %s""",
            (SOURCE, LINK_CHECK_BATCH),
        )
        rows = cur.fetchall()
    closed = reopened = 0
    for product_id, url, discontinued in rows:
        try:
            resp = http.head(url, timeout=20, allow_redirects=True)
            if resp.status_code == 405:
                resp = http.get(url, timeout=20)
            time.sleep(REQUEST_DELAY_SECONDS / 2)
            dead = resp.status_code in (404, 410)
            if resp.status_code >= 500 or (resp.status_code >= 400 and not dead):
                continue  # midlertidig fejl: ændr intet
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE products SET discontinued = %s, "sourceCheckedAt" = NOW() WHERE id = %s',
                    (dead, product_id),
                )
            conn.commit()
            if dead and not discontinued:
                closed += 1
            elif not dead and discontinued:
                reopened += 1
        except Exception:  # noqa: BLE001
            conn.rollback()
            log.warning("linktjek fejlede for %s", url)
    return closed, reopened


def run_once(conn):
    category_id = get_category_id(conn, "Retter")
    if not category_id:
        raise RuntimeError('Kategorien "Retter" findes ikke')
    http = session()
    imported, failed = import_new(conn, http, category_id)
    closed, reopened = check_links(conn, http)
    message = f"{imported} nye/ændrede opskrifter, {closed} døde links spærret, {reopened} genåbnet"
    if failed:
        message += f", {failed} fejlede"
    return message, imported + closed + reopened


def main():
    log.info("valdemarsro agent startet, kører dagligt kl. %s", RUN_AT_TIME)
    run_forever(DATABASE_URL, "valdemarsro-import", run_once, run_at_time=RUN_AT_TIME)


if __name__ == "__main__":
    main()
