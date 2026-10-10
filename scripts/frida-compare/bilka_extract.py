"""Henter Bilkas næringstal ud af de to Bilka-ark til Frida-sammenligningen.

Læser bilka_product_information.xlsx (energi, makroer) og bilka_vitamins.xlsx
(vitaminer/mineraler, koblet på Source URL) og skriver:
  data/bilka_values.json  {ean: {name, values}}  — læses af build_xlsx.py
  data/bilka_list.txt     én vare pr. linje til matchningen mod Frida (uden næringstal)

Kør:  py bilka_extract.py [mappe med de to ark]
Standardmappen er Bilka-mappen på NAS'en (samme som bilka_vitamins.py).
"""
import json
import os
import re
import sys

import openpyxl

NAS_BILKA_DIR = r"\\192.168.1.90\Hello Cal\Arkiv - historiske kilde- og importfiler\Oprydning 2026-09-29\Productdatabase\Bilka"
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")

# Kolonnenavne som i scripts/store-products-import/build_data.py
MACROS = {
    "kcal": "Energy kcal per 100 g", "protein": "Protein per 100 g", "carbs": "Carbohydrate per 100 g",
    "fat": "Fat per 100 g", "saturatedFat": "Saturated Fat per 100 g", "sugar": "Sugars per 100 g",
    "fiber": "Fibre per 100 g", "salt": "Salt per 100 g",
}
VITAMINS = {
    "Vitamin A µg per 100 g": "vitaminA", "Vitamin D µg per 100 g": "vitaminD", "Vitamin E mg per 100 g": "vitaminE",
    "Vitamin K µg per 100 g": "vitaminK", "Vitamin C mg per 100 g": "vitaminC", "Thiamin B1 mg per 100 g": "vitaminB1",
    "Riboflavin B2 mg per 100 g": "vitaminB2", "Niacin B3 mg per 100 g": "vitaminB3",
    "Pantothenic Acid B5 mg per 100 g": "vitaminB5", "Vitamin B6 mg per 100 g": "vitaminB6",
    "Biotin B7 µg per 100 g": "vitaminB7", "Folate B9 µg per 100 g": "vitaminB9", "Vitamin B12 µg per 100 g": "vitaminB12",
    "Potassium mg per 100 g": "potassium", "Calcium mg per 100 g": "calcium", "Phosphorus mg per 100 g": "phosphorus",
    "Magnesium mg per 100 g": "magnesium", "Iron mg per 100 g": "iron", "Zinc mg per 100 g": "zinc",
    "Copper mg per 100 g": "copper", "Manganese mg per 100 g": "manganese", "Selenium µg per 100 g": "selenium",
    "Iodine µg per 100 g": "iodine",
}
# Første kolonne der findes, bruges (arkenes layout har skiftet over tid).
NAME_COLS = ("HelloCal_Title", "Product title singular", "Product Name", "Original Title", "Title", "Name")
TYPE_COLS = ("Product Type", "productType")
VARIANT_COLS = ("Variation", "variant")
EAN_COLS = ("EAN", "ean")


def load(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    return [{h: (v.strip() or None) if isinstance(v, str) else v for h, v in zip(header, row) if h} for row in rows]


def first(row, cols):
    for c in cols:
        if row.get(c) not in (None, ""):
            return row[c]
    return None


def number(v):
    """Tal som på deklarationen; '<0,5' tælles som 0,5, tom/tekst som ukendt."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(v))
    return float(m.group(0).replace(",", ".")) if m else None


def url_key(v):
    return (str(v or "")).strip().lower().rstrip("/")


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else NAS_BILKA_DIR
    info = load(os.path.join(folder, "bilka_product_information.xlsx"))
    vit_path = os.path.join(folder, "bilka_vitamins.xlsx")
    vitamins = {url_key(r.get("Source URL")): r for r in load(vit_path)} if os.path.isfile(vit_path) else {}
    missing = [c for c in MACROS.values() if info and c not in info[0]]
    if missing or (info and not any(c in info[0] for c in NAME_COLS)):
        print("Kolonner i arket:", list(info[0].keys()) if info else "(tomt ark)")
        print("Mangler:", missing, "— ret MACROS/NAME_COLS øverst i scriptet.")
    values, lines = {}, []
    for row in info:
        ean = str(first(row, EAN_COLS) or "").strip().split(".")[0]
        key = ean or url_key(row.get("Source URL"))
        v = {k: number(row.get(col)) for k, col in MACROS.items()}
        if not key or not v["kcal"] or None in (v["protein"], v["carbs"], v["fat"]):
            continue  # kun varer med næringsdeklaration
        vit = vitamins.get(url_key(row.get("Source URL"))) or {}
        for col, k in VITAMINS.items():
            n = number(vit.get(col))
            if n is not None and n >= 0:
                v[k] = n
        name = str(first(row, NAME_COLS) or key)
        values[key] = {"name": name, "values": v}
        lines.append("\t".join(str(x or "") for x in (key, name, first(row, TYPE_COLS), first(row, VARIANT_COLS),
                                                        row.get("Quantity"), row.get("Category"))))
    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, "bilka_values.json"), "w", encoding="utf-8") as f:
        json.dump(values, f, ensure_ascii=False, indent=0)
    with open(os.path.join(DATA, "bilka_list.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(HERE, "..", "frida-import", "sheet", "frida_sheet.json"), encoding="utf-8") as f:
        frida = json.load(f)
    with open(os.path.join(DATA, "frida_list.txt"), "w", encoding="utf-8") as f:
        f.write("".join(f"{x['external_id']}\t{x['name']}\t[{x['category']}]\n" for x in frida))
    print(f"{len(values)} Bilka-varer med næringsdata · {sum(1 for x in values.values() if len(x['values']) > 8)} med vitaminer/mineraler")


if __name__ == "__main__":
    main()
