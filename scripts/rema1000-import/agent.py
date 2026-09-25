"""
HELLO CAL REMA1000-agent.

One-shot bulk import of the REMA1000 product catalog scraped and structured
by hand into `data/rema1000_products.json` (see docs/DECISIONS.md,
2026-09-19). Unlike frida-agent/hellofresh-agent this source is not polled
live -- the JSON is a static snapshot baked into the image -- so the agent
runs the import once per container start and then exits (no poll loop).

Each row upserts as a Product matched on (externalSource=REMA1000,
externalId=<product key>), where the product key is the EAN when the source
had one, otherwise a generated PRODUCTTYPE_BRAND5_00001-style key (see the
spreadsheet build script) -- so re-running this agent after a data fix
updates existing rows instead of duplicating them.

Rows with no matched nutrition data (no kcal/protein/carbs/fat -- these are
NOT NULL columns on Product) are skipped and logged rather than inserted
with fabricated zeros; see the run summary for exactly which EANs need
manual nutrition entry.

Every imported product is tagged with the "Rema 1000" Store (chain-level
"found in this store" tagging, see the Store/ProductStore models) since
that's where every one of these rows was scraped from.
"""

import json
import logging
import os

import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("rema1000-agent")

# Prisma's DATABASE_URL carries a `?schema=public` query param that
# psycopg2/libpq doesn't recognize; Postgres already defaults to "public".
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
DATA_PATH = os.environ.get("REMA1000_DATA_PATH", "/app/data/rema1000_products.json")
STORE_NAME = "Rema 1000"

# Excel/JSON-kolonnen "Type" -> Product.productCategory (docs/DECISIONS.md
# 2026-09-24). Grøntsager/frugt -> VEGETABLES (G3, brugerens grove
# regnearks-kategorier: Drikkevarer, Grøntsager, Råvarer, Forarbejdede varer).
# Kun DRINK styrer noget i UI'et (ml/cl i stedet for g); ukendte
# typer gemmes som NULL (= g) i stedet for at blive gættet.
PRODUCT_CATEGORY_BY_TYPE = {
    "drikkevare": "DRINK",
    "processed foods": "PROCESSED",
    "slik": "PROCESSED",
    "pålæg": "PROCESSED",
    "pålægssalat": "PROCESSED",
    "salater": "PROCESSED",
    "råvarer": "RAW",
    "grøntsager": "VEGETABLES",
    "grøntsager og frugt": "VEGETABLES",
    "frisk frugt m.m.": "VEGETABLES",
    "frisk grønt": "VEGETABLES",
}


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


def split_list(text):
    if not text:
        return []
    return [part.strip() for part in text.split(",") if part.strip()]


def get_or_create_id(cur, table, name):
    cur.execute(f'SELECT id FROM "{table}" WHERE name = %s', (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    import uuid

    new_id = f"c{uuid.uuid4().hex[:24]}"
    cur.execute(f'INSERT INTO "{table}" (id, name) VALUES (%s, %s)', (new_id, name))
    return new_id


def run():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        rows = json.load(f)
    log.info("Loaded %d rows from %s", len(rows), DATA_PATH)

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    store_id = get_or_create_id(cur, "stores", STORE_NAME)

    imported = 0
    skipped_no_nutrition = []
    skipped_no_title = []

    for row in rows:
        product_key = row["productKey"]
        title = clean(row.get("helloCalTitle"))
        if not title:
            skipped_no_title.append(product_key)
            continue

        nutrition = row.get("nutrition") or {}
        kcal = nutrition.get("energyKcal")
        protein = nutrition.get("protein")
        carbs = nutrition.get("carbohydrate")
        fat = nutrition.get("fat")
        if kcal is None or protein is None or carbs is None or fat is None:
            skipped_no_nutrition.append(product_key)
            continue

        brand_name = clean(row.get("brand"))
        brand_id = get_or_create_id(cur, "brands", brand_name) if brand_name else None

        category_name = clean(row.get("category")) or clean(row.get("productType")) or "Ukategoriseret"
        category_id = get_or_create_id(cur, "categories", category_name)

        dietary_tags = {k: v for k, v in (row.get("dietaryTags") or {}).items() if v}
        allergens = split_list(row.get("allergens"))
        additives = split_list(row.get("additives"))

        nutrition_extra = {}
        if nutrition.get("fibre") is not None:
            nutrition_extra["fiberPer100g"] = nutrition["fibre"]
        if nutrition.get("salt") is not None:
            nutrition_extra["saltPer100g"] = nutrition["salt"]
        if nutrition.get("saturatedFat") is not None:
            nutrition_extra["saturatedFatPer100gLegacy"] = nutrition["saturatedFat"]
        if nutrition.get("sugars") is not None:
            nutrition_extra["sugarPer100g"] = nutrition["sugars"]

        params = {
            "name": title,
            "brandId": brand_id,
            "categoryId": category_id,
            "kcal": kcal,
            "protein": protein,
            "carbs": carbs,
            "fat": fat,
            "satFat": nutrition.get("saturatedFat"),
            "ingredients": clean(row.get("ingredients")),
            "allergens": allergens,
            "additives": additives,
            "externalId": product_key,
            "subbrand": clean(row.get("subbrand")),
            "variant": clean(row.get("variant")),
            "packageSize": clean(row.get("quantity")),
            "productCategory": PRODUCT_CATEGORY_BY_TYPE.get((clean(row.get("type")) or "").lower()),
            "dietaryTags": psycopg2.extras.Json(dietary_tags) if dietary_tags else None,
            "nutritionExtra": psycopg2.extras.Json(nutrition_extra) if nutrition_extra else None,
        }

        # No unique constraint on (externalSource, externalId) -- same
        # select-then-insert/update pattern as frida-agent/hellofresh-agent.
        cur.execute(
            """SELECT id FROM "products" WHERE "externalSource" = 'REMA1000' AND "externalId" = %(externalId)s""",
            params,
        )
        existing = cur.fetchone()
        if existing:
            product_id = existing[0]
            params["id"] = product_id
            cur.execute(
                """
                UPDATE "products" SET
                    name = %(name)s,
                    "brandId" = %(brandId)s,
                    "categoryId" = %(categoryId)s,
                    "kcalPer100g" = %(kcal)s,
                    "proteinPer100g" = %(protein)s,
                    "carbsPer100g" = %(carbs)s,
                    "fatPer100g" = %(fat)s,
                    "saturatedFatPer100g" = %(satFat)s,
                    "ingredientsText" = %(ingredients)s,
                    allergens = %(allergens)s,
                    additives = %(additives)s,
                    subbrand = %(subbrand)s,
                    variant = %(variant)s,
                    "packageSizeText" = %(packageSize)s,
                    "productCategory" = %(productCategory)s::"ProductCategory",
                    "dietaryTags" = %(dietaryTags)s,
                    "nutritionExtra" = %(nutritionExtra)s,
                    "sourceCheckedAt" = now()
                WHERE id = %(id)s
                """,
                params,
            )
        else:
            import uuid

            product_id = f"c{uuid.uuid4().hex[:24]}"
            params["id"] = product_id
            cur.execute(
                """
                INSERT INTO "products" (
                    id, name, "brandId", "categoryId", "kcalPer100g", "proteinPer100g",
                    "carbsPer100g", "fatPer100g", "saturatedFatPer100g", "ingredientsText",
                    allergens, additives, "externalSource", "externalId", "sourceCheckedAt",
                    status, subbrand, variant, "packageSizeText", "productCategory", "dietaryTags",
                    "nutritionExtra", "createdAt"
                ) VALUES (
                    %(id)s, %(name)s, %(brandId)s, %(categoryId)s, %(kcal)s, %(protein)s,
                    %(carbs)s, %(fat)s, %(satFat)s, %(ingredients)s,
                    %(allergens)s, %(additives)s, 'REMA1000', %(externalId)s, now(),
                    'APPROVED', %(subbrand)s, %(variant)s, %(packageSize)s,
                    %(productCategory)s::"ProductCategory", %(dietaryTags)s,
                    %(nutritionExtra)s, now()
                )
                """,
                params,
            )

        ean = clean(str(row["ean"])) if row.get("ean") is not None else None
        if ean:
            cur.execute(
                """
                INSERT INTO "barcodes" (code, "productId")
                VALUES (%s, %s)
                ON CONFLICT (code) DO NOTHING
                """,
                (ean, product_id),
            )

        cur.execute(
            """
            INSERT INTO "product_stores" ("productId", "storeId")
            VALUES (%s, %s)
            ON CONFLICT ("productId", "storeId") DO NOTHING
            """,
            (product_id, store_id),
        )

        imported += 1

    conn.commit()
    log.info("Imported/updated %d products under store %r", imported, STORE_NAME)
    if skipped_no_nutrition:
        log.warning(
            "Skipped %d products with no matched nutrition data (needs manual entry): %s",
            len(skipped_no_nutrition),
            ", ".join(skipped_no_nutrition[:50]),
        )
    if skipped_no_title:
        log.warning("Skipped %d products with no title: %s", len(skipped_no_title), skipped_no_title)

    cur.close()
    conn.close()


if __name__ == "__main__":
    run()
