"""Udfylder skivevægt fra Open Food Facts (docs/DECISIONS.md 2026-09-28).

Finder skivevarer (pålæg, skiveost, brød i skiver …) og slår dem op i Open Food
Facts. Har OFF en portion (serving_quantity), gemmes den som
Product.servingSizeGrams med enheden "skive"/"skiver", så mængdevælgeren tæller
i skiver. Eksisterende værdier overskrives aldrig.

Skivevarer = produkter med "skive" i navn/produkttype/nøgleord i databasen
plus stregkoder, REMA-dataene markerer "i Skiver" (REMA-importen gemmer ikke
det nøgleord på varen).

Kør (dry run er standard; --apply skriver):
    DATABASE_URL=postgres://... python3 fill_slice_weights.py [--apply]
Kræver netadgang til world.openfoodfacts.org.
"""

import json
import os
import re
import sys
import time
from pathlib import Path

import psycopg2
import requests

REMA_DATA = Path(__file__).resolve().parents[1] / "rema1000-import" / "data" / "rema1000_products.json"
OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{}.json?fields=code,product_name,serving_size,serving_quantity,serving_quantity_unit"
HEADERS = {"User-Agent": "HelloCal/1.0 (slice weights)"}
SLICE = re.compile(r"skive", re.I)
# Skiver i konserves, chips o.l. er ikke portioner.
EXCLUDE = re.compile(r"konserves|chips|æbleskive", re.I)


def rema_sliced_barcodes() -> set[str]:
    if not REMA_DATA.exists():
        return set()
    out = set()
    for row in json.loads(REMA_DATA.read_text(encoding="utf-8")):
        text = " ".join(str(row.get(k) or "") for k in ("helloCalTitle", "productType", "keyword1", "packaging"))
        if SLICE.search(text) and not EXCLUDE.search(text) and row.get("ean"):
            out.add(str(row["ean"]))
    return out


def off_serving(barcode: str) -> tuple[float, str] | None:
    res = requests.get(OFF_URL.format(barcode), headers=HEADERS, timeout=20)
    if res.status_code != 200:
        return None
    product = res.json().get("product") or {}
    unit = str(product.get("serving_quantity_unit") or "g").lower()
    try:
        grams = float(product.get("serving_quantity"))
    except (TypeError, ValueError):
        return None
    if unit != "g" or not 1 <= grams <= 60:  # en skive vejer ikke over 60 g
        return None
    return grams, str(product.get("serving_size") or "")


def main() -> None:
    apply = "--apply" in sys.argv
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    rema = rema_sliced_barcodes()
    with conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.id, p.name, b.code
            FROM products p JOIN barcodes b ON b."productId" = p.id
            WHERE p."servingSizeGrams" IS NULL
              AND (b.code = ANY(%s)
                   OR p.name ILIKE '%%skive%%' OR p."productType" ILIKE '%%skive%%'
                   OR EXISTS (SELECT 1 FROM unnest(p.keywords) k WHERE k ILIKE '%%skive%%'))
            """,
            (list(rema),),
        )
        rows = [r for r in cur.fetchall() if not EXCLUDE.search(r[1] or "")]
        print(f"{len(rows)} skivevarer uden skivevægt")
        found = missing = 0
        seen = set()
        for product_id, name, code in rows:
            if product_id in seen:
                continue
            serving = off_serving(code)
            time.sleep(0.7)  # OFF beder om max ~100 opslag/min
            if not serving:
                missing += 1
                print(f"  mangler  {code}  {name}")
                continue
            seen.add(product_id)
            found += 1
            print(f"  {serving[0]:>5g} g  {code}  {name}  ({serving[1]})")
            if apply:
                cur.execute(
                    """UPDATE products SET "servingSizeGrams" = %s,
                         "servingSizeUnitSingular" = 'skive', "servingSizeUnitPlural" = 'skiver'
                       WHERE id = %s AND "servingSizeGrams" IS NULL""",
                    (serving[0], product_id),
                )
        print(f"Fundet: {found}. Mangler i OFF: {missing}. {'Skrevet' if apply else 'Dry run - intet skrevet'}.")


if __name__ == "__main__":
    main()
