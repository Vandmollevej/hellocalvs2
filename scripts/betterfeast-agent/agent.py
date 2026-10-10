"""
HELLO CAL BetterFeast-agent (natligt job).

Katalogiserer BetterFeasts færdigretter som Product-rækker
(externalSource = BETTERFEAST, category "Retter"), som HelloFresh-retterne:
navn, billede, kasse/måltidstype, allergener, den fulde varedeklaration og
BetterFeasts egne næringsværdier pr. 100 g (energi kJ/kcal, fedt, mættet fedt,
kulhydrat, sukkerarter, protein, salt).

Kilde: `/ugens-menu/` (samme side enhver besøgende får) viser de næste fire
ugers retter i Familiekassen (én ret pr. kort) og Livsstils-/Hverdagskassen
(dagsplaner med morgen-, middags- og aftensmåltid). Knappen "Deklaration" ved
hver ret/dag henter deklarationen fra sidens egen `admin-ajax.php`
(`action=tk_dekl_fetch`), som robots.txt udtrykkeligt tillader. Agenten læser
præcis de samme to svar, som knappen viser.

BetterFeast har ikke et fast ret-ID, og samme ret går igen uge efter uge;
rækken nøgles derfor på rettens navn (slug). Menuen viser kun fire uger frem,
så kataloget vokser nat for nat. Retter, der ikke har stået på menuen i
`BETTERFEAST_STALE_DAYS` dage, spærres (discontinued) og åbnes igen, hvis de
vender tilbage — en ret admin har deaktiveret, forbliver deaktiveret.
"""

import html
import json
import logging
import os
import re
import time
import unicodedata

import requests
from bs4 import BeautifulSoup, NavigableString

from job_control import run_forever

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("betterfeast-agent")

DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
RUN_AT_TIME = os.environ.get("BETTERFEAST_RUN_AT_TIME", "04:00")
STALE_DAYS = int(os.environ.get("BETTERFEAST_STALE_DAYS", "120"))
REQUEST_DELAY_SECONDS = float(os.environ.get("BETTERFEAST_REQUEST_DELAY_SECONDS", "0.8"))
OUTPUT_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/hellofresh-images")

SITE = "https://www.betterfeast.dk"
MENU_URL = f"{SITE}/ugens-menu/"
DECLARATION_URL = f"{SITE}/wp-admin/admin-ajax.php"
SOURCE = "BETTERFEAST"
USER_AGENT = (
    "HelloCalRecipeCatalogBot/1.0 "
    "(+https://hellocal.io; personal recipe-catalog import for a private app; "
    "contact: pep@sydtrafik.dk)"
)

# Menuens ikoner -> mærkater på retten (ikonforklaringen på /ugens-menu/).
ICON_TAGS = {"🌶": "Stærk", "🥗": "Frisk grønt", "🐟": "Fisk", "🌱": "Vegetar"}
# Dagskortets mærkater -> deklarationens afsnitsnavne.
MEAL_TYPES = {"morgen": "Morgenmad", "middag": "Frokost", "frokost": "Frokost", "aften": "Aftensmad"}

# Fremhævede (VERSALER/fede) ord i deklarationen -> de 14 EU-nøgler i
# src/lib/allergens.ts. Matcher ordstammen, så "HVEDEMEL" og "MÆLKEsyrekultur" tæller.
ALLERGEN_STEMS = [
    ("jordnød", "peanuts"),
    ("peanut", "peanuts"),
    ("mælk", "milk"),
    ("fløde", "milk"),
    ("smør", "milk"),
    ("ost", "milk"),
    ("valle", "milk"),
    ("laktose", "milk"),
    ("yoghurt", "milk"),
    ("kvark", "milk"),
    ("skyr", "milk"),
    ("æg", "eggs"),
    ("hvede", "gluten"),
    ("gluten", "gluten"),
    ("spelt", "gluten"),
    ("rug", "gluten"),
    ("byg", "gluten"),
    ("havre", "gluten"),
    ("durum", "gluten"),
    ("kamut", "gluten"),
    ("soja", "soybeans"),
    ("selleri", "celery"),
    ("sennep", "mustard"),
    ("sesam", "sesame-seeds"),
    ("sulfit", "sulphur-dioxide-and-sulphites"),
    ("svovldioxid", "sulphur-dioxide-and-sulphites"),
    ("lupin", "lupin"),
    ("bløddyr", "molluscs"),
    ("muslin", "molluscs"),
    ("blæksprut", "molluscs"),
    ("rejer", "crustaceans"),
    ("reje", "crustaceans"),
    ("krebsdyr", "crustaceans"),
    ("hummer", "crustaceans"),
    ("krabbe", "crustaceans"),
    ("fisk", "fish"),
    ("torsk", "fish"),
    ("laks", "fish"),
    ("tun", "fish"),
    ("sej", "fish"),
    ("rødspætte", "fish"),
    ("ansjos", "fish"),
    ("mandel", "nuts"),
    ("mandler", "nuts"),
    ("hasselnød", "nuts"),
    ("valnød", "nuts"),
    ("cashew", "nuts"),
    ("pistacie", "nuts"),
    ("pekan", "nuts"),
    ("macadamia", "nuts"),
    ("paranød", "nuts"),
    ("nødder", "nuts"),
]
ALLERGEN_LABELS = {
    "gluten": "Gluten",
    "crustaceans": "Skaldyr",
    "eggs": "Æg",
    "fish": "Fisk",
    "peanuts": "Jordnødder",
    "soybeans": "Soja",
    "milk": "Mælk",
    "nuts": "Nødder",
    "celery": "Selleri",
    "mustard": "Sennep",
    "sesame-seeds": "Sesamfrø",
    "sulphur-dioxide-and-sulphites": "Svovldioxid og sulfitter",
    "lupin": "Lupin",
    "molluscs": "Bløddyr",
}
# Deklarationens næringsrækker -> (kolonne/nøgle, visningsnavn som HelloFresh).
NUTRITION_ROWS = {
    "fedt": ("fat", "Fedt"),
    "heraf mættede fedtsyrer": ("saturatedFat", "Mættet fedt"),
    "kulhydrat": ("carbs", "Kulhydrat"),
    "heraf sukkerarter": ("sugar", "Sukker"),
    "kostfibre": ("fiber", "Kostfibre"),
    "protein": ("protein", "Protein"),
    "salt": ("salt", "Salt"),
}
NUMBER_RE = re.compile(r"(\d+(?:[.,]\d+)?)")
ENERGY_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*kJ\s*/\s*(\d+(?:[.,]\d+)?)\s*kcal", re.I)
SIZE_SUFFIX_RE = re.compile(r"-\d+x\d+(?=\.(?:jpe?g|png|webp)$)", re.I)


def session():
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    return s


def to_number(text):
    match = NUMBER_RE.search(text or "")
    if not match:
        return None
    value = float(match.group(1).replace(",", "."))
    return int(value) if value.is_integer() else value


def split_title(raw):
    """"Thai ramen m. nudler 🌶️" -> ("Thai ramen m. nudler", ["Stærk"])."""
    tags = [tag for icon, tag in ICON_TAGS.items() if icon in raw]
    title = "".join(ch for ch in raw if unicodedata.category(ch) not in ("So", "Mn", "Cf") or ch.isalnum())
    return re.sub(r"\s+", " ", title).strip(" -–"), tags


def slugify(text):
    text = text.lower().replace("æ", "ae").replace("ø", "oe").replace("å", "aa")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


# --------------------------------------------------------------------- menu


def parse_menu(page_html):
    """Alle retter på menuen: titel, billede, kasse, uge, måltidstype og deklarations-ID."""
    soup = BeautifulSoup(page_html, "html.parser")
    dishes = []
    for week_el in soup.select("div.umv3-week"):
        heading = week_el.find("h2")
        box = heading.find("em").get_text(strip=True) if heading and heading.find("em") else None
        week_match = re.search(r"uge\s*(\d+)", heading.get_text(" ", strip=True) if heading else "", re.I)
        week = int(week_match.group(1)) if week_match else None
        for article in week_el.select("article.umv3-meal"):
            button = article.select_one("[data-dekl-post]")
            title_el = article.find("h4")
            if not button or not title_el:
                continue
            img = article.select_one("noscript img") or article.select_one("img[data-src]")
            image = (img.get("src") if img and not (img.get("src") or "").startswith("data:") else None) or (
                img.get("data-src") if img else None
            )
            rating = article.select_one(".umv3-rating-val")
            count = article.select_one(".umv3-rating-cnt")
            dishes.append(
                {
                    "title": title_el.get_text(" ", strip=True),
                    "image": image,
                    "box": box,
                    "week": week,
                    "mealType": None,
                    "post": button["data-dekl-post"],
                    "ret": button["data-dekl-ret"],
                    "section": 0,
                    "rating": to_number(rating.get_text() if rating else None),
                    "ratingCount": to_number(count.get_text() if count else None),
                }
            )
        for card in week_el.select("div.umv3-daycard"):
            button = card.select_one("[data-dekl-post]")
            if not button:
                continue
            for index, row in enumerate(card.select(".umv3-mrow")):
                label = (row.select_one(".mlbl").get_text(strip=True) if row.select_one(".mlbl") else "").lower()
                name = row.select_one(".mname")
                if not name:
                    continue
                dishes.append(
                    {
                        "title": name.get_text(" ", strip=True),
                        "image": None,
                        "box": box,
                        "week": week,
                        "mealType": MEAL_TYPES.get(label),
                        "post": button["data-dekl-post"],
                        "ret": button["data-dekl-ret"],
                        "section": index,
                        "rating": None,
                        "ratingCount": None,
                    }
                )
    return dishes


def fetch_declaration(http, post, ret):
    resp = http.get(DECLARATION_URL, params={"action": "tk_dekl_fetch", "post_id": post, "ret_i": ret}, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("success"):
        return None
    return parse_declaration((data.get("data") or {}).get("html") or "")


def parse_nutrition(table):
    values = {}
    for tr in table.select("tr"):
        cells = tr.find_all("td")
        if len(cells) < 2:
            continue
        label = cells[0].get_text(" ", strip=True).lower()
        for ref in cells[1].select(".tk-dekl-nutri-ref"):
            ref.decompose()
        value = cells[1].get_text(" ", strip=True)
        if label.startswith("energi"):
            energy = ENERGY_RE.search(value)
            if energy:
                values["kj"] = to_number(energy.group(1))
                values["kcal"] = to_number(energy.group(2))
        elif label in NUTRITION_ROWS:
            values[NUTRITION_ROWS[label][0]] = to_number(value)
    return values


def parse_declaration(fragment):
    """Deklarationens afsnit i rækkefølge: [{"declaration", "highlighted", "nutrition"}]."""
    soup = BeautifulSoup(fragment, "html.parser")
    body = soup.select_one(".tk-dekl-modal-body") or soup
    sections, current = [], None
    for el in body.find_all(["h4", "div"], recursive=False):
        if el.name == "h4" or current is None:
            current = {"title": el.get_text(" ", strip=True) if el.name == "h4" else None, "declaration": None,
                       "highlighted": [], "nutrition": {}}
            sections.append(current)
            if el.name == "h4":
                continue
        label = el.select_one(".tk-dekl-modal-label")
        label_text = label.get_text(" ", strip=True).lower() if label else ""
        if label_text.startswith("indhold"):
            text_el = el.select_one(".tk-dekl-modal-text")
            if text_el:
                current["highlighted"] = highlighted_outside_traces(text_el)
                current["declaration"] = re.sub(r"\s+", " ", html.unescape(text_el.get_text(" ", strip=True)))
                current["declaration"] = re.sub(r"\s+([,.)])", r"\1", current["declaration"])
                current["declaration"] = re.sub(r"\(\s+", "(", current["declaration"]).strip()
        elif label_text.startswith("næringsindhold"):
            table = el.select_one("table")
            if table:
                current["nutrition"] = parse_nutrition(table)
    return [s for s in sections if s["declaration"] or s["nutrition"]]


def highlighted_outside_traces(text_el):
    """Fede ord i deklarationen, undtagen dem i en "Spor af: …."-sætning."""
    words, in_traces = [], False
    for node in text_el.descendants:
        if isinstance(node, NavigableString):
            if node.parent is not None and node.parent.name == "strong":
                continue
            low = node.lower()
            if "spor af" in low:
                in_traces = "." not in low[low.index("spor af"):]
            elif in_traces and "." in low:
                in_traces = False
        elif node.name == "strong" and not in_traces:
            word = node.get_text(strip=True)
            if word:
                words.append(word)
    return words


def allergens_of(section):
    """BetterFeasts fremhævede allergenord -> EU-nøgler."""
    keys = set()
    for word in section.get("highlighted") or []:
        low = word.lower()
        if len(low) < 2:  # "E" i "E223" er ikke et allergen; "ÆG" er
            continue
        for stem, key in ALLERGEN_STEMS:
            if stem in low:
                keys.add(key)
                break
    return sorted(keys)


# ------------------------------------------------------------------- import


def download_image(http, url, slug):
    if not url:
        return None
    original = SIZE_SUFFIX_RE.sub("", url)
    for candidate in (original, url) if original != url else (url,):
        try:
            resp = http.get(candidate, timeout=30)
            if resp.status_code != 200 or not resp.headers.get("content-type", "").startswith("image"):
                continue
            ext = os.path.splitext(candidate.split("?")[0])[1] or ".jpg"
            out_dir = os.path.join(OUTPUT_DIR, "betterfeast")
            os.makedirs(out_dir, exist_ok=True)
            filename = f"{slug}{ext}"
            with open(os.path.join(out_dir, filename), "wb") as fh:
                fh.write(resp.content)
            time.sleep(REQUEST_DELAY_SECONDS / 2)
            return f"{PUBLIC_PATH_PREFIX}/betterfeast/{filename}"
        except Exception:  # noqa: BLE001 - et manglende billede må ikke stoppe retten
            continue
    log.warning("billede kunne ikke hentes: %s", url)
    return None


def existing_details(conn, product_id):
    with conn.cursor() as cur:
        cur.execute('SELECT "recipeDetails", "imageUrl" FROM products WHERE id = %s', (product_id,))
        row = cur.fetchone()
    return (row[0] or {}, row[1]) if row else ({}, None)


def merge_unique(*lists):
    out = []
    for items in lists:
        for item in items or []:
            if item and item not in out:
                out.append(item)
    return out


def upsert_dish(conn, http, dish, section, category_id, seen_week):
    title, icon_tags = split_title(dish["title"])
    slug = slugify(title)[:110]
    if not slug:
        return None
    product_id = f"bf_{slug}"
    nutrition = section.get("nutrition") or {}
    core = [nutrition.get(k) for k in ("kcal", "protein", "carbs", "fat")]
    nutrition_missing = any(v is None for v in core)
    keys = allergens_of(section)

    previous, previous_image = existing_details(conn, product_id)
    image_url = previous_image or download_image(http, dish.get("image"), slug)
    rows = [
        ("Energi (kJ)", nutrition.get("kj"), "kJ"),
        ("Kalorier (kcal)", nutrition.get("kcal"), "kcal"),
        *[(label, nutrition.get(key), "g") for key, label in NUTRITION_ROWS.values()],
    ]
    details = {
        "headline": None,
        "description": None,
        "totalTime": None,
        "difficulty": None,
        "tags": merge_unique(previous.get("tags"), [dish.get("box"), dish.get("mealType")], icon_tags),
        "allergens": [ALLERGEN_LABELS[k] for k in keys],
        "ingredients": [],
        "declaration": section.get("declaration"),
        "steps": [],
        "nutrition": [{"name": n, "amount": a, "unit": u} for n, a, u in rows if a is not None],
        "nutritionBasis": "100g",
        "websiteUrl": MENU_URL,
        "source": "betterfeast",
        "boxes": merge_unique(previous.get("boxes"), [dish.get("box")]),
        "mealTypes": merge_unique(previous.get("mealTypes"), [dish.get("mealType")]),
        "rating": dish.get("rating") if dish.get("rating") is not None else previous.get("rating"),
        "ratingCount": dish.get("ratingCount") if dish.get("ratingCount") is not None else previous.get("ratingCount"),
        "lastSeenWeek": seen_week,
    }
    if previous.get("retiredByAgent"):
        # Bevares, så reopen_and_retire kan genåbne en ret, vi selv lukkede.
        details["retiredByAgent"] = True
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO products
                (id, name, "categoryId", "imageUrl", "kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g",
                 "saturatedFatPer100g", "servingSizeGrams", "ingredientsText", allergens, "recipeDetails",
                 "externalSource", "externalId", "sourceCheckedAt", "nutritionMissing", status, discontinued, "createdAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, %s, %s, %s, NOW(), %s, 'APPROVED', false, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                "imageUrl" = COALESCE(EXCLUDED."imageUrl", products."imageUrl"),
                "kcalPer100g" = EXCLUDED."kcalPer100g", "proteinPer100g" = EXCLUDED."proteinPer100g",
                "carbsPer100g" = EXCLUDED."carbsPer100g", "fatPer100g" = EXCLUDED."fatPer100g",
                "saturatedFatPer100g" = EXCLUDED."saturatedFatPer100g",
                "ingredientsText" = EXCLUDED."ingredientsText",
                allergens = EXCLUDED.allergens,
                "recipeDetails" = EXCLUDED."recipeDetails",
                "nutritionMissing" = EXCLUDED."nutritionMissing",
                "sourceCheckedAt" = NOW()
            """,
            (
                product_id,
                title,
                category_id,
                image_url,
                *[round(float(v), 1) if v is not None else 0 for v in core],
                nutrition.get("saturatedFat"),
                section.get("declaration"),
                keys,
                json.dumps(details),
                SOURCE,
                slug,
                nutrition_missing,
            ),
        )
        # Sukkerarter, kostfibre, salt og kJ pr. 100 g ligger, som for
        # butiksvarerne, i product_nutrition_features (ikke nutritionExtra, der
        # er pr. portion for HelloFresh).
        cur.execute(
            """
            INSERT INTO "product_nutrition_features"
                (id, "productId", basis, "sugarsPer100g", "sugarSource", "fiberPer100g", "fiberSource",
                 "saltPer100g", "saltSource", "energyKjPer100g", "createdAt", "updatedAt")
            VALUES (%(id)s, %(pid)s, '100g', %(sugar)s, %(sugar_src)s::"ProductFeatureSource", %(fiber)s,
                    %(fiber_src)s::"ProductFeatureSource", %(salt)s, %(salt_src)s::"ProductFeatureSource", %(kj)s, now(), now())
            ON CONFLICT ("productId") DO UPDATE SET basis = '100g',
                "sugarsPer100g" = EXCLUDED."sugarsPer100g", "sugarSource" = EXCLUDED."sugarSource",
                "fiberPer100g" = EXCLUDED."fiberPer100g", "fiberSource" = EXCLUDED."fiberSource",
                "saltPer100g" = EXCLUDED."saltPer100g", "saltSource" = EXCLUDED."saltSource",
                "energyKjPer100g" = EXCLUDED."energyKjPer100g", "updatedAt" = now()
            """,
            {
                "id": f"bf_nf_{slug}",
                "pid": product_id,
                "sugar": nutrition.get("sugar"),
                "sugar_src": "MANUFACTURER" if nutrition.get("sugar") is not None else None,
                "fiber": nutrition.get("fiber"),
                "fiber_src": "MANUFACTURER" if nutrition.get("fiber") is not None else None,
                "salt": nutrition.get("salt"),
                "salt_src": "MANUFACTURER" if nutrition.get("salt") is not None else None,
                "kj": nutrition.get("kj"),
            },
        )
    return product_id


def reopen_and_retire(conn, seen_ids):
    """Retter på menuen igen åbnes (hvis vi selv lukkede dem); retter, der ikke
    har været på menuen i STALE_DAYS dage, spærres. Admins deaktivering røres ikke."""
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE products SET discontinued = false, "recipeDetails" = "recipeDetails" - 'retiredByAgent'
               WHERE "externalSource" = %s AND id = ANY(%s) AND discontinued = true
                 AND ("recipeDetails"->>'retiredByAgent') = 'true'""",
            (SOURCE, list(seen_ids)),
        )
        reopened = cur.rowcount
        cur.execute(
            """UPDATE products SET discontinued = true,
                   "recipeDetails" = "recipeDetails" || '{"retiredByAgent": true}'::jsonb
               WHERE "externalSource" = %s AND discontinued = false
                 AND "sourceCheckedAt" < now() - make_interval(days => %s)""",
            (SOURCE, STALE_DAYS),
        )
        retired = cur.rowcount
    conn.commit()
    return reopened, retired


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
    resp = http.get(MENU_URL, timeout=60)
    resp.raise_for_status()
    dishes = parse_menu(resp.text)
    log.info("menuen har %d retter", len(dishes))

    declarations = {}
    seen, imported, failed = set(), 0, 0
    for dish in dishes:
        key = (dish["post"], dish["ret"])
        try:
            if key not in declarations:
                declarations[key] = fetch_declaration(http, *key) or []
                time.sleep(REQUEST_DELAY_SECONDS)
            sections = declarations[key]
            if dish["section"] >= len(sections):
                log.warning("ingen deklaration for %s", dish["title"])
                continue
            seen_week = f"uge {dish['week']}" if dish.get("week") else None
            product_id = upsert_dish(conn, http, dish, sections[dish["section"]], category_id, seen_week)
            conn.commit()
            if product_id and product_id not in seen:
                seen.add(product_id)
                imported += 1
        except Exception:  # noqa: BLE001 - én fejlende ret må ikke stoppe natten
            conn.rollback()
            failed += 1
            log.exception("kunne ikke importere %s", dish.get("title"))
    reopened, retired = reopen_and_retire(conn, seen)
    message = f"{imported} retter opdateret fra menuen, {retired} gamle spærret, {reopened} genåbnet"
    if failed:
        message += f", {failed} fejlede"
    return message, imported + retired + reopened


def main():
    log.info("betterfeast agent startet, kører dagligt kl. %s", RUN_AT_TIME)
    run_forever(DATABASE_URL, "betterfeast-import", run_once, run_at_time=RUN_AT_TIME)


if __name__ == "__main__":
    main()
