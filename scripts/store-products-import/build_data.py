"""
Builds data/store_products.json (+ data/images/) for store-products-agent
from the hand-cleaned Bilka and REMA 1000 product sheets. Runs locally on the
workstation (the sheets and images are not in the repository); the agent
container then only reads the JSON. Column mapping: docs/PRODUCT_IMPORT_MAPPING.md.

Rules (docs/DECISIONS.md 2026-09-27 "Butiksvarer i tre tabeller"):
- One product per EAN. Bilka wins on conflicting fields, REMA fills blanks.
- Filter values are the word/label shown ("Økologisk"), never "Yes"/"Ja".
- Image priority: finished cut-out (tag "Cutout") > Bilka original > REMA original.
  All variants of the winning tier (EAN_2, EAN_3, .jpg + .png …) are kept as
  extra images for admin "Dubletter" → Produktbilleder.
- Products in both chains also get "sources": each store's own fields, for
  admin "Dubletter" → Produkter (docs/DECISIONS.md 2026-09-28).
- Drinks (ml) = Bilka "Drikkevarer", REMA "Drikkevare" or a liquid quantity
  (l/cl/ml), except drinking yoghurt. Everything else is grams.

Rules (docs/DECISIONS.md 2026-10-02 "Butiksimporten: alt fra arkene med"):
- Every row is built, also without nutrition. No kcal = "nutritionMissing"
  (the agent keeps the product hidden until it has nutrition); kcal but a
  missing macro = that macro is 0 and listed in "estimatedMacros" (shown as ~).
- Rows without an EAN are keyed by the shop's own product id ("externalId").
- Energy is repaired per store: kJ written as 1.105 for 1105, kJ and kcal in
  each other's column, and a kcal that contradicts both kJ and the macros.
  Every correction is listed in the checklist CSV.
- The info sheets' "Labels" fill filters the product sheets left blank.
- REMA "Sukkerfri" on a product with more than 0.5 g sugars is REMA's label
  "Ikke tilsat sukker": keyword "Uden tilsat sukker" instead of the filter.

Usage: py build_data.py [--limit 50] [--all] [--out <dir>] [--images-from <store_products.json>]
"""

import argparse
import csv
import json
import os
import re
import shutil

import openpyxl

# The sheets and images are not in the repository. HELLO_CAL_ROOT is the
# folder holding "Produkter klar til import" and "Productdatabase": the main
# checkout or, since the clean-up 2026-09-29, its archive folder (now on the
# NAS share "Hello Cal").
ARCHIVE = os.path.join("Arkiv - historiske kilde- og importfiler", "Oprydning 2026-09-29")


def find_root():
    if os.environ.get("HELLO_CAL_ROOT"):
        return os.environ["HELLO_CAL_ROOT"]
    main = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "Hello Cal"))
    for root in (main, os.path.join(main, ARCHIVE), os.path.join(r"\\192.168.1.90\Hello Cal", ARCHIVE)):
        if os.path.isdir(os.path.join(root, "Produkter klar til import", "Produktark")):
            return root
    return main


ROOT = find_root()
SHEETS = os.path.join(ROOT, "Produkter klar til import", "Produktark")
BILKA_SHEET = os.path.join(SHEETS, "bilka.xlsx")
REMA_SHEET = os.path.join(SHEETS, "rema1000_version 2.xlsx")
BILKA_INFO = os.path.join(ROOT, "Productdatabase", "Bilka", "bilka_product_information.xlsx")
REMA_INFO = os.path.join(ROOT, "Productdatabase", "REMA1000", "rema1000_product_information.xlsx")
# Written by bilka_vitamins.py (the panel "Info om vitaminer og mineraler");
# optional — without it no product has label vitamins.
BILKA_VITAMINS = os.path.join(ROOT, "Productdatabase", "Bilka", "bilka_vitamins.xlsx")
CUTOUT_DIR = os.path.join(ROOT, "Produkter klar til import", "Færdige produktbilleder")
ORIGINAL_DIR = os.path.join(ROOT, "Productdatabase", "Product Images")

OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUT_IMAGES = os.path.join(OUT_DIR, "images")
SUSPECT_CSV = os.path.join(SHEETS, "Tjekliste - mistænkelige rækker.csv")

EAN_RE = re.compile(r"^\d{8,14}$")


# 2026-10-10: arkene bruger nu databasens kolonnenavne (se Excelark/NAVNEREGLER.md).
# load() kopierer dem tilbage til de gamle navne, saa resten af scriptet er uaendret.
NEW_ALIAS = {
    "bilka": {"brand": "Brand", "subbrand": "Subbrand", "productType": "Product Type", "variant": "Variation",
              "packageSizeText": "Quantity", "packCount": "Pack Count", "packaging": "Packaging", "category": "Category",
              "barcode": "EAN", **{f"keyword{i}": f"Keyword {i}" for i in range(1, 6)}},
    "rema": {"brand": "Brand", "subbrand": "Subbrand", "productType": "Product type", "variant": "Variant", "flavor": "taste",
             "packageSizeText": "Quantity", "packCount": "Amount", "category": "Category", "barcode": "EAN",
             **{f"keyword{i}": f"Keyword {i}" for i in range(1, 6)},
             # 2026-10-10: fedt% staar i _is_fat, alkohol% i _is_alcohol; REMA faar Bilkas praecise kolonner (alkohol-% i
             # 2. _is_alcohol). Gamle navne virker stadig.
             "_is_fat": "fat", "_is_alcohol": "%", "_is_alcohol#2": "%", "_is_vegan": "is_vegan", "_is_meat": "is_meat",
             "_is_lactose_free": "is_lactose_free", "_is_glutenfree": "is_gluten_free", "_is_sugar_free": "is_sugar_free",
             "_is_alcohol_free": "is_alcohol_free", "_is_organic": "is_biological", "_is_whole_grain": "is_whole_grain",
             "_is_animal_welfare": "is_animal_wellfare", "_is_country_of_origen": "is_country_of_origin",
             "_is_allergy": "_is_allergies", "packaging": "is_Packaging", "Source URL": "Source url", "Image File": "Image file",
             "Parse Status": "Parse status"},
}


def _cap(v):
    return v[:1].upper() + v[1:] if isinstance(v, str) and v else v


def load(path, kind=None):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [str(h).strip() if h is not None else "" for h in next(rows)]
    out = []
    for row in rows:
        item = {}
        for i, h in enumerate(header):
            if not h or i >= len(row):
                continue
            v = row[i]
            if isinstance(v, str):
                v = v.strip() or None
            # Bilka has two "_is_alcohol" columns (label + percent): keep both.
            if h in item:
                h = h + "#2"
            item[h] = v
        if kind and "productType" in item:  # nyt layout: databasenavne, smaa bogstaver
            for new, old in NEW_ALIAS[kind].items():
                if new in item:
                    item[old] = item[new]
            for k in list(item):
                if k.startswith(("_is_", "is_", "Keyword ")) or k in ("Variation", "Variant", "taste"):
                    if isinstance(item[k], str) and not re.match(r"^[\d,.%\s]+$", item[k]):
                        item[k] = _cap(item[k])
            if item.get("_is_alcohol_free") and not item.get("_is_alcohol"):
                item["_is_alcohol"] = _cap(item["_is_alcohol_free"])
            if kind == "bilka":
                item["HelloCal_Title"] = item.get("Product title singular")
                item["_new_title"] = True
            else:
                item["Hello Cal product title"] = item.get("Product title singular")
                item["_new_title"] = True
        out.append(item)
    return out


def text(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def ean_of(v):
    s = text(v)
    if s is None:
        return None
    if s.endswith(".0"):
        s = s[:-2]
    return s if EAN_RE.match(s) else None


def number(v, energy=False):
    """Parses sheet numbers: 1.5, "1,5", "1.477" (kJ thousands), "4% fedt"."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "").replace(" ", "")
    m = re.search(r"-?\d+(?:[.,]\d+)*", s)
    if not m:
        return None
    s = m.group(0)
    if energy and re.fullmatch(r"\d{1,2}\.\d{3}", s):
        s = s.replace(".", "")
    s = s.replace(",", ".")
    if s.count(".") > 1:
        s = s.replace(".", "", s.count(".") - 1)
    try:
        return float(s)
    except ValueError:
        return None


def first(*values):
    for v in values:
        if v not in (None, "", []):
            return v
    return None


# ---------- nutrition ----------

BILKA_NUTRITION = {
    "energyKj": ("Energy kJ per 100 g", True),
    "kcal": ("Energy kcal per 100 g", True),
    "fat": ("Fat per 100 g", False),
    "saturatedFat": ("Saturated Fat per 100 g", False),
    "monounsaturatedFat": ("Monounsaturated Fat per 100 g", False),
    "polyunsaturatedFat": ("Polyunsaturated Fat per 100 g", False),
    "carbs": ("Carbohydrate per 100 g", False),
    "sugars": ("Sugars per 100 g", False),
    "fiber": ("Fibre per 100 g", False),
    "protein": ("Protein per 100 g", False),
    "salt": ("Salt per 100 g", False),
    "sodium": ("Sodium per 100 g", False),
    "alcohol": ("Alcohol per 100 g", False),
    "vitaminB2": ("Riboflavin B2 mg per 100 g", False),
    "vitaminB12": ("Vitamin B12 µg per 100 g", False),
    "calcium": ("Calcium mg per 100 g", False),
    "phosphorus": ("Phosphorus mg per 100 g", False),
}
REMA_NUTRITION = {k: v for k, v in BILKA_NUTRITION.items() if v[0] in {
    "Energy kJ per 100 g", "Energy kcal per 100 g", "Fat per 100 g", "Saturated Fat per 100 g",
    "Carbohydrate per 100 g", "Sugars per 100 g", "Fibre per 100 g", "Protein per 100 g", "Salt per 100 g",
}}


KJ_PER_KCAL = 4.184


def energy_consistent(kj, kcal):
    """kJ and kcal describe the same energy (labels round both, so small
    values get an absolute slack)."""
    return abs(kj - kcal * KJ_PER_KCAL) <= max(0.10 * kcal * KJ_PER_KCAL, 12)


def fits(value, estimate):
    return abs(value - estimate) <= max(0.08 * estimate, 4)


def repair_energy(kj, kcal, macro_kcal):
    """Returns (kJ, kcal, note). The Bilka sheet holds kJ as numbers, so 1105
    kJ arrived as 1.105; a few rows have kJ and kcal in each other's column
    or a kcal that contradicts the label's own kJ. macro_kcal (4P + 4C + 9F,
    None for alcohol, where it does not hold) only arbitrates between the two
    label values — it never replaces them. note is None for the silent
    thousands fix and when nothing changed."""
    if kj is None or kcal is None or energy_consistent(kj, kcal):
        return kj, kcal, None
    if energy_consistent(kj * 1000, kcal):
        return round(kj * 1000), kcal, None
    if kj <= 950 and energy_consistent(kcal * 1000, kj):
        return round(kcal * 1000), kj, f"kJ og kcal stod i hinandens kolonner ({kj:g} / {kcal:g}) – byttet om"
    if kj <= 950 and energy_consistent(kcal, kj):
        return kcal, kj, f"kJ og kcal stod i hinandens kolonner ({kj:g} / {kcal:g}) – byttet om"
    if kj == 0:
        return None, kcal, None
    if macro_kcal is not None:
        kcal_fits = fits(kcal, macro_kcal)
        from_kj = [(kj * scale, kj * scale / KJ_PER_KCAL) for scale in (1, 1000)]
        for real_kj, as_kcal in from_kj:
            if not kcal_fits and as_kcal <= 950 and fits(as_kcal, macro_kcal):
                note = f"kcal rettet fra {kcal:g} til {round(as_kcal)}: arkets {round(real_kj)} kJ og makroerne siger {round(macro_kcal)}"
                return round(real_kj), round(as_kcal), note
        if kcal_fits and not any(fits(as_kcal, macro_kcal) for _, as_kcal in from_kj):
            return None, kcal, f"kJ {kj:g} droppet: passer ikke til {kcal:g} kcal, som makroerne bekræfter"
    if kj < 10 < kcal:
        kj = round(kj * 1000)  # still the sheet's thousands format
    return kj, kcal, f"kJ {kj:g} og kcal {kcal:g} passer ikke sammen – ikke rettet"


def nutrition(info, mapping, alcoholic=False):
    """Returns (values, notes for the checklist)."""
    if not info:
        return {}, []
    out = {}
    notes = []
    for key, (col, energy) in mapping.items():
        v = number(info.get(col), energy=energy)
        if v is not None and v >= 0:
            out[key] = v
    macros = [out.get(k) for k in ("protein", "carbs", "fat")]
    macro_kcal = None if alcoholic or None in macros else 4 * macros[0] + 4 * macros[1] + 9 * macros[2] + 2 * out.get("fiber", 0)
    kj, kcal, note = repair_energy(out.get("energyKj"), out.get("kcal"), macro_kcal)
    for key, value in (("energyKj", kj), ("kcal", kcal)):
        if value is None:
            out.pop(key, None)
        else:
            out[key] = float(value)
    if note:
        notes.append(note)
    # Drop values that cannot be right (a part larger than its whole).
    if "sugars" in out and "carbs" in out and out["sugars"] > out["carbs"] + 0.5:
        notes.append(f"sukkerarter {out.pop('sugars'):g} g droppet: mere end kulhydrat {out['carbs']:g} g")
    for part, label in (("saturatedFat", "mættet fedt"), ("monounsaturatedFat", "enkeltumættet fedt"), ("polyunsaturatedFat", "flerumættet fedt")):
        if part in out and "fat" in out and out[part] > out["fat"] + 0.5:
            notes.append(f"{label} {out.pop(part):g} g droppet: mere end fedt {out['fat']:g} g")
    return out, notes


# Vitamins and minerals for Product.micronutrientsPer100g — keys and units
# follow src/lib/nutrients.ts. Info-sheet column -> (key, factor to that unit).
INFO_MICROS = {
    "Sodium per 100 g": ("sodium", 1000),
    "Riboflavin B2 mg per 100 g": ("vitaminB2", 1),
    "Vitamin B12 µg per 100 g": ("vitaminB12", 1),
    "Calcium mg per 100 g": ("calcium", 1),
    "Phosphorus mg per 100 g": ("phosphorus", 1),
}
# Columns of bilka_vitamins.xlsx (bilka_vitamins.py), already in catalogue units.
VITAMIN_COLUMNS = {
    "Vitamin A µg per 100 g": "vitaminA", "Vitamin D µg per 100 g": "vitaminD", "Vitamin E mg per 100 g": "vitaminE",
    "Vitamin K µg per 100 g": "vitaminK", "Vitamin C mg per 100 g": "vitaminC", "Thiamin B1 mg per 100 g": "vitaminB1",
    "Riboflavin B2 mg per 100 g": "vitaminB2", "Niacin B3 mg per 100 g": "vitaminB3",
    "Pantothenic Acid B5 mg per 100 g": "vitaminB5", "Vitamin B6 mg per 100 g": "vitaminB6",
    "Biotin B7 µg per 100 g": "vitaminB7", "Folate B9 µg per 100 g": "vitaminB9", "Vitamin B12 µg per 100 g": "vitaminB12",
    "Potassium mg per 100 g": "potassium", "Calcium mg per 100 g": "calcium", "Phosphorus mg per 100 g": "phosphorus",
    "Magnesium mg per 100 g": "magnesium", "Iron mg per 100 g": "iron", "Zinc mg per 100 g": "zinc",
    "Copper mg per 100 g": "copper", "Manganese mg per 100 g": "manganese", "Selenium µg per 100 g": "selenium",
    "Iodine µg per 100 g": "iodine", "Sodium mg per 100 g": "sodium",
}


def micronutrients(info, vitamins):
    out = {}
    for col, (key, factor) in INFO_MICROS.items():
        v = number(info.get(col)) if info else None
        if v is not None and v >= 0:
            out[key] = round(v * factor, 4)
    for col, key in VITAMIN_COLUMNS.items():
        v = number(vitamins.get(col)) if vitamins else None
        if v is not None and v >= 0:
            out[key] = v
    return out


def info_extra(info):
    if not info:
        return {}
    return {
        "ingredients": text(info.get("Ingredients")),
        "allergens": text(info.get("Allergens")),
        "additives": text(info.get("E-Numbers")),
        "flavor": text(info.get("Flavor")),
        "country": text(info.get("Country of Origin")),
        "labels": [label.lower() for label in split_list(info.get("Labels"))],
        "additional": text(info.get("Additional Product Information")),
        "description": text(info.get("Additional Product Information")),
    }


# ---------- filters ----------

MEAT_ALIASES = {"oksekød": "Okse", "okse": "Okse", "svin": "Gris", "svinekød": "Gris"}


def meat(v):
    s = text(v)
    if not s:
        return None
    return MEAT_ALIASES.get(s.lower(), s[:1].upper() + s[1:])


def split_list(v):
    s = text(v)
    if not s:
        return []
    return [p.strip() for p in re.split(r"\s*,\s*", s) if p.strip()]


def bilka_filters(b):
    alcohol_label = text(b.get("_is_alcohol"))
    return {
        "organic": "Økologisk" if b.get("_is_organic") else None,
        "glutenFree": "Glutenfri" if b.get("_is_glutenfree") else None,
        "lactoseFree": "Laktosefri" if b.get("_is_lactose_free") else None,
        "sugarFree": "Sukkerfri" if b.get("_is_sugar_free") else None,
        "sweeteners": "Sødemidler" if b.get("_is_sweeteners") else None,
        "vegan": "Vegansk" if b.get("_is_vegan") else None,
        "vegetarian": None,
        "meatType": meat(b.get("_is_meat")),
        "alcohol": alcohol_label,
        "alcoholPercent": number(b.get("_is_alcohol#2")),
        "fatPercent": number(b.get("_is_fat")),
        "countryOfOrigin": text(b.get("_is_country_of_origen")),
        "wholeGrain": None,
        "keyhole": None,
        "animalWelfare": [],
        "certifications": [],
        "storage": "Frost" if text(b.get("Packaging")) == "Frozen" else None,
        "size": None,
        "toxins": [],
    }


REMA_STORAGE = {"konserves": "Konserves"}
ALCOHOL_WORDS = re.compile(
    r"\b(øl|vin|vine|cider|spiritus|whisky|vodka|rom|gin|likør|akvavit|snaps|champagne|cava|prosecco|"
    r"rødvin|hvidvin|rosé|rosévin|portvin|sherry|bitter|cocktail|ready to drink|hard seltzer)\b",
    re.I,
)


def is_alcoholic(r):
    """REMA's "%" column holds both fat % (milk) and alcohol % (wine/beer)."""
    kind = " ".join(filter(None, [text(r.get("Product type")), text(r.get("Hello Cal product title"))]))
    return bool(ALCOHOL_WORDS.search(kind)) and "fedt" not in kind.lower()


def rema_filters(r, is_drink):
    vegan_raw = text(r.get("is_vegan"))
    healthy = text(r.get("is_healthy"))
    packaging = text(r.get("is_Packaging"))
    percent = number(r.get("%")) if is_alcoholic(r) else None
    welfare = []
    for part in split_list(r.get("is_animal_wellfare")):
        welfare.append(part)
    return {
        "organic": "Økologisk" if r.get("is_biological") else None,
        "glutenFree": "Glutenfri" if r.get("is_gluten_free") else None,
        "lactoseFree": "Laktosefri" if r.get("is_lactose_free") else None,
        "sugarFree": "Sukkerfri" if text(r.get("is_sugar_free")) == "Sukkerfri" else None,
        "sweeteners": None,
        "vegan": "Vegansk" if vegan_raw and vegan_raw.lower() in ("ja", "vegansk") else None,
        "vegetarian": "Vegetarisk" if vegan_raw and vegan_raw.lower() == "vegetarisk" else None,
        "meatType": meat(r.get("is_meat")),
        "alcohol": "Alkoholfri" if r.get("is_alcohol_free") else None,
        "alcoholPercent": percent,
        # The column also holds words ("0 Kalorier", "Light"): those are keywords.
        "fatPercent": number(r.get("fat")) if "%" in (text(r.get("fat")) or "") else None,
        "countryOfOrigin": text(r.get("is_country_of_origin")),
        "wholeGrain": "Fuldkorn" if r.get("is_whole_grain") else None,
        "keyhole": "Nøglehul" if healthy == "Nøglehul" else None,
        "animalWelfare": welfare,
        "certifications": split_list(r.get("is_social_responsibility")),
        "storage": REMA_STORAGE.get((packaging or "").lower()),
        "size": text(r.get("size")),
        "toxins": ["Overfladebehandlet"] if healthy == "Overfladebehandlet" else [],
    }


def rema_keywords(r, is_drink):
    # 2026-10-10: REMA har Bilkas keyword1-5 ("light", "i skiver" m.fl. staar nu som keywords).
    out = [k for k in (text(r.get(f"Keyword {i}")) for i in range(1, 6)) if k]
    # Package shapes go to Product.packaging and "Færdigretter" to the category;
    # only other values (e.g. "i Skiver") stay keywords.
    for part in split_list(r.get("is_Packaging")):
        if part.lower() not in REMA_STORAGE and part.lower() not in ("bakke", "brik", "tindåse", "flaske", "færdigretter"):
            out.append(part)
    if text(r.get("is_sugar_free")) == "Light":
        out.append("Light")
    if text(r.get("%")) and not is_alcoholic(r):
        out.append(text(r.get("%")))
    if text(r.get("fat")) and "%" not in text(r.get("fat")):
        out.append(text(r.get("fat")))
    return out


def merge_filters(bf, rf):
    if bf is None:
        return rf
    if rf is None:
        return bf
    out = {}
    for k in bf:
        if isinstance(bf[k], list):
            out[k] = bf[k] + [x for x in rf[k] if x not in bf[k]]
        else:
            out[k] = first(bf[k], rf[k])
    return out


# The info sheets' "Labels" (the shops' own badges) fill what the product
# sheets left blank; the sheets win where both say something.
NO_ADDED_SUGAR = {"ikke tilsat sukker", "uden tilsat sukker"}
LABEL_FILTERS = {
    "økologisk": ("organic", "Økologisk"), "økologi": ("organic", "Økologisk"),
    "glutenfri": ("glutenFree", "Glutenfri"), "gluten fri": ("glutenFree", "Glutenfri"),
    "laktosefri": ("lactoseFree", "Laktosefri"), "laktose fri": ("lactoseFree", "Laktosefri"),
    "vegansk": ("vegan", "Vegansk"), "vegetarisk": ("vegetarian", "Vegetarisk"),
    "fuldkorn": ("wholeGrain", "Fuldkorn"), "nøglehul": ("keyhole", "Nøglehul"),
    "sukkerfri": ("sugarFree", "Sukkerfri"),
}
LABEL_LISTS = {
    "msc": ("certifications", "MSC"), "asc": ("certifications", "ASC"), "fairtrade": ("certifications", "Fairtrade"),
    "rainforest alliance": ("certifications", "Rainforest Alliance Certificeret"),
    "rainforest alliance certificeret": ("certifications", "Rainforest Alliance Certificeret"),
    "svanemærket": ("certifications", "Svanemærket"),
    "bedre dyrevelfærd 1": ("animalWelfare", "Bedre Dyrevelfærd 1"),
    "bedre dyrevelfærd 2": ("animalWelfare", "Bedre Dyrevelfærd 2"),
    "bedre dyrevelfærd 3": ("animalWelfare", "Bedre Dyrevelfærd 3"),
    "anbefalet af dyrenes beskyttelse": ("animalWelfare", "Anbefalet Af Dyrenes Beskyttelse"),
}
ORIGIN_RE = re.compile(r"Oprindelsesland:\s*([A-ZÆØÅ][a-zæøå]+(?: [A-ZÆØÅ][a-zæøå]+)?)\s*(?:$|[.,;<])")


def apply_labels(filters, keywords, labels, additional):
    """Mutates filters and keywords with what the shops' own labels add."""
    for label in labels:
        if label in LABEL_FILTERS:
            key, word = LABEL_FILTERS[label]
            if not filters.get(key):
                filters[key] = word
        elif label in LABEL_LISTS:
            key, word = LABEL_LISTS[label]
            if word.lower() not in {x.lower() for x in filters[key]}:
                filters[key] = filters[key] + [word]
        elif label in NO_ADDED_SUGAR and "uden tilsat sukker" not in {k.lower() for k in keywords}:
            keywords.append("Uden tilsat sukker")
    if not filters.get("countryOfOrigin"):
        origin = ORIGIN_RE.search(additional or "")
        if origin:
            filters["countryOfOrigin"] = origin.group(1)
        elif "dansk" in labels or all(f"{step} i: Danmark" in (additional or "") for step in ("Født", "Opvokset", "Slagtet")):
            filters["countryOfOrigin"] = "Danmark"


def alcohol_hint(b, r):
    """Alcohol carries part of the energy, so 4P + 4C + 9F cannot arbitrate."""
    if b and (text(b.get("_is_alcohol")) == "Indeholder alkohol" or (number(b.get("_is_alcohol#2")) or 0) > 0.5):
        return True
    if r and is_alcoholic(r):
        return True
    return has(ALCOHOL_TYPE, text(b.get("Original Title")) if b else None, text(b.get("Product Type")) if b else None)


# ---------- basics ----------

LIQUID_RE = re.compile(r"\d\s*(ml|cl|dl|l|liter)\b", re.I)
REMA_CATEGORY = {
    "drikkevare": "DRINK", "processed foods": "PROCESSED", "slik": "PROCESSED", "pålæg": "PROCESSED",
    "pålægssalat": "PROCESSED", "salater": "PROCESSED", "råvarer": "RAW", "grøntsager": "VEGETABLES",
    "grøntsager og frugt": "VEGETABLES", "frisk frugt m.m.": "VEGETABLES", "frisk grønt": "VEGETABLES",
}


def product_category(b, r, quantity, product_type):
    if r and text(r.get("Type")):
        cat = REMA_CATEGORY.get(text(r.get("Type")).lower())
    else:
        cat = None
    is_yoghurt = "yoghurt" in (product_type or "").lower() or "yogurt" in (product_type or "").lower()
    liquid = bool(quantity and LIQUID_RE.search(quantity))
    bilka_drink = bool(b and text(b.get("Category")) == "Drikkevarer")
    if (bilka_drink or liquid or cat == "DRINK") and not is_yoghurt:
        return "DRINK"
    if cat == "DRINK":
        return None
    if cat:
        return cat
    if b and text(b.get("Category")) == "Frugt & grønt":
        return "VEGETABLES"
    return "PROCESSED" if b else None


def fix_decimals(s):
    """The sheet cleanup turned "0,4%" into "0, 4%" — glue decimals back.
    2026-10-10: arkene skriver decimaler med punktum ("1.5 l"); appen viser
    brugerens eget decimaltegn (src/lib/decimal-separator.ts)."""
    return re.sub(r"(\d), (\d)", r"\1.\2", s) if s else s


def strip_title(title):
    title = re.sub(r"\s*\([^()]*\)\s*$", "", fix_decimals(title or ""))
    title = re.sub(r",\s*(\d+\s*x\s*)?[\d.,]+\s*(g|kg|ml|cl|dl|l|stk)\.?\s*$", "", title, flags=re.I)
    return title.strip(" ,")


def bilka_name(b):
    """HelloCal_Title is "Name, quantity (Brand)" — the name is the part before.
    The cleanup cut abbreviations ("u. tilsat sukker" → "u"); then the
    uncut Product Name is used instead. A product named after its brand alone
    ("Coca Cola", "Carlsberg 1883", "Breezer m. appelsin") has nothing left
    but a digit of the quantity or a dangling "m": then the shop's own title
    is the name."""
    if b.get("_new_title"):  # nyt layout: titlen er allerede uden maengde/brand
        return text(b.get("Product title singular")) or strip_title(text(b.get("Product Name"))) or text(b.get("Product title plural"))
    name = strip_title(text(b.get("HelloCal_Title")))
    if not name or re.search(r"\s\w$", name):
        name = strip_title(text(b.get("Product Name"))) or name
    if not name or re.fullmatch(r"[\d.,\s]+", name) or re.match(r"m\.? ", name, re.I):
        name = fix_decimals(text(b.get("Original Title"))) or name
    name = name or text(b.get("HelloCal_Title")) or ""
    return name[:1].upper() + name[1:]


def rema_name(r, brand):
    """REMA titles start with the brand ("Friland Hakket oksekød"); the brand
    is its own field, so it is not repeated in the name."""
    name = text(r.get("Hello Cal product title")) or ""
    if r.get("_new_title"):
        return name.strip() or text(r.get("Product title plural")) or text(r.get("Variant")) or ""
    if brand and name.lower().startswith(brand.lower() + " "):
        name = name[len(brand) + 1:]
    return name.strip() or text(r.get("Hello Cal product title"))


# ---------- Hello Cal categories (docs/DECISIONS.md 2026-09-28) ----------
# Main categories with optional subcategories; the agent creates the tree.
# Rules read the product TITLE first: ~80 repaired Bilka rows carry a
# product type / meat type from another row (e.g. "Nakkekoteletter" with
# type "Brune kaffefiltre" and meat "Fisk"), so those fields only help when
# the title is silent, and a meat type that contradicts the title is dropped.
# Order matters: the first matching rule wins.

FISH_WORDS = (r"fisk|laks|torsk|sej\b|tun\b|tunfisk|rejer|reje\b|makrel|sild|skaldyr|ørred|rødspætte|kuller|hellefisk|"
              r"muslinger|krabbe|hummer|blæksprutte|ansjos|sardin|rogn|kippers|fiskefrikadelle|fiskefilet|kaviar|surimi")
FISH_TYPES = {"fisk", "laks", "torsk", "sej", "tun", "rejer", "makrel", "sild", "skaldyr", "ørred", "rødspætte",
              "kuller", "hellefisk", "muslinger", "krabbe", "hummer", "blæksprutte", "ansjoser", "sardiner", "rogn"}
MEAT_WORDS = (r"kylling|høns|kalkun|and\b|andebryst|gås|okse|kalv|gris|svin|flæsk|lam\b|lamme|vildt|hjort|ged\b|"
              r"bacon|pølse|salami|skinke|pancetta|chorizo|kebab|frikadelle|kødboller|medister|koteletter|kotelet|mørbrad|"
              r"ribben|nakke|culotte|entrecote|bøf|burgerbøf|leverpostej|postej|rullepølse|hamburgerryg|"
              r"spareribs|pepperoni|pulled|rillette|paté|kød\b|kødpølse|spegepølse|roastbeef|porchetta|pålæg|cervelat|mortadella|jerky|trifler")


def has(pattern, *texts):
    return bool(re.search(pattern, " ".join(t for t in texts if t).lower()))


RAW_MEAT = r"(hakket|fars|filet|bryst|hel kylling|mørbrad|kotelet|bøf|culotte|lår|underlår|vinger|steak|entrecote|inderlår|tyndsteg|nakkefilet|svinekam|ribbenssteg|flæskesteg|højreb|gullasch|strimler|kyllingetern|kylling tern|topside)"
PREPARED = r"(paner|olie|smør\b|røget|stegt|færdigstegt|kogt|paneret|indbagt|grillet|pålæg|pølse|pølser|i skiver|salami|spegep|leverpostej|frikadelle|kebab|bacon|skinke|hamburgerryg|rullepølse|postej|i olie|i tomat|i lage|konserves|paté|salat|nuggets|marry me|fyld|suppe|pizza|nudler|gravad|tatar)"
FRUIT = r"\b(frugt|æble|banan|pære|appelsin|citron|lime|mandarin|klementin|grapefrugt|druer|melon|ananas|mango|kiwi|blomme|fersken|nektarin|abrikos|jordbær|hindbær|blåbær|brombær|solbær|kirsebær|granatæble|passionsfrugt|avocado|figen|dadler|bærmix|tranebær)"
NOT_FRUIT = r"snitte|kiks|skiver|vafler|krydderi|snacks|fromage|roulade|måne|mos\b|bamse|ispinde|choco|tærte|marmelade|syltetøj|juice|saft|nektar|drik|kage|tærte|is\b|pops|smoothie|yoghurt|skyr|chips|tørret|soltørret|müsli|granola|bar\b|bars\b|chokolade|karamel"
VEG = r"\b(coleslaw|grønt|grøntsag|kartof|gulerod|gulerødder|løg|hvidløg|porre|selleri|pastinak|rødbede|kål|broccoli|blomkål|spinat|salat|agurk|tomat|peberfrugt|squash|aubergine|champignon|svampe|majs|ærter|bønner|asparges|radise|ingefær|rodfrugt|græskar|fennikel|krydderurter|persille|basilikum|purløg|dild|koriander|rucola|wokblanding|grøntsagsblanding|edamame)"
VEG_PREPARED = r"(kroketter|skruer|coleslaw|frites|både|hakkede|flåede|passata|syltede|i lage|pickles|konserves|stegte|kogte|mos|bagte|pommes|gratin|sauce|suppe|pesto|puré|ovnklare|marineret)"
NOT_VEG = r"pesto|puré|pulver|krydderolie|baguette|oregano|timian|rosmarin|suppe|kage|boller|brød|mel\b|majsmel|kerner|ost\b|salatost|fajita|krydderi|dressing|sauce|pizza|forårsrulle|smoothie|chips"
SODA = r"\b(soda|sodavand|cola|lemonade|limonade|energidrik|tonic|sportsdrik|sportssodavand|iste|ice tea|faxe kondi|fanta|sprite|pepsi|7up|zero|lemon)\b"
SMOOTHIE = r"\bsmoothie"
DAIRY = r"(\bmælk|minimælk|letmælk|sødmælk|skummetmælk|kærnemælk|kakaomælk|yoghurt|yogurt|skyr|ymer|a38|kefir|kvark|ost|oste|hytteost|flødeost|smøreost|smelteost|salatost|mozzarella|feta|parmesan|cheddar|brie|camembert|emmentaler|gouda|havarti|danbo|gorgonzola|mascarpone|ricotta|halloumi|burrata|skæreost|revet|smør|smørbar|fløde|piskefløde|madlavningsfløde|creme fraiche|cremefraiche|æg|koldskål|mælkedrik|protein budding|proteinbudding|mousse|budding)\b|ost\b|æg\b"
NOT_DAIRY = r"\b(toast|frost|tapenade|fettuccine|cavatappi|fusilli|penne|pappardelle|ravioli|tortellini|gnocchi|m æg|plantedrik|havredrik|mandeldrik|sojadrik|risdrik|plantebaseret|vegansk|pasta|linguine|spaghetti|tagliatelle|nudler|lasagne|pizza|chips|kiks|ostesmag|chokolade|slik|is\b|isvaffel|kage|brød|boller|mayonnaise|æggenudler|æggepasta|pålæg)"
BREAD = r"(brød|rugbrød|boller|bolle|knækbrød|kiks|kage|kager|croissant|wienerbrød|toast|pita|tortilla|wraps|bagel|baguette|ciabatta|focaccia|flutes|muffin|donut|småkager|cookies|rasp|kringle|lagkage|pandekager|vafler|tærtebund|tarteletter|kammerjunkere|pain au|bao|brunsviger|pølsebrød|burgerboller|sandwichbrød|pizzadej|butterdej|kagemix|bageblanding|krymmel|lagkage|roulade|snitte|vafler|pancake)"
CHIPS = r"(?<!chocolate )(?<!choco )\b(chips|kartoffelchips|tortillachips|majschips|popcorn|snack chips|rejechips|puffs|nachos|riskiks|majskiks|linsechips|grøntsagschips)"
CANDY = r"(slik|chokolade|vingummi|lakrids|bolsje|bolcher|marcipan|karamel|pastiller|tyggegummi|flødeboller|skumfiduser|nougat|praliner|konfekt|chokoladebar|godt & blandet|p-tærter|pebernødder|sour|gummies)"
READY_MEAL = r"\b(færdigret|lasagne|pizza|gryderet|wok m|kyllingewok|risotto|suppe|sandwich|burrito|dumplings|nudelret|boller i karry|biksemad|tikka masala|curry|bourguignon|meal kit|måltidssalat|salad bowl|spring rolls|forårsruller|tarteletfyld|burger\b|mac & cheese|gratin|lasagna|moussaka|chili con carne|stroganoff|paella|pasta med|pasta m |penne m |ret\b|karbonade m)"
NOT_READY = r"sauce|plader|bund\b|dej\b|\bris\b|risottoris|krydderi|blanding|brød|mix\b"
NOT_MEAT = r"plante|veggie|vegansk|tofu|sojabaseret|vegansk|vegetar|smag|krydderi|fond|bouillon|sauce|marinade\b"
BREAKFAST = r"\b(müsli|musli|mysli|granola|havregryn|cornflakes|morgenmad|havrefras|cheerios|breakfast)"
PANTRY = r"((havre|hvede|rug|spelt|majs|mandel|kokos|kartoffel|grahams|durum)mel|pasta|spaghetti|penne|fusilli|nudler|\bris\b|basmati|jasmin|\bmel\b|hvedemel|gryn|bouillon|fond|krydderi|\bsalt\b|peber\b|sauce|dressing|ketchup|sennep|mayonnaise|remoulade|olie|eddike|sukker|honning|sirup|marmelade|syltetøj|nødder|mandler|cashew|peanut|jordnødder|\bfrø\b|kerner|kikærter|linser|tørret|kaffe|\bte\b|\bte m|urtete|kakao|bagepulver|\bgær\b|vanilje|pesto|tomatpuré|kokosmælk|sojasauce|tahin|nutella|marinade|chilisauce|sambal|salsa|hummus|oliven|kapers|konserves|på dåse|i lage|i vand|chutney|dip\b|smørepålæg|peanutbutter|peanut butter|sødemiddel|spelt|quinoa|bulgur|couscous|polenta)"
ALCOHOL_TYPE = (
    r"\b(øl|pilsner|lager|pale ale|ipa|stout|porter|weissbier|vin|rødvin|hvidvin|rosé|rosévin|mousserende|champagne|cava|"
    r"prosecco|cider|spiritus|whisky|whiskey|vodka|rom|gin|likør|akvavit|snaps|cognac|brandy|tequila|portvin|sherry|"
    r"hard seltzer|cocktail|ready to drink|bitter|chardonnay|merlot|cabernet|sauvignon|pinot|riesling|shiraz|rioja)\b"
)
LIQUID_DAIRY = r"(\bmælk|minimælk|letmælk|sødmælk|skummetmælk|kærnemælk|kakaomælk|mælkedrik|kefir|koldskål|proteindrik)"


def trusted_meat(meat, title, dept):
    """Drops a meat type the title contradicts (repaired rows, see above)."""
    if not meat:
        return None
    m = meat.lower()
    is_fish = m in FISH_TYPES
    title_fish, title_meat = has(FISH_WORDS, title), has(MEAT_WORDS, title)
    if is_fish and title_meat and not title_fish:
        return None
    if not is_fish and title_fish and not title_meat:
        return None
    if not (title_meat or title_fish) and dept != "Kød & fisk":
        return None
    if has(r"fisk", m) and not title_fish and dept not in ("Kød & fisk", "Frost"):
        return None
    return meat


def classify(p, b, r):
    """Returns (main category, subcategory or None) and may clear a meat type
    the title contradicts."""
    title = " ".join(filter(None, [p.get("name"), text(b.get("Original Title")) if b else None, p.get("variant")]))
    ptype = p.get("productType") or ""
    both = title + " " + ptype
    dept = text(b.get("Category")) if b else None
    rema_type = (text(r.get("Type")) or "").lower() if r else ""
    f = p["filters"]
    sheet_meat = f.get("meatType")
    f["meatType"] = trusted_meat(sheet_meat, title, dept)
    stems = [w[:5] for w in re.findall(r"[a-zæøå]{4,}", ptype.lower())]
    reasons = []
    if sheet_meat and not f["meatType"]:
        reasons.append(f"kødtype '{sheet_meat}' passer ikke til titlen")
    if stems and not any(st in title.lower() for st in stems) and dept in ("Kød & fisk", "Frugt & grønt"):
        reasons.append(f"produkttype '{ptype}' passer ikke til titlen")
    p["_suspect"] = "; ".join(reasons) or None
    p["_sheetMeat"] = sheet_meat
    meat = (f.get("meatType") or "").lower()
    liquid = bool(p.get("quantity") and LIQUID_RE.search(p["quantity"]))
    drink_context = dept == "Drikkevarer" or rema_type == "drikkevare"
    alcohol_free = f.get("alcohol") == "Alkoholfri" or has(r"alkoholfri|alcohol free|0[,.]0 ?%|\b0 ?%", both)

    def is_(pattern):
        # Title decides; product type only when the title is silent.
        return has(pattern, title) or (not title.strip() and has(pattern, ptype))

    if not alcohol_free and (drink_context or liquid) and not has(r"sauce|fond|marinade|eddike|sirup", title) and (
        (f.get("alcoholPercent") or 0) > 0.5 or f.get("alcohol") == "Indeholder alkohol" or has(ALCOHOL_TYPE, title)
        or (drink_context and has(ALCOHOL_TYPE, ptype))
    ):
        return "Alkohol", None
    if is_(CHIPS):
        return "Chips", None
    if has(r"budding|mousse|risalamande|koldskål|dessert|kvark", title) and not has(r"kage|bar\b|kiks|plante", title):
        return "Mejeri og æg", None
    if (is_(DAIRY) or (dept == "Mejeri & køl" and has(DAIRY, ptype))) and not has(NOT_DAIRY, title) and not meat:
        return "Mejeri og æg", None
    if drink_context or (liquid and has(r"\b(juice|drik|saft|vand|nektar|most|smoothie|te\b|kaffe|iskaffe|latte)", both)):
        if has(SMOOTHIE, both):
            return "Drikkevarer", "Smoothies"
        if has(SODA, both):
            return "Drikkevarer", "Sodavand"
        return "Drikkevarer", None
    if (is_(READY_MEAL) and not has(NOT_READY, title)) or (r and has(r"færdigret", text(r.get("is_Packaging")) or "")):
        return "Færdigretter", None
    raw = (rema_type == "råvarer" or has(RAW_MEAT, title) or has(r"\bhele?\b", title)) and not has(PREPARED, title)
    raw = raw or has(r"\b(hakket|hakkede|fars)\b", title) and not has(r"paner|stegt|kogt|røget", title)
    if (has(FISH_WORDS, title) or meat in FISH_TYPES) and not has(NOT_MEAT, title):
        return "Fisk og skaldyr", ("Rå fisk" if raw and not has(r"sild|marineret|kryddersild", title) else "Tilberedt fisk")
    if (meat or has(MEAT_WORDS, title)) and not has(NOT_MEAT, title):
        return "Kød", ("Rå kød" if raw else "Tilberedt kød")
    if is_(BREAKFAST):
        return "Kolonial og tørvarer", None
    if (dept == "Slik & snacks" and not has(PANTRY, title)) or rema_type == "slik" or is_(CANDY):
        return "Slik", None
    fresh = dept == "Frugt & grønt" or rema_type in ("grøntsager og frugt", "frisk frugt m.m.", "frisk grønt", "grøntsager")
    if dept == "Brød & kager" or is_(BREAD):
        return "Brød og bagværk", None
    if has(FRUIT, title) and not has(NOT_FRUIT, title) and (fresh or dept == "Frost"):
        return "Frugt", None
    if has(VEG, title) and not has(NOT_VEG, title) and (has(VEG_PREPARED, title) or f.get("storage") == "Konserves"):
        return "Grøntsager og rodfrugter", "Tilberedte grøntsager"
    if (fresh or dept == "Frost") and has(VEG, title) and not has(NOT_VEG, title):
        if has(VEG_PREPARED, title) or f.get("storage") == "Konserves":
            return "Grøntsager og rodfrugter", "Tilberedte grøntsager"
        return "Grøntsager og rodfrugter", "Rå grøntsager"
    if fresh and not has(NOT_VEG, title):
        return "Grøntsager og rodfrugter", "Rå grøntsager"
    if dept == "Brød & kager" or is_(BREAD):
        return "Brød og bagværk", None
    if dept in ("Kolonial", "Mad fra hele verden") or has(PANTRY, title) or has(PANTRY, ptype):
        return "Kolonial og tørvarer", None
    return "Forarbejdet", None


def unit_category(category, subcategory, title, quantity):
    """Product.productCategory — only drinks are shown in ml (brugerens regel):
    drinks, alcohol and drinkable dairy (not drinking yoghurt). The rest is g."""
    liquid = bool(quantity and LIQUID_RE.search(quantity))
    if category in ("Drikkevarer", "Alkohol"):
        return "DRINK"
    if category == "Mejeri og æg" and liquid and has(LIQUID_DAIRY, title) and not has(r"yoghurt|yogurt|skyr", title):
        return "DRINK"
    if category in ("Grøntsager og rodfrugter", "Frugt"):
        return "VEGETABLES"
    if subcategory in ("Rå kød", "Rå fisk"):
        return "RAW"
    return "PROCESSED"

PACKAGING_WORDS = [
    (r"\b(dåse|dåser|tindåse|konserves)\b", "Dåse"),
    (r"\b(flaske|flasker|fl\.)", "Flaske"),
    (r"\b(karton|brik|tetra)\b", "Karton"),
    (r"\bbakke\b", "Bakke"),
    (r"\b(pose|poser)\b", "Pose"),
    (r"\bglas\b", "Glas"),
    (r"\btube\b", "Tube"),
    (r"\b(bæger|bøtte|spand)\b", "Bæger"),
    (r"\b(net|netpose)\b", "Net"),
]


def packaging(p, b, r):
    """Package shape as a recognition hint. Only from explicit words — never guessed."""
    sources = [text(r.get("is_Packaging")) if r else None, text(b.get("Original Title")) if b else None,
               text(b.get("Product Name")) if b else None, p.get("name"), " ".join(p.get("keywords") or [])]
    joined = " ".join(s for s in sources if s).lower()
    for pattern, label in PACKAGING_WORDS:
        if re.search(pattern, joined):
            return label
    return None


def pack_count(b, r):
    v = number(b.get("Pack Count")) if b else None
    if v is None and r:
        v = number(r.get("Amount"))
    return int(v) if v else None


# ---------- images ----------


# ---------- slice weight ----------

# "18 g pr. skive", "ca. 12 g/skive", "vægt pr. skive: 20 g"
PER_SLICE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*g(?:ram)?\s*(?:pr\.?|per|/|à|a)\s*skive"
                          r"|(?:pr\.?|per)\s*skive\D{0,12}?(\d+(?:[.,]\d+)?)\s*g\b", re.I)
# "10 skiver", "ca. 8 stk. skiver", "12 tynde skiver"
SLICE_COUNT_RE = re.compile(r"(\d+)\s*(?:stk\.?\s*)?(?:\w+\s+)?skiver\b", re.I)
GRAMS_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(kg|g)\b", re.I)


def all_text(*rows):
    return " ".join(str(v) for row in rows if row for v in row.values() if isinstance(v, str))


def slice_weight(quantity, *rows):
    """Grams per slice from the stores' original texts, or None.

    Only explicit statements count: "x g pr. skive", or "N skiver" together with
    the package weight. Never guessed. A slice over 80 g is not a slice.
    """
    joined = all_text(*rows)
    m = PER_SLICE_RE.search(joined)
    if m:
        grams = float((m.group(1) or m.group(2)).replace(",", "."))
    else:
        count = SLICE_COUNT_RE.search(joined)
        weight = GRAMS_RE.search(quantity or "")
        if not count or not weight or int(count.group(1)) < 2:
            return None
        total = float(weight.group(1).replace(",", ".")) * (1000 if weight.group(2).lower() == "kg" else 1)
        grams = total / int(count.group(1))
    return round(grams, 1) if 2 <= grams <= 80 else None


def index_dir(path):
    by_stem = {}
    by_name = {}
    # A missing image folder (e.g. only the sheets are at hand) = no images.
    for name in os.listdir(path) if os.path.isdir(path) else []:
        stem, ext = os.path.splitext(name)
        by_stem.setdefault(stem.lower(), []).append(name)
        by_name[name.lower()] = name
    return by_stem, by_name


def pick_image(ean, b, r, cutouts, originals):
    if ean and ean.lower() in cutouts[0]:
        names = sorted(cutouts[0][ean.lower()], key=lambda n: not n.lower().endswith(".png"))
        return os.path.join(CUTOUT_DIR, names[0]), ["Cutout"]
    candidates = []
    if b and text(b.get("Image File")):
        candidates.append(text(b.get("Image File")))
    if ean:
        for name in originals[0].get(ean.lower(), []):
            if not name.lower().endswith(".webp"):
                candidates.append(name)
    if r and text(r.get("Image file")):
        candidates.append(text(r.get("Image file")))
    if ean:
        candidates += originals[0].get(ean.lower(), [])
    for c in candidates:
        real = originals[1].get(c.lower())
        if real:
            return os.path.join(ORIGINAL_DIR, real), []
        stem = os.path.splitext(c)[0].lower()
        if stem in originals[0]:
            return os.path.join(ORIGINAL_DIR, originals[0][stem][0]), []
    return None, []


def stem_variants(index, stem):
    """EAN, EAN_1, EAN_2 … in one folder — the admin "Dubletter" →
    Produktbilleder tab shows them on one line (docs/DECISIONS.md 2026-09-28)."""
    names = list(index[0].get(stem.lower(), []))
    for n in range(1, 10):
        names += index[0].get(f"{stem.lower()}_{n}", [])
    return names


def image_candidates(ean, b, r, cutouts, originals):
    """Every image of the winning tier, primary first (same one pick_image
    chooses): all cut-out variants if there is a cut-out, else every original
    (Bilka file, EAN variants in any format, REMA file)."""
    primary, tags = pick_image(ean, b, r, cutouts, originals)
    if primary is None:
        return []
    if "Cutout" in tags:
        folder, names, tags = CUTOUT_DIR, stem_variants(cutouts, ean), ["Cutout"]
    else:
        folder, tags = ORIGINAL_DIR, ["Original"]
        names = []
        for c in [text(b.get("Image File")) if b else None, text(r.get("Image file")) if r else None]:
            if c:
                real = originals[1].get(c.lower())
                names += [real] if real else originals[0].get(os.path.splitext(c)[0].lower(), [])
        names += stem_variants(originals, ean) if ean else []
    out = [(primary, tags)]
    seen = {os.path.basename(primary).lower()}
    for name in names:
        if name.lower() not in seen:
            seen.add(name.lower())
            out.append((os.path.join(folder, name), tags))
    return out


SOURCE_FIELDS = (
    "name", "brand", "subbrand", "productType", "variant", "flavor", "quantity", "packCount", "sliceWeightGrams",
    "productCategory", "keywords", "ingredients", "storeDescription", "allergens", "additives", "sourceUrl", "nutrition", "filters",
)


def store_record(p):
    """One store's own version of the product (ProductSourceRecord.data)."""
    return {"ean": p["ean"], "stores": p["stores"], **{k: p.get(k) for k in SOURCE_FIELDS}}


# ---------- sugar claims (docs/DECISIONS.md 2026-10-02) ----------
# Kun til søgning/filtre — vises ikke som mærker. Påstanden står ofte kun i
# nøgleordene (eller som ikon på emballagen), så der kigges i nøgleord, navn,
# variant, smag og produkttype; "lavt sukkerindhold" udledes desuden af sukker
# pr. 100 g (EU: højst 5 g pr. 100 g, drikkevarer højst 2,5 g pr. 100 ml).
# Ikon-alene-påstande kan ikke aflæses her og må tilføjes manuelt i admin.

SUGAR_CLAIMS = (
    ("sugarFree", "Sukkerfri", re.compile(r"sukkerfri|sugar[\s-]?free|zuckerfrei|uden\s+sukker\b", re.I)),
    # "u. tilsat sukker" (Bilka's titles) and "Ikke tilsat sukker" (REMA's label).
    ("noAddedSugar", "Uden tilsat sukker",
     re.compile(r"(uden|ingen|ikke|\bu\.?)\s+tilsat(te)?\s+sukker|no\s+added\s+sugars?|ohne\s+(zuckerzusatz|zusatz\s+von\s+zucker)", re.I)),
    ("reducedSugar", "Reduceret sukker",
     re.compile(r"reduceret\s+sukker|sukkerreduceret|mindre\s+sukker|reduced\s+sugar|weniger\s+zucker", re.I)),
    ("lightSugar", "Light", re.compile(r"\blight\b", re.I)),
    ("lowSugar", "Lavt sukkerindhold",
     re.compile(r"lavt\s+sukkerindhold|lav\s+sukker|low\s+(in\s+)?sugar|wenig\s+zucker", re.I)),
)
LOW_SUGAR_SOLID_G = 5.0
LOW_SUGAR_DRINK_G = 2.5


def sugar_claims(filters, keywords, name, variant, flavor, product_type, sugars, is_drink):
    """Fills sugarFree/lowSugar/noAddedSugar/reducedSugar/lightSugar on `filters`.
    "Sukkerfri"/"uden sukker" in the texts of a product that declares more
    than 0.5 g sugars (the EU limit) means "Uden tilsat sukker" — the
    filter Sukkerfri only shows truly sugar-free products (brugerens valg
    2026-10-02). A shop's own Sukkerfri badge (_is_sugar_free) is kept."""
    haystack = " | ".join(filter(None, [*keywords, name, variant, flavor, product_type]))
    for key, label, pattern in SUGAR_CLAIMS:
        if pattern.search(haystack):
            if key == "sugarFree" and sugars is not None and sugars > 0.5:
                key, label = "noAddedSugar", "Uden tilsat sukker"
            filters[key] = filters.get(key) or label
        else:
            filters.setdefault(key, None)
    limit = LOW_SUGAR_DRINK_G if is_drink else LOW_SUGAR_SOLID_G
    if not filters.get("lowSugar") and sugars is not None and sugars <= limit:
        filters["lowSugar"] = "Lavt sukkerindhold"
    # Sukkerfri er også lavt på sukker (EU: højst 0,5 g).
    if filters.get("sugarFree") and not filters.get("lowSugar"):
        filters["lowSugar"] = "Lavt sukkerindhold"
    return filters


# ---------- build ----------


def url_key(v):
    return (text(v) or "").lower().rstrip("/")


def external_id(ean, b, r):
    """The EAN or, for a row without one, the shop's own product id from its URL."""
    if ean:
        return ean
    shop_id = re.search(r"/(\d+)$", url_key(b.get("Source URL") if b else r.get("Source url")))
    return f"{'bilka' if b else 'rema1000'}-{shop_id.group(1)}" if shop_id else None


def build_product(ean, b, r, b_info, r_info, cutouts, originals, vitamins=None):
    alcoholic = alcohol_hint(b, r)
    bn, b_notes = nutrition(b_info, BILKA_NUTRITION, alcoholic)
    rn, r_notes = nutrition(r_info, REMA_NUTRITION, alcoholic)
    nut = dict(rn)
    nut.update(bn)  # Bilka wins, REMA fills blanks.
    # kJ from one store beside kcal from the other may disagree; the app uses kcal.
    if ("energyKj" in bn) != ("kcal" in bn) and "energyKj" in nut and "kcal" in nut:
        if not energy_consistent(nut["energyKj"], nut["kcal"]):
            nut.pop("energyKj")
    bx, rx = info_extra(b_info), info_extra(r_info)

    quantity = fix_decimals(first(text(b.get("Quantity")) if b else None, text(r.get("Quantity")) if r else None))
    brand = first(text(b.get("Brand")) if b else None, text(r.get("Brand")) if r else None)
    product_type = first(text(b.get("Product Type")) if b else None, text(r.get("Product type")) if r else None)
    category = product_category(b, r, quantity, product_type)
    is_drink = category == "DRINK"

    rf = rema_filters(r, is_drink) if r else None
    # "Sukkerfri" in the REMA sheet is REMA's label "Ikke tilsat sukker"; only
    # at or below the EU limit of 0.5 g sugars is the product sugar free
    # (brugerens valg 2026-10-02). Above it, sugar_claims makes the title's
    # "(Sukkerfri)" a "Uden tilsat sukker".
    if rf and rf["sugarFree"] and NO_ADDED_SUGAR & set(rx.get("labels", [])) and rn.get("sugars", 0) > 0.5:
        rf["sugarFree"] = None
    filters = merge_filters(bilka_filters(b) if b else None, rf)
    if not filters.get("countryOfOrigin"):
        filters["countryOfOrigin"] = first(bx.get("country"), rx.get("country"))

    keywords = []
    if b:
        keywords += [text(b.get(f"Keyword {i}")) for i in range(1, 6)]
    if r:
        keywords += rema_keywords(r, is_drink)
    seen = set()
    keywords = [k for k in keywords if k and not (k.lower() in seen or seen.add(k.lower()))]
    # The shops' badges first: "Ikke tilsat sukker" becomes a keyword that the
    # sugar claims below read.
    apply_labels(filters, keywords, bx.get("labels", []) + rx.get("labels", []), rx.get("additional"))
    # REMA's "Light" i is_sugar_free-kolonnen ender som nøgleord (se
    # rema_keywords) og fanges derfor også af sukkerpåstandene her.
    sugar_claims(
        filters,
        keywords,
        bilka_name(b) if b else rema_name(r, brand),
        first(text(b.get("Variation")) if b else None, text(r.get("Variant")) if r else None),
        first(bx.get("flavor"), text(r.get("taste")) if r else None, rx.get("flavor")),
        product_type,
        nut.get("sugars"),
        is_drink,
    )

    images = image_candidates(ean, b, r, cutouts, originals)
    image_path, image_tags = images[0] if images else (None, [])
    stores = (["Bilka"] if b else []) + (["Rema 1000"] if r else [])

    product = {
        "ean": ean,
        "externalId": external_id(ean, b, r),
        "stores": stores,
        "externalSource": "BILKA" if b else "REMA1000",
        "name": bilka_name(b) if b else rema_name(r, brand),
        "brand": brand,
        "subbrand": first(text(b.get("Subbrand")) if b else None, text(r.get("Subbrand")) if r else None),
        "productType": product_type,
        "variant": first(text(b.get("Variation")) if b else None, text(r.get("Variant")) if r else None),
        "flavor": first(bx.get("flavor"), text(r.get("taste")) if r else None, rx.get("flavor")),
        "quantity": quantity,
        "packCount": pack_count(b, r),
        "sliceWeightGrams": slice_weight(quantity, b, r, b_info, r_info),
        "productCategory": category,
        "storeDepartment": text(b.get("Category")) if b else None,
        "keywords": keywords,
        "ingredients": first(bx.get("ingredients"), rx.get("ingredients")),
        "storeDescription": first(bx.get("description"), rx.get("description")),
        "allergens": split_list(first(bx.get("allergens"), rx.get("allergens"))),
        "additives": split_list(bx.get("additives")),
        "sourceUrl": first(text(b.get("Source URL")) if b else None, text(r.get("Source url")) if r else None),
        "nutrition": nut,
        "micronutrients": micronutrients(b_info, vitamins),
        "filters": filters,
        "image": os.path.basename(image_path) if image_path else None,
        "imageTags": image_tags,
        "_imagePaths": images,
        # Checklist: the notes of the store whose energy the product uses.
        "_notes": b_notes if "kcal" in bn else b_notes + r_notes,
    }
    product["category"], product["subcategory"] = classify(product, b, r)
    product["productCategory"] = unit_category(
        product["category"], product["subcategory"], product["name"] or "", product["quantity"]
    )
    product["packaging"] = packaging(product, b, r)
    return product


def finish_nutrition(p):
    """No kcal = no usable nutrition: the product is flagged, and the agent
    keeps it hidden in the app until it has nutrition. kcal without a macro:
    the macro is 0 and marked as estimated (~). Brugerens valg 2026-10-02:
    alle varer skal med; manglende næring hentes fra Frida senere."""
    n = p["nutrition"]
    p["nutritionMissing"] = n.get("kcal") is None
    p["estimatedMacros"] = [] if p["nutritionMissing"] else [k for k in ("protein", "carbs", "fat") if n.get(k) is None]
    for k in p["estimatedMacros"]:
        n[k] = 0.0


def score(p):
    """Sample ordering: products that exercise the most fields first."""
    f = p["filters"]
    filled = sum(1 for v in f.values() if v not in (None, [], ""))
    return (len(p["stores"]), filled, len(p["nutrition"]), bool(p["ingredients"]))


def spread(items, n):
    """Takes n items round-robin across (category, subcategory), best first,
    so the sample shows every part of the category tree."""
    groups = {}
    for p in items:
        groups.setdefault((p["category"], p["subcategory"]), []).append(p)
    out = []
    while len(out) < n and any(groups.values()):
        for key in list(groups):
            if groups[key] and len(out) < n:
                out.append(groups[key].pop(0))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--all", action="store_true")
    # The full catalogue is too big for git: build it into a folder that is
    # copied to the NAS (data/store-products-import, see compose).
    ap.add_argument("--out", default=None)
    # A previous build's store_products.json (the one on the NAS): products
    # already in it keep their image fields and their files are not copied
    # again, so <out>/images only gets the images of new products.
    ap.add_argument("--images-from", default=None)
    args = ap.parse_args()
    out_dir = args.out or OUT_DIR
    out_images = os.path.join(out_dir, "images")

    bilka = load(BILKA_SHEET, "bilka")
    rema = load(REMA_SHEET, "rema")
    bilka_info_rows = load(BILKA_INFO)
    bilka_info = {ean_of(x.get("EAN")): x for x in bilka_info_rows if ean_of(x.get("EAN"))}
    # Rows without an EAN are matched on the product page instead.
    bilka_info_by_url = {url_key(x.get("Source URL")): x for x in bilka_info_rows}
    rema_info = {url_key(x.get("Source URL")): x for x in load(REMA_INFO)}
    vitamins = {url_key(x.get("Source URL")): x for x in load(BILKA_VITAMINS)} if os.path.isfile(BILKA_VITAMINS) else {}

    cutouts = index_dir(CUTOUT_DIR)
    originals = index_dir(ORIGINAL_DIR)

    rows = {}
    for b in bilka:
        key = external_id(ean_of(b.get("EAN")), b, None)
        if key:
            rows.setdefault(key, [None, None])[0] = b
    for r in rema:
        key = external_id(ean_of(r.get("EAN")), None, r)
        if key:
            rows.setdefault(key, [None, None])[1] = r

    products = []
    for key, (b, r) in rows.items():
        ean = key if EAN_RE.match(key) else None
        b_info = (bilka_info.get(ean) if ean else bilka_info_by_url.get(url_key(b.get("Source URL")))) if b else None
        r_info = rema_info.get(url_key(r.get("Source url"))) if r else None
        p = build_product(ean, b, r, b_info, r_info, cutouts, originals, vitamins.get(url_key(b.get("Source URL"))) if b else None)
        finish_nutrition(p)
        if b and r:
            # Both chains: keep each store's own fields so admin can compare
            # them side by side under "Dubletter" → Produkter.
            p["sources"] = {
                "BILKA": store_record(build_product(ean, b, None, b_info, None, cutouts, originals)),
                "REMA1000": store_record(build_product(ean, None, r, None, r_info, cutouts, originals)),
            }
        products.append(p)

    suspects = [p for p in products if p.get("_suspect") or p["_notes"]]
    with open(SUSPECT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["EAN", "Kæde", "Navn", "Produkttype i arket", "Kødtype i arket", "Problem"])
        for p in suspects:
            problem = "; ".join(filter(None, [p.get("_suspect"), *p["_notes"]]))
            w.writerow([p["externalId"], ", ".join(p["stores"]), p["name"], p["productType"], p.get("_sheetMeat") or "", problem])
    print(f"{len(suspects)} suspicious rows -> {SUSPECT_CSV}")
    for p in products:
        p.pop("_suspect", None)
        p.pop("_sheetMeat", None)
        p.pop("_notes", None)

    if not args.all:
        usable = [p for p in products if p["image"] and not p["nutritionMissing"]]
        both = sorted([p for p in usable if len(p["stores"]) == 2], key=score, reverse=True)
        bilka_only = sorted([p for p in usable if p["stores"] == ["Bilka"]], key=score, reverse=True)
        rema_only = sorted([p for p in usable if p["stores"] == ["Rema 1000"]], key=score, reverse=True)
        n_both = args.limit * 2 // 5
        n_bilka = args.limit * 2 // 5
        products = spread(both, n_both) + spread(bilka_only, n_bilka) + spread(rema_only, args.limit - n_both - n_bilka)

    previous = {}
    if args.images_from:
        with open(args.images_from, "r", encoding="utf-8") as f:
            previous = {old.get("externalId") or old["ean"]: old for old in json.load(f)}
    elif os.path.isdir(out_images):
        shutil.rmtree(out_images)
    os.makedirs(out_images, exist_ok=True)
    for p in products:
        paths = p.pop("_imagePaths")
        old = previous.get(p["externalId"])
        if old:
            p["images"], p["image"], p["imageTags"] = old.get("images") or [], old.get("image"), old.get("imageTags") or []
            continue
        # Primary = "<EAN>.<ext>" as before; further variants "<EAN>_2.<ext>" …
        p["images"] = []
        for i, (src, tags) in enumerate(paths):
            ext = os.path.splitext(src)[1].lower()
            name = f"{p['externalId']}{ext}" if i == 0 else f"{p['externalId']}_{i + 1}{ext}"
            target = os.path.join(out_images, name)
            if not (os.path.isfile(target) and os.path.getsize(target) == os.path.getsize(src)):
                shutil.copyfile(src, target)
            p["images"].append({"file": name, "tags": tags})
        p["image"] = p["images"][0]["file"] if p["images"] else None

    with open(os.path.join(out_dir, "store_products.json"), "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(products)} products; "
          f"without nutrition={sum(p['nutritionMissing'] for p in products)} "
          f"estimated macros={sum(bool(p['estimatedMacros']) for p in products)} "
          f"without EAN={sum(not p['ean'] for p in products)} "
          f"both={sum(len(p['stores']) == 2 for p in products)} "
          f"cutouts={sum('Cutout' in p['imageTags'] for p in products)} "
          f"no_image={sum(not p['image'] for p in products)}")


if __name__ == "__main__":
    main()
