"""
HELLO CAL store-products-agent (Bilka + REMA 1000).

Imports data/store_products.json, built locally from the hand-cleaned store
sheets by build_data.py, into the three product tables (docs/DECISIONS.md
2026-09-27 "Butiksvarer i tre tabeller"):

1. products (+ barcodes, product_stores, categories, brands, product_images)
2. product_nutrition_features (macros/micros per 100 g/ml)
3. product_filters (one text column per filter: "Økologisk", "Kylling" …)

One product per EAN: an existing product with the same barcode is updated
(e.g. the REMA 1000 product rema1000-agent created) instead of duplicated.
Bilka wins over REMA already in the JSON. Images are copied to
/images/store/ (the app's /product-images volume) and used as-is — only
cut-outs are tagged "Cutout" so the product circle can let them break out.

rema1000-agent rewrites its rows on every container start, so this agent
waits START_DELAY_SECONDS first and runs after it.
"""

import json
import logging
import os
import shutil
import time
import uuid

import psycopg2
import psycopg2.extras

from job_control import run_forever

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("store-products-agent")

DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
DATA_DIR = os.environ.get("STORE_PRODUCTS_DATA_DIR", "/app/data")
IMAGE_OUTPUT_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/product-images")
START_DELAY_SECONDS = int(os.environ.get("START_DELAY_SECONDS", "180"))
IMAGE_SUBDIR = "store"

NUTRITION_COLUMNS = {
    "sugars": "sugarsPer100g",
    "fiber": "fiberPer100g",
    "salt": "saltPer100g",
    "energyKj": "energyKjPer100g",
    "monounsaturatedFat": "monounsaturatedFatPer100g",
    "polyunsaturatedFat": "polyunsaturatedFatPer100g",
    "sodium": "sodiumPer100g",
    "alcohol": "alcoholPer100g",
    "vitaminB2": "vitaminB2MgPer100g",
    "vitaminB12": "vitaminB12UgPer100g",
    "calcium": "calciumMgPer100g",
    "phosphorus": "phosphorusMgPer100g",
}
SOURCE_COLUMNS = {"sugars": "sugarSource", "fiber": "fiberSource", "salt": "saltSource"}

FILTER_COLUMNS = [
    "organic", "glutenFree", "lactoseFree", "sugarFree", "sweeteners", "vegan", "vegetarian", "meatType",
    "alcohol", "alcoholPercent", "fatPercent", "countryOfOrigin", "wholeGrain", "keyhole", "animalWelfare",
    "certifications", "storage", "size", "toxins",
]


def new_id():
    return f"c{uuid.uuid4().hex[:24]}"


def get_or_create_id(cur, table, name):
    cur.execute(f'SELECT id FROM "{table}" WHERE name = %s', (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    row_id = new_id()
    cur.execute(f'INSERT INTO "{table}" (id, name) VALUES (%s, %s)', (row_id, name))
    return row_id


def copy_image(filename):
    src = os.path.join(DATA_DIR, "images", filename)
    if not os.path.isfile(src):
        return None
    target_dir = os.path.join(IMAGE_OUTPUT_DIR, IMAGE_SUBDIR)
    os.makedirs(target_dir, exist_ok=True)
    shutil.copyfile(src, os.path.join(target_dir, filename))
    return f"{PUBLIC_PATH_PREFIX}/{IMAGE_SUBDIR}/{filename}"


def upsert_product(cur, p, store_ids):
    n = p["nutrition"]
    brand_id = get_or_create_id(cur, "brands", p["brand"]) if p.get("brand") else None
    category_name = p.get("storeDepartment") or p.get("productType") or "Ukategoriseret"
    category_id = get_or_create_id(cur, "categories", category_name)
    image_url = copy_image(p["image"]) if p.get("image") else None

    params = {
        "name": p["name"],
        "brandId": brand_id,
        "categoryId": category_id,
        "kcal": n["kcal"],
        "protein": n["protein"],
        "carbs": n["carbs"],
        "fat": n["fat"],
        "satFat": n.get("saturatedFat"),
        "ingredients": p.get("ingredients"),
        "allergens": p.get("allergens") or [],
        "additives": p.get("additives") or [],
        "subbrand": p.get("subbrand"),
        "variant": p.get("variant"),
        "flavor": p.get("flavor"),
        "packCount": p.get("packCount"),
        "keywords": p.get("keywords") or [],
        "packageSize": p.get("quantity"),
        "productType": p.get("productType"),
        "productCategory": p.get("productCategory"),
        "imageUrl": image_url,
        "externalSource": p["externalSource"],
        "externalId": p["ean"],
    }

    cur.execute('SELECT "productId" FROM "barcodes" WHERE code = %s', (p["ean"],))
    row = cur.fetchone()
    if row is None:
        cur.execute(
            """SELECT id FROM "products" WHERE "externalSource" = %(externalSource)s::"ExternalProductSource"
               AND "externalId" = %(externalId)s""",
            params,
        )
        row = cur.fetchone()

    if row:
        product_id = row[0]
        params["id"] = product_id
        cur.execute(
            """
            UPDATE "products" SET
                name = %(name)s, "brandId" = %(brandId)s, "categoryId" = %(categoryId)s,
                "kcalPer100g" = %(kcal)s, "proteinPer100g" = %(protein)s, "carbsPer100g" = %(carbs)s,
                "fatPer100g" = %(fat)s, "saturatedFatPer100g" = %(satFat)s,
                "ingredientsText" = %(ingredients)s, allergens = %(allergens)s, additives = %(additives)s,
                subbrand = %(subbrand)s, variant = %(variant)s, flavor = %(flavor)s,
                "packCount" = %(packCount)s, keywords = %(keywords)s, "packageSizeText" = %(packageSize)s,
                "productType" = %(productType)s,
                "productCategory" = %(productCategory)s::"ProductCategory",
                "imageUrl" = COALESCE(%(imageUrl)s, "imageUrl"),
                "imageStatus" = CASE WHEN %(imageUrl)s IS NULL THEN "imageStatus" ELSE 'APPROVED'::"ImageStatus" END,
                "sourceCheckedAt" = now()
            WHERE id = %(id)s
            """,
            params,
        )
    else:
        product_id = new_id()
        params["id"] = product_id
        cur.execute(
            """
            INSERT INTO "products" (
                id, name, "brandId", "categoryId", "kcalPer100g", "proteinPer100g", "carbsPer100g",
                "fatPer100g", "saturatedFatPer100g", "ingredientsText", allergens, additives,
                "externalSource", "externalId", "sourceCheckedAt", status, subbrand, variant, flavor,
                "packCount", keywords, "packageSizeText", "productType", "productCategory",
                "imageUrl", "imageStatus", "createdAt"
            ) VALUES (
                %(id)s, %(name)s, %(brandId)s, %(categoryId)s, %(kcal)s, %(protein)s, %(carbs)s,
                %(fat)s, %(satFat)s, %(ingredients)s, %(allergens)s, %(additives)s,
                %(externalSource)s::"ExternalProductSource", %(externalId)s, now(), 'APPROVED',
                %(subbrand)s, %(variant)s, %(flavor)s, %(packCount)s, %(keywords)s, %(packageSize)s,
                %(productType)s, %(productCategory)s::"ProductCategory", %(imageUrl)s,
                CASE WHEN %(imageUrl)s IS NULL THEN 'NONE'::"ImageStatus" ELSE 'APPROVED'::"ImageStatus" END,
                now()
            )
            """,
            params,
        )

    cur.execute(
        'INSERT INTO "barcodes" (code, "productId") VALUES (%s, %s) ON CONFLICT (code) DO NOTHING',
        (p["ean"], product_id),
    )
    for store in p["stores"]:
        cur.execute(
            """INSERT INTO "product_stores" ("productId", "storeId") VALUES (%s, %s)
               ON CONFLICT ("productId", "storeId") DO NOTHING""",
            (product_id, store_ids[store]),
        )

    if image_url:
        cur.execute('DELETE FROM "product_images" WHERE "productId" = %s AND url = %s', (product_id, image_url))
        cur.execute(
            """INSERT INTO "product_images" (id, "productId", url, tags, "order", "createdAt")
               VALUES (%s, %s, %s, %s, 0, now())""",
            (new_id(), product_id, image_url, p.get("imageTags") or []),
        )

    upsert_nutrition(cur, product_id, p.get("productCategory"), n)
    upsert_filters(cur, product_id, p["filters"])
    return product_id


def upsert_nutrition(cur, product_id, category, n):
    values = {col: n.get(key) for key, col in NUTRITION_COLUMNS.items()}
    sources = {col: ("MANUFACTURER" if n.get(key) is not None else None) for key, col in SOURCE_COLUMNS.items()}
    basis = "100ml" if category == "DRINK" else "100g"
    cols = list(values) + list(sources)
    data = {**values, **sources}
    # Missing values keep what is already there (e.g. derived by the app).
    set_sql = ", ".join(f'"{c}" = COALESCE(EXCLUDED."{c}", "product_nutrition_features"."{c}")' for c in cols)
    insert_vals = ", ".join(f'%({c})s::"ProductFeatureSource"' if c in sources else f"%({c})s" for c in cols)
    cur.execute(
        f"""
        INSERT INTO "product_nutrition_features" (id, "productId", basis, {", ".join(f'"{c}"' for c in cols)}, "createdAt", "updatedAt")
        VALUES (%(id)s, %(productId)s, %(basis)s, {insert_vals}, now(), now())
        ON CONFLICT ("productId") DO UPDATE SET basis = %(basis)s, {set_sql}, "updatedAt" = now()
        """,
        {**data, "id": new_id(), "productId": product_id, "basis": basis},
    )


def upsert_filters(cur, product_id, f):
    data = {c: f.get(c) for c in FILTER_COLUMNS}
    for c in ("animalWelfare", "certifications", "toxins"):
        data[c] = data[c] or []
    cols = ", ".join(f'"{c}"' for c in FILTER_COLUMNS)
    vals = ", ".join(f"%({c})s" for c in FILTER_COLUMNS)
    sets = ", ".join(f'"{c}" = %({c})s' for c in FILTER_COLUMNS)
    cur.execute(
        f"""
        INSERT INTO "product_filters" (id, "productId", {cols}, "createdAt", "updatedAt")
        VALUES (%(id)s, %(productId)s, {vals}, now(), now())
        ON CONFLICT ("productId") DO UPDATE SET {sets}, "updatedAt" = now()
        """,
        {**data, "id": new_id(), "productId": product_id},
    )


def run(conn):
    with open(os.path.join(DATA_DIR, "store_products.json"), "r", encoding="utf-8") as f:
        products = json.load(f)
    cur = conn.cursor()
    store_ids = {name: get_or_create_id(cur, "stores", name) for name in ("Bilka", "Rema 1000")}
    imported = 0
    for p in products:
        cur.execute("SAVEPOINT product")
        try:
            upsert_product(cur, p, store_ids)
            cur.execute("RELEASE SAVEPOINT product")
            imported += 1
        except Exception:  # noqa: BLE001 - one bad row must not stop the batch
            cur.execute("ROLLBACK TO SAVEPOINT product")
            log.exception("failed to import EAN %s", p.get("ean"))
    conn.commit()
    cur.close()
    message = f"Imported/updated {imported} of {len(products)} store products"
    log.info(message)
    return message


if __name__ == "__main__":
    time.sleep(START_DELAY_SECONDS)
    run_forever(DATABASE_URL, "store-products-import", run, run_on_start=True)
