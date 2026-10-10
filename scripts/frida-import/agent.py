"""
HELLO CAL Frida-agent.

Poller DTU Fødevareinstituttets officielle datarepository (data.dtu.dk, en
Figshare-instans) for en ny udgivelse af Frida (Den Danske Fødevaredatabase),
og importerer den automatisk, når der kommer en ny version — uden manuel
download. Datasættet er offentligt og CC-BY 4.0-licenseret; DTU Foods
Figshare-gruppe har group_id 18053.

Hver fødevare upsertes som et produkt (externalSource=FRIDA, status=APPROVED,
ingen stregkode) matchet på (externalSource, externalId=FoodID), så
genkørsel/en ny version opdaterer eksisterende rækker i stedet for at
duplikere dem. `frida_import_state` husker hvilken Figshare-artikel-id der
senest er importeret, så samme version ikke hentes/importeres igen.

Kildeangivelse (Frida-vilkår): "Fødevaredata (frida.fooddata.dk), DTU
Fødevareinstituttet, Danmarks Tekniske Universitet".
"""

import hashlib
import io
import json
import logging
import os
import time

import openpyxl
import psycopg2
import psycopg2.errors

from job_control import run_forever
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("frida-agent")

# Prisma's DATABASE_URL carries a `?schema=public` query param that
# psycopg2/libpq doesn't recognize; Postgres already defaults to "public".
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
POLL_INTERVAL_SECONDS = int(os.environ.get("FRIDA_POLL_INTERVAL_SECONDS", str(24 * 60 * 60)))

FIGSHARE_SEARCH_URL = "https://api.figshare.com/v2/articles/search"
FIGSHARE_GROUP_ID = 18053
TITLE_MATCH = "Danish Food Composition Database"

# Frida ParameterID for hver af HELLO CALs fire kernenæringsstoffer pr. 100 g.
PARAM_KCAL = 356
PARAM_PROTEIN = 218
PARAM_CARBS = 170  # "Kulhydrat difference" — svarer til USDA's "Carbohydrate, by difference".
PARAM_FAT = 141
MACRO_PARAMS = {PARAM_KCAL, PARAM_PROTEIN, PARAM_CARBS, PARAM_FAT}

# Mikrodata til usikkerheds-~ (docs/DECISIONS.md 2026-09-24): nøgle i
# products."micronutrientsPer100g" → Frida ParameterID'er (lægges sammen).
# Holdes i sync med NUTRIENTS i src/lib/nutrients.ts.
MICRO_PARAMS = {
    "saturatedFat": [248],
    "unsaturatedFat": [247, 251],
    "transFat": [261],
    "cholesterol": [115],
    "sugar": [245],
    "fiber": [168],
    "salt": [327],
    "sodium": [201],
    "potassium": [165],
    "calcium": [108],
    "magnesium": [184],
    "iron": [162],
    "zinc": [274],
    "copper": [166],
    "manganese": [187],
    "selenium": [230],
    "phosphorus": [214],
    "iodine": [163],
    "vitaminA": [12],
    "vitaminC": [47],
    "vitaminD": [126],
    "vitaminE": [135],
    "vitaminK": [442],
    "vitaminB1": [37],
    "vitaminB2": [39],
    "vitaminB3": [294],
    "vitaminB5": [210],
    "vitaminB6": [40],
    "vitaminB7": [42],
    "vitaminB9": [143],
    "vitaminB12": [38],
}
WANTED_PARAMS = MACRO_PARAMS | {pid for ids in MICRO_PARAMS.values() for pid in ids}

# Det færdige Frida-ark (docs/FRIDA.md): titler (ental/flertal), nøgleord, _is_-felter og
# næring pr. række, bygget lokalt med build_sheet.py og lagt i Docker-imaget. Når filen
# findes, er arket sandheden: varer der ikke står i arket slettes, og Figshare-importen
# opdaterer kun næringen på arkets varer (aldrig navne, og opretter ingen nye).
SHEET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheet", "frida_sheet.json")
SHEET_STATE_ID = -1  # sentinel i frida_import_state.figshareArticleId

# En allerede importeret Frida-version genimporteres én gang, når denne
# markør mangler i frida_import_state.title — så mikrodata også kommer ind
# for versioner, der blev importeret, før agenten kunne gemme dem.
IMPORT_MARKER = "[micronutrients-v1]"


def find_latest_article():
    response = requests.post(
        FIGSHARE_SEARCH_URL,
        json={
            "search_for": f'"{TITLE_MATCH}"',
            "order": "published_date",
            "order_direction": "desc",
            "page_size": 20,
        },
        timeout=30,
    )
    response.raise_for_status()
    candidates = [
        item
        for item in response.json()
        if item.get("group_id") == FIGSHARE_GROUP_ID and TITLE_MATCH in item.get("title", "")
    ]
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: item["published_date"], reverse=True)[0]


def find_dataset_download_url(article_id):
    response = requests.get(f"https://api.figshare.com/v2/articles/{article_id}", timeout=30)
    response.raise_for_status()
    for file in response.json().get("files", []):
        if file.get("name", "").lower().endswith(".xlsx"):
            return file["download_url"]
    return None


def download_workbook(download_url):
    response = requests.get(download_url, timeout=120)
    response.raise_for_status()
    return openpyxl.load_workbook(io.BytesIO(response.content), read_only=True, data_only=True)


def parse_foods(workbook):
    names = {}
    for name_dk, name_en, food_id, *_ in workbook["Food"].iter_rows(min_row=2, values_only=True):
        if food_id is not None:
            names[food_id] = (name_dk, name_en)

    values = {}
    for row in workbook["Data_Normalised"].iter_rows(min_row=2, values_only=True):
        food_id, param_id, res_val = row[0], row[3], row[7]
        if param_id in WANTED_PARAMS and isinstance(res_val, (int, float)):
            values.setdefault(food_id, {})[param_id] = float(res_val)

    foods = []
    for food_id, params in values.items():
        if not MACRO_PARAMS.issubset(params):
            continue
        name_dk, _name_en = names.get(food_id, (None, None))
        if not name_dk:
            continue
        micros = {}
        for key, param_ids in MICRO_PARAMS.items():
            # Kun når alle delparametre er målt — en sum af en delvis måling
            # ville være et gæt.
            if all(pid in params for pid in param_ids):
                micros[key] = round(sum(params[pid] for pid in param_ids), 4)
        foods.append(
            {
                "external_id": str(food_id),
                "name": name_dk.strip(),
                "kcal": round(params[PARAM_KCAL], 2),
                "protein": round(params[PARAM_PROTEIN], 2),
                "carbs": round(params[PARAM_CARBS], 2),
                "fat": round(params[PARAM_FAT], 2),
                "micros": micros,
            }
        )
    return foods


def already_imported(conn, article_id):
    with conn.cursor() as cur:
        cur.execute("SELECT title FROM frida_import_state WHERE \"figshareArticleId\" = %s", (article_id,))
        row = cur.fetchone()
        return row is not None and IMPORT_MARKER in (row[0] or "")


def load_sheet():
    """Returnerer (rækker, sha256) for det publicerede Frida-ark, eller (None, None)."""
    if not os.path.exists(SHEET_PATH):
        return None, None
    with open(SHEET_PATH, "rb") as fh:
        raw = fh.read()
    return json.loads(raw.decode("utf-8")), hashlib.sha256(raw).hexdigest()


def sheet_already_applied(conn, digest):
    with conn.cursor() as cur:
        cur.execute('SELECT title FROM frida_import_state WHERE "figshareArticleId" = %s', (SHEET_STATE_ID,))
        row = cur.fetchone()
        return row is not None and row[0] == f"sheet:{digest}"


def mark_sheet_applied(conn, digest):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO frida_import_state ("figshareArticleId", title) VALUES (%s, %s)
            ON CONFLICT ("figshareArticleId") DO UPDATE SET title = EXCLUDED.title, "importedAt" = NOW()
            """,
            (SHEET_STATE_ID, f"sheet:{digest}"),
        )


def apply_sheet(conn, items):
    """Gør databasens Frida-varer lig med arket: opdater, opret og slet resten.

    Match på (externalSource='FRIDA', externalId); rækker der deler FoodID får
    externalId "<FoodID>-2" osv. En vare der ikke længere står i arket slettes —
    hvis noget andet i databasen refererer til den (fx en logget registrering),
    skjules den i stedet (discontinued), så ingen historik brydes.
    """
    inserted = updated = deleted = hidden = 0
    keep_ids = [item["external_id"] for item in items]
    with conn.cursor() as cur:
        for item in items:
            values = (
                item["name"],
                item.get("name_plural"),
                item.get("product_type"),
                item.get("variant"),
                item.get("keywords") or [],
                json.dumps(item.get("tags") or {}),
                item["kcal"],
                item["protein"],
                item["carbs"],
                item["fat"],
                json.dumps(item["micros"]),
            )
            cur.execute(
                """SELECT id FROM products WHERE "externalSource" = 'FRIDA' AND "externalId" = %s""",
                (item["external_id"],),
            )
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    """
                    UPDATE products
                    SET name = %s, "namePlural" = %s, "productType" = %s, variant = %s, keywords = %s,
                        "dietaryTags" = %s::jsonb, "kcalPer100g" = %s, "proteinPer100g" = %s,
                        "carbsPer100g" = %s, "fatPer100g" = %s, "micronutrientsPer100g" = %s::jsonb,
                        discontinued = false, "sourceCheckedAt" = NOW()
                    WHERE id = %s
                    """,
                    values + (existing[0],),
                )
                updated += 1
            else:
                cur.execute(
                    """
                    INSERT INTO products
                        (id, name, "namePlural", "productType", variant, keywords, "dietaryTags",
                         "kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g", "micronutrientsPer100g",
                         "externalSource", "externalId", "sourceCheckedAt", status, discontinued, "createdAt")
                    VALUES
                        (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s::jsonb,
                         'FRIDA', %s, NOW(), 'APPROVED', false, NOW())
                    """,
                    (f"frida_{item['external_id']}",) + values + (item["external_id"],),
                )
                inserted += 1

        cur.execute(
            """SELECT id, "externalId" FROM products
               WHERE "externalSource" = 'FRIDA' AND NOT ("externalId" = ANY(%s))""",
            (keep_ids,),
        )
        for product_id, external_id in cur.fetchall():
            cur.execute("SAVEPOINT remove_frida_product")
            try:
                cur.execute("DELETE FROM products WHERE id = %s", (product_id,))
                deleted += 1
            except psycopg2.errors.ForeignKeyViolation:
                cur.execute("ROLLBACK TO SAVEPOINT remove_frida_product")
                cur.execute("UPDATE products SET discontinued = true WHERE id = %s", (product_id,))
                hidden += 1
            cur.execute("RELEASE SAVEPOINT remove_frida_product")
    return inserted, updated, deleted, hidden


def upsert_foods(conn, foods, sheet_managed=False):
    inserted = updated = 0
    with conn.cursor() as cur:
        for food in foods:
            if sheet_managed:
                # Arket ejer navne/nøgleord/_is_-felter og varesættet: kun næringen opdateres.
                cur.execute(
                    """
                    UPDATE products
                    SET "kcalPer100g" = %s, "proteinPer100g" = %s, "carbsPer100g" = %s, "fatPer100g" = %s,
                        "micronutrientsPer100g" = %s::jsonb, "sourceCheckedAt" = NOW()
                    WHERE "externalSource" = 'FRIDA'
                      AND ("externalId" = %s OR "externalId" LIKE %s)
                    """,
                    (
                        food["kcal"],
                        food["protein"],
                        food["carbs"],
                        food["fat"],
                        json.dumps(food["micros"]),
                        food["external_id"],
                        f"{food['external_id']}-%",
                    ),
                )
                updated += cur.rowcount
                continue
            cur.execute(
                """SELECT id FROM products WHERE "externalSource" = 'FRIDA' AND "externalId" = %s""",
                (food["external_id"],),
            )
            existing = cur.fetchone()

            micros = json.dumps(food["micros"])
            if existing:
                cur.execute(
                    """
                    UPDATE products
                    SET name = %s, "kcalPer100g" = %s, "proteinPer100g" = %s,
                        "carbsPer100g" = %s, "fatPer100g" = %s,
                        "micronutrientsPer100g" = %s::jsonb, "sourceCheckedAt" = NOW()
                    WHERE id = %s
                    """,
                    (food["name"], food["kcal"], food["protein"], food["carbs"], food["fat"], micros, existing[0]),
                )
                updated += 1
            else:
                cur.execute(
                    """
                    INSERT INTO products
                        (id, name, "kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g",
                         "micronutrientsPer100g",
                         "externalSource", "externalId", "sourceCheckedAt", status, discontinued, "createdAt")
                    VALUES
                        (%s, %s, %s, %s, %s, %s, %s::jsonb, 'FRIDA', %s, NOW(), 'APPROVED', false, NOW())
                    """,
                    (
                        f"frida_{food['external_id']}",
                        food["name"],
                        food["kcal"],
                        food["protein"],
                        food["carbs"],
                        food["fat"],
                        micros,
                        food["external_id"],
                    ),
                )
                inserted += 1
    return inserted, updated


def backfill_generic_ingredients(conn):
    """Kopierer Frida-mikrodata til generiske ingredienser, der mangler dem.

    Samme snapshot-princip som makroerne: kun rækker uden mikrodata udfyldes,
    så en senere Frida-version aldrig ændrer allerede kopierede tal.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE generic_ingredients g
            SET "micronutrientsPer100g" = p."micronutrientsPer100g"
            FROM products p
            WHERE g."fridaProductId" = p.id
              AND g."micronutrientsPer100g" IS NULL
              AND p."micronutrientsPer100g" IS NOT NULL
            """
        )
        return cur.rowcount


def mark_imported(conn, article_id, title):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO frida_import_state ("figshareArticleId", title) VALUES (%s, %s)
            ON CONFLICT ("figshareArticleId") DO UPDATE SET title = EXCLUDED.title, "importedAt" = NOW()
            """,
            (article_id, f"{title} {IMPORT_MARKER}"),
        )


def run_once(conn):
    # Returnerer (besked, antal udført) til admin "Robotter"/"Nattens kørsler".
    sheet_items, sheet_digest = load_sheet()
    sheet_message, sheet_count = None, 0
    if sheet_items is not None and not sheet_already_applied(conn, sheet_digest):
        inserted, updated, deleted, hidden = apply_sheet(conn, sheet_items)
        mark_sheet_applied(conn, sheet_digest)
        conn.commit()
        sheet_count = inserted + updated + deleted + hidden
        sheet_message = (
            f"Frida-ark publiceret: {inserted} nye, {updated} opdaterede, "
            f"{deleted} slettede, {hidden} skjulte (refereret andetsteds)"
        )
        log.info(sheet_message)
    message, count = run_figshare(conn, sheet_managed=sheet_items is not None)
    if sheet_message:
        return f"{sheet_message}. {message}", sheet_count + count
    return message, count


def run_figshare(conn, sheet_managed=False):
    article = find_latest_article()
    if not article:
        log.warning("no Frida dataset found via Figshare search")
        return "Ingen Frida-udgivelse fundet på Figshare", 0

    article_id, title = article["id"], article["title"]
    if already_imported(conn, article_id):
        log.info("already imported: %s (%s)", title, article_id)
        return f"Ingen ny Frida-udgivelse ({title} er allerede importeret)", 0

    log.info("new Frida release found: %s (%s)", title, article_id)
    download_url = find_dataset_download_url(article_id)
    if not download_url:
        log.error("no .xlsx file found on article %s", article_id)
        raise RuntimeError(f"Ingen .xlsx-fil fundet på Figshare-artikel {article_id}")

    workbook = download_workbook(download_url)
    foods = parse_foods(workbook)
    log.info("parsed %d foods with all four macros", len(foods))

    inserted, updated = upsert_foods(conn, foods, sheet_managed=sheet_managed)
    backfilled = backfill_generic_ingredients(conn)
    mark_imported(conn, article_id, title)
    conn.commit()
    log.info(
        "import complete — inserted: %d, updated: %d, generic ingredients backfilled: %d",
        inserted,
        updated,
        backfilled,
    )
    return (
        f"{title}: {inserted} nye og {updated} opdaterede fødevarer, {backfilled} ingredienser udfyldt",
        inserted + updated,
    )


def main():
    log.info("frida agent started, polling every %ss", POLL_INTERVAL_SECONDS)
    # Planlægning/pause/"kør nu" styres fra admin "Cron-jobs" (job_control.py);
    # POLL_INTERVAL_SECONDS er kun standard-intervallet første gang.
    run_forever(
        DATABASE_URL,
        "frida-import",
        run_once,
        interval_minutes=max(1, POLL_INTERVAL_SECONDS // 60),
        # Kør også ved hver container-start, så et nyt Frida-ark (sheet/frida_sheet.json) går live ved deploy.
        run_on_start=True,
    )


if __name__ == "__main__":
    main()
