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
All image variants and, for products in both chains, each store's own
fields (product_source_records) are stored for admin "Dubletter"; what admin
has reviewed there is not overwritten (docs/DECISIONS.md 2026-09-28).

Products the sheets have no kcal for are imported too (docs/DECISIONS.md
2026-10-02): "nutritionMissing", 0 as placeholder. Since 2026-10-10 they are
shown and get their barcode row like every other product; the app robot
"frida-estimates" fills the missing fields from Frida (∼). A product that already has nutrition
from elsewhere keeps it. Rows without an EAN are keyed by "externalId".

Rows deleted from other store sheets as EAN duplicates keep their chain:
data/store_links.json adds it to the winner's product_stores every run.

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
# The full catalogue (JSON + images) is copied to the NAS volume /import;
# the small sample baked into the image is only used when that is empty.
IMPORT_DIR = os.environ.get("STORE_PRODUCTS_IMPORT_DIR", "/import")
# Baked into the image (git); store_links.json is always read from here.
BAKED_DATA_DIR = os.environ.get("STORE_PRODUCTS_DATA_DIR", "/app/data")
DATA_DIR = IMPORT_DIR if os.path.isfile(os.path.join(IMPORT_DIR, "store_products.json")) else BAKED_DATA_DIR
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

# Hello Cals kategoritræ (docs/DECISIONS.md 2026-09-28): hovedkategori →
# underkategorier, i visningsrækkefølge. build_data.py placerer varerne.
CATEGORY_TREE = [
    ("Drikkevarer", ["Sodavand", "Smoothies"]),
    ("Alkohol", []),
    ("Mejeri og æg", []),
    ("Kød", ["Rå kød", "Tilberedt kød"]),
    ("Fisk og skaldyr", ["Rå fisk", "Tilberedt fisk"]),
    ("Grøntsager og rodfrugter", ["Rå grøntsager", "Tilberedte grøntsager"]),
    ("Frugt", []),
    ("Brød og bagværk", []),
    ("Kolonial og tørvarer", []),
    ("Færdigretter", []),
    ("Forarbejdet", []),
    ("Slik", []),
    ("Chips", []),
]

FILTER_COLUMNS = [
    "organic", "glutenFree", "lactoseFree", "sugarFree", "lowSugar", "noAddedSugar", "reducedSugar", "lightSugar",
    "sweeteners", "vegan", "vegetarian", "meatType",
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


def ensure_category_tree(cur):
    """Opretter/opdaterer træet og returnerer {navn: id}."""
    ids = {}
    for order, (main, subs) in enumerate(CATEGORY_TREE, start=1):
        main_id = get_or_create_id(cur, "categories", main)
        cur.execute('UPDATE "categories" SET "parentId" = NULL, "sortOrder" = %s WHERE id = %s', (order * 10, main_id))
        ids[main] = main_id
        for sub_order, sub in enumerate(subs, start=1):
            sub_id = get_or_create_id(cur, "categories", sub)
            cur.execute(
                'UPDATE "categories" SET "parentId" = %s, "sortOrder" = %s WHERE id = %s', (main_id, sub_order, sub_id)
            )
            ids[sub] = sub_id
    return ids


def copy_image(filename):
    src = os.path.join(DATA_DIR, "images", filename)
    if not os.path.isfile(src):
        return None
    target_dir = os.path.join(IMAGE_OUTPUT_DIR, IMAGE_SUBDIR)
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, filename)
    # Skip unchanged files, so a restart does not copy GBs of images again.
    if not (os.path.isfile(target) and os.path.getsize(target) == os.path.getsize(src)):
        shutil.copyfile(src, target)
    return f"{PUBLIC_PATH_PREFIX}/{IMAGE_SUBDIR}/{filename}"


MACRO_COLUMNS = {"kcal": "kcalPer100g", "protein": "proteinPer100g", "carbs": "carbsPer100g", "fat": "fatPer100g"}
# Paths in product_source_records.data whose change does not send a reviewed
# product back to admin (upsert_sources).
IGNORED_IN_REVIEW = (
    "nutrition,energyKj", "filters,lowSugar", "filters,noAddedSugar", "filters,reducedSugar", "filters,lightSugar",
)


def external_id(p):
    # The sample baked into the image predates "externalId" (= the EAN).
    return p.get("externalId") or p["ean"]


def find_product(cur, p):
    """By barcode first — the product may have been created by a user, Open
    Food Facts or rema1000-agent — then by the store's own key."""
    row = None
    if p.get("ean"):
        cur.execute('SELECT "productId" FROM "barcodes" WHERE code = %s', (p["ean"],))
        row = cur.fetchone()
        if row:
            drop_hidden_twin(cur, p, row[0])
    if row is None:
        cur.execute(
            """SELECT id FROM "products" WHERE "externalSource" = %s::"ExternalProductSource"
               AND "externalId" = %s ORDER BY "nutritionMissing", "createdAt" LIMIT 1""",
            (p["externalSource"], external_id(p)),
        )
        row = cur.fetchone()
    return row[0] if row else None


def drop_hidden_twin(cur, p, product_id):
    """A product without nutrition had no barcode row before 2026-10-10, so the
    same barcode may have been created since (a user's scan, Open Food Facts).
    That product is the one updated from now on; the copy without nutrition goes."""
    cur.execute("SAVEPOINT twin")
    try:
        cur.execute(
            """DELETE FROM "products" WHERE "nutritionMissing" AND id <> %s
               AND "externalSource" = %s::"ExternalProductSource" AND "externalId" = %s""",
            (product_id, p["externalSource"], external_id(p)),
        )
        cur.execute("RELEASE SAVEPOINT twin")
    except psycopg2.Error:
        cur.execute("ROLLBACK TO SAVEPOINT twin")
        log.exception("could not remove the hidden copy of %s", external_id(p))


def review_state(cur, product_id):
    """What admin already decided under "Dubletter" (docs/DECISIONS.md
    2026-09-28): reviewed images and reviewed store data are never overwritten."""
    if product_id is None:
        return False, False
    cur.execute('SELECT "imagesReviewedAt" IS NOT NULL FROM "products" WHERE id = %s', (product_id,))
    images_reviewed = bool(cur.fetchone()[0])
    cur.execute(
        'SELECT count(*) > 0 FROM "product_source_records" WHERE "productId" = %s AND "reviewedAt" IS NOT NULL',
        (product_id,),
    )
    return images_reviewed, bool(cur.fetchone()[0])


def image_list(p):
    if p.get("images"):
        return p["images"]
    return [{"file": p["image"], "tags": p.get("imageTags") or []}] if p.get("image") else []


def upsert_product(cur, p, store_ids, category_ids):
    existing_id = find_product(cur, p)
    images_reviewed, fields_reviewed = review_state(cur, existing_id)

    n = p["nutrition"]
    # No kcal in the sheets: nothing here may be read as the product's
    # nutrition. Macros the sheets lack beside a kcal are 0 and estimated (~).
    missing = bool(p.get("nutritionMissing"))
    estimated = p.get("estimatedMacros") or []
    micros = p.get("micronutrients") or {}
    brand_id = get_or_create_id(cur, "brands", p["brand"]) if p.get("brand") else None
    category_id = category_ids.get(p.get("subcategory") or "") or category_ids.get(p.get("category") or "")
    images = []
    if not images_reviewed:
        for img in image_list(p):
            url = copy_image(img["file"])
            if url:
                images.append((url, img.get("tags") or []))
    image_url = images[0][0] if images else None

    params = {
        "name": p["name"],
        "brandId": brand_id,
        "categoryId": category_id,
        "kcal": n.get("kcal") or 0,
        "protein": n.get("protein") or 0,
        "carbs": n.get("carbs") or 0,
        "fat": n.get("fat") or 0,
        "satFat": n.get("saturatedFat"),
        "nutritionMissing": missing,
        # Product.micronutrientsPer100g / nutrientSources (src/lib/nutrients.ts):
        # label vitamins are producer data, a macro the sheets lack is a guess.
        "micros": psycopg2.extras.Json(micros),
        "microSources": psycopg2.extras.Json({k: "LABEL" for k in micros}),
        "estimatedSources": psycopg2.extras.Json({k: "ESTIMATED" for k in estimated}),
        "ingredients": p.get("ingredients"),
        "storeDescription": p.get("storeDescription"),
        "allergens": p.get("allergens") or [],
        "additives": p.get("additives") or [],
        "subbrand": p.get("subbrand"),
        "variant": p.get("variant"),
        "flavor": p.get("flavor"),
        "packCount": p.get("packCount"),
        "packaging": p.get("packaging"),
        "keywords": p.get("keywords") or [],
        "packageSize": p.get("quantity"),
        "productType": p.get("productType"),
        "productCategory": p.get("productCategory"),
        "imageUrl": image_url,
        "externalSource": p["externalSource"],
        "externalId": external_id(p),
    }

    if existing_id and fields_reviewed:
        # Admin chose the final values field by field — keep them.
        product_id = existing_id
        cur.execute(
            'UPDATE "products" SET "imageUrl" = %s WHERE id = %s AND "imageUrl" IS NULL',
            (image_url, product_id),
        )
        cur.execute(
            'UPDATE "products" SET "storeDescription" = %s WHERE id = %s',
            (params["storeDescription"], product_id),
        )
    elif existing_id:
        product_id = existing_id
        params["id"] = product_id
        # The product keeps the nutrition it has where the sheets know nothing:
        # all of it without a kcal, else the macros that would only be guessed.
        # What the sheets do know is producer data (no "estimated" mark).
        nutrition_sql = ""
        if not missing:
            params["known"] = [k for k in MACRO_COLUMNS if k not in estimated]
            nutrition_sql = "".join(f'"{MACRO_COLUMNS[k]}" = %({k})s, ' for k in params["known"]) + """
                "saturatedFatPer100g" = %(satFat)s, "nutritionMissing" = false,
                "nutrientSources" = NULLIF((COALESCE("nutrientSources", '{}'::jsonb) - %(known)s::text[]) || %(microSources)s::jsonb, '{}'::jsonb),
                "micronutrientsPer100g" = NULLIF(COALESCE("micronutrientsPer100g", '{}'::jsonb) || %(micros)s::jsonb, '{}'::jsonb),
                """
        cur.execute(
            f"""
            UPDATE "products" SET
                name = %(name)s, "brandId" = %(brandId)s, "categoryId" = %(categoryId)s,
                {nutrition_sql}
                "ingredientsText" = %(ingredients)s, "storeDescription" = %(storeDescription)s,
                allergens = %(allergens)s, additives = %(additives)s,
                subbrand = %(subbrand)s, variant = %(variant)s, flavor = %(flavor)s,
                "packCount" = %(packCount)s, packaging = %(packaging)s, keywords = %(keywords)s, "packageSizeText" = %(packageSize)s,
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
                "fatPer100g", "saturatedFatPer100g", "nutritionMissing", "nutrientSources",
                "micronutrientsPer100g", "ingredientsText", "storeDescription", allergens, additives,
                "externalSource", "externalId", "sourceCheckedAt", status, subbrand, variant, flavor,
                "packCount", packaging, keywords, "packageSizeText", "productType", "productCategory",
                "imageUrl", "imageStatus", "createdAt"
            ) VALUES (
                %(id)s, %(name)s, %(brandId)s, %(categoryId)s, %(kcal)s, %(protein)s, %(carbs)s,
                %(fat)s, %(satFat)s, %(nutritionMissing)s,
                NULLIF(%(estimatedSources)s::jsonb || %(microSources)s::jsonb, '{}'::jsonb),
                NULLIF(%(micros)s::jsonb, '{}'::jsonb), %(ingredients)s, %(storeDescription)s, %(allergens)s, %(additives)s,
                %(externalSource)s::"ExternalProductSource", %(externalId)s, now(), 'APPROVED',
                %(subbrand)s, %(variant)s, %(flavor)s, %(packCount)s, %(packaging)s, %(keywords)s, %(packageSize)s,
                %(productType)s, %(productCategory)s::"ProductCategory", %(imageUrl)s,
                CASE WHEN %(imageUrl)s IS NULL THEN 'NONE'::"ImageStatus" ELSE 'APPROVED'::"ImageStatus" END,
                now()
            )
            """,
            params,
        )

    # Skivevægt fra butikkernes tekster ("10 skiver", "18 g pr. skive") — kun
    # hvis varen ikke allerede har en portionsstørrelse (docs/DECISIONS.md
    # 2026-09-28).
    if p.get("sliceWeightGrams"):
        cur.execute(
            """UPDATE "products" SET "servingSizeGrams" = %s,
                   "servingSizeUnitSingular" = 'skive', "servingSizeUnitPlural" = 'skiver'
               WHERE id = %s AND "servingSizeGrams" IS NULL""",
            (p["sliceWeightGrams"], product_id),
        )
    # Every product gets its barcode, also without nutrition (owner's rule
    # 2026-10-10: products are shown whether or not they have nutrition). It
    # then shows Frida's estimate (∼) or "Næringsindhold ukendt" plus the
    # 20-point update banner.
    if p.get("ean"):
        cur.execute(
            """INSERT INTO "barcodes" (code, "productId") VALUES (%s, %s)
               ON CONFLICT (code) DO NOTHING""",
            (p["ean"], product_id),
        )
    for store in p["stores"]:
        cur.execute(
            """INSERT INTO "product_stores" ("productId", "storeId") VALUES (%s, %s)
               ON CONFLICT ("productId", "storeId") DO NOTHING""",
            (product_id, store_ids[store]),
        )

    # All variants (EAN, EAN_2 …) tagged "Import": two or more show up under
    # admin "Dubletter" → Produktbilleder until admin has picked.
    if images:
        cur.execute(
            'DELETE FROM "product_images" WHERE "productId" = %s AND url = ANY(%s)',
            (product_id, [url for url, _ in images]),
        )
        for order, (url, tags) in enumerate(images):
            cur.execute(
                """INSERT INTO "product_images" (id, "productId", url, tags, "order", "createdAt")
                   VALUES (%s, %s, %s, %s, %s, now())""",
                (new_id(), product_id, url, list(dict.fromkeys([*tags, "Import"])), order),
            )

    if not fields_reviewed:
        upsert_nutrition(cur, product_id, p.get("productCategory"), n)
        upsert_filters(cur, product_id, p["filters"])
    upsert_sources(cur, product_id, p.get("sources") or {})
    return product_id


def upsert_sources(cur, product_id, sources):
    """Each store's own version (Bilka + REMA 1000 with the same EAN). Changed
    store data is shown to admin again; unchanged keeps its review. Not a
    change: kJ (the 1.105 → 1105 repair), the sugar claims derived from the
    other fields, and keys without a value."""
    ignored = "".join(f" #- '{{{path}}}'" for path in IGNORED_IN_REVIEW)
    old, new = (f"jsonb_strip_nulls({side}.data{ignored})" for side in ('"product_source_records"', "EXCLUDED"))
    for source, data in sources.items():
        cur.execute(
            f"""
            INSERT INTO "product_source_records" (id, "productId", source, data, "createdAt", "updatedAt")
            VALUES (%s, %s, %s::"ExternalProductSource", %s, now(), now())
            ON CONFLICT ("productId", source) DO UPDATE SET
                "reviewedAt" = CASE WHEN {old} = {new}
                                    THEN "product_source_records"."reviewedAt" ELSE NULL END,
                data = EXCLUDED.data,
                "updatedAt" = now()
            """,
            (new_id(), product_id, source, psycopg2.extras.Json(data)),
        )


def upsert_nutrition(cur, product_id, category, n):
    values = {col: n.get(key) for key, col in NUTRITION_COLUMNS.items()}
    sources = {col: ("MANUFACTURER" if n.get(key) is not None else None) for key, col in SOURCE_COLUMNS.items()}
    basis = "100ml" if category == "DRINK" else "100g"
    cols = list(values) + list(sources)
    data = {**values, **sources}
    # Missing values keep what is already there (e.g. derived by the app) —
    # except kJ, which only this import writes: a dropped kJ must go.
    set_sql = ", ".join(
        f'"{c}" = EXCLUDED."{c}"' if c == "energyKjPer100g" else f'"{c}" = COALESCE(EXCLUDED."{c}", "product_nutrition_features"."{c}")'
        for c in cols
    )
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


def apply_store_links(cur):
    """Kæder for sheet rows deleted as EAN duplicates (docs/DECISIONS.md
    2026-10-08 "Slettede gengangere beholder kæden"): the winning product gets
    the losing row's chain in product_stores. Links whose product is not in
    the database yet (SPAR/German sheets) are applied on a later run."""
    path = os.path.join(BAKED_DATA_DIR, "store_links.json")
    if not os.path.isfile(path):
        return 0, 0
    with open(path, "r", encoding="utf-8") as f:
        links = json.load(f)
    store_ids = {}
    linked = waiting = 0
    for link in links:
        ean = link["ean"]
        codes = list(dict.fromkeys([ean, ean.lstrip("0"), ean.zfill(13)]))
        cur.execute(
            """SELECT "productId" FROM "barcodes" WHERE code = ANY(%s)
               UNION SELECT id FROM "products" WHERE "externalId" = ANY(%s)""",
            (codes, codes),
        )
        product_ids = [row[0] for row in cur.fetchall()]
        if not product_ids:
            waiting += 1
            continue
        for store in link["stores"]:
            if store not in store_ids:
                store_ids[store] = get_or_create_id(cur, "stores", store)
            for product_id in product_ids:
                cur.execute(
                    """INSERT INTO "product_stores" ("productId", "storeId") VALUES (%s, %s)
                       ON CONFLICT ("productId", "storeId") DO NOTHING""",
                    (product_id, store_ids[store]),
                )
                linked += cur.rowcount
    return linked, waiting


def request_frida_estimates(conn):
    """Beder app-robotten "frida-estimates" om en kørsel lige efter importen
    (docs/DECISIONS.md 2026-10-10): varer uden energimærkning får Frida-skøn."""
    with conn.cursor() as cur:
        cur.execute("""UPDATE "scheduled_jobs" SET "runRequestedAt" = now() WHERE key = 'frida-estimates'""")
    conn.commit()


def run(conn):
    with open(os.path.join(DATA_DIR, "store_products.json"), "r", encoding="utf-8") as f:
        products = json.load(f)
    cur = conn.cursor()
    store_ids = {name: get_or_create_id(cur, "stores", name) for name in ("Bilka", "Rema 1000")}
    category_ids = ensure_category_tree(cur)
    imported = 0
    for p in products:
        cur.execute("SAVEPOINT product")
        try:
            upsert_product(cur, p, store_ids, category_ids)
            cur.execute("RELEASE SAVEPOINT product")
            imported += 1
        except Exception:  # noqa: BLE001 - one bad row must not stop the batch
            cur.execute("ROLLBACK TO SAVEPOINT product")
            log.exception("failed to import %s", p.get("externalId") or p.get("ean"))
    # Products admin has reviewed keep their values, but a kJ that is still
    # the sheet's thousands format (1.105 beside 264 kcal) is no choice.
    cur.execute(
        """UPDATE "product_nutrition_features" f SET "energyKjPer100g" = round((f."energyKjPer100g" * 1000)::numeric)
           FROM "products" p WHERE p.id = f."productId" AND f."energyKjPer100g" < 10 AND p."kcalPer100g" > 10"""
    )
    cur.execute(
        """SELECT count(*) FROM "products" WHERE "nutritionMissing"
           AND "externalSource" IN ('BILKA'::"ExternalProductSource", 'REMA1000'::"ExternalProductSource")"""
    )
    without_nutrition = cur.fetchone()[0]
    linked, waiting = apply_store_links(cur)
    conn.commit()
    cur.close()
    message = (
        f"{imported} af {len(products)} butiksvarer importeret/opdateret ({without_nutrition} uden næring endnu, Frida-skøn følger); "
        f"{linked} kædekoblinger fra slettede gengangere ({waiting} stregkoder venter på varen)"
    )
    log.info(message)
    request_frida_estimates(conn)
    # (besked, antal udført) til admin "Robotter"/"Nattens kørsler".
    return message, imported


if __name__ == "__main__":
    time.sleep(START_DELAY_SECONDS)
    run_forever(DATABASE_URL, "store-products-import", run, run_on_start=True)
