"""
Builds data/store_products.json (+ data/images/) for store-products-agent
from the hand-cleaned Bilka and REMA 1000 product sheets. Runs locally on the
workstation (the sheets and images are not in the repository); the agent
container then only reads the JSON. Column mapping: docs/PRODUCT_IMPORT_MAPPING.md.

Rules (docs/DECISIONS.md 2026-09-27 "Butiksvarer i tre tabeller"):
- One product per EAN. Bilka wins on conflicting fields, REMA fills blanks.
- Filter values are the word/label shown ("Økologisk"), never "Yes"/"Ja".
- Image priority: finished cut-out (tag "Cutout") > Bilka original > REMA original.
- Drinks (ml) = Bilka "Drikkevarer", REMA "Drikkevare" or a liquid quantity
  (l/cl/ml), except drinking yoghurt. Everything else is grams.

Usage: py build_data.py [--limit 50] [--all]
"""

import argparse
import json
import os
import re
import shutil

import openpyxl

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "Hello Cal"))
SHEETS = os.path.join(ROOT, "Produkter klar til import", "Produktark")
BILKA_SHEET = os.path.join(SHEETS, "bilka.xlsx")
REMA_SHEET = os.path.join(SHEETS, "rema1000_version 2.xlsx")
BILKA_INFO = os.path.join(ROOT, "Productdatabase", "Bilka", "bilka_product_information.xlsx")
REMA_INFO = os.path.join(ROOT, "Productdatabase", "REMA1000", "rema1000_product_information.xlsx")
CUTOUT_DIR = os.path.join(ROOT, "Produkter klar til import", "Færdige produktbilleder")
ORIGINAL_DIR = os.path.join(ROOT, "Productdatabase", "Product Images")

OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUT_IMAGES = os.path.join(OUT_DIR, "images")

EAN_RE = re.compile(r"^\d{8,14}$")


def load(path):
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


def nutrition(info, mapping):
    if not info:
        return {}
    out = {}
    for key, (col, energy) in mapping.items():
        v = number(info.get(col), energy=energy)
        if v is not None and v >= 0:
            out[key] = v
    # Drop values that cannot be right (a part larger than its whole).
    if "sugars" in out and "carbs" in out and out["sugars"] > out["carbs"] + 0.5:
        out.pop("sugars")
    for part in ("saturatedFat", "monounsaturatedFat", "polyunsaturatedFat"):
        if part in out and "fat" in out and out[part] > out["fat"] + 0.5:
            out.pop(part)
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
        "fatPercent": number(r.get("fat")),
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
    out = [k for k in [text(r.get("Keyword 1"))] if k]
    packaging = text(r.get("is_Packaging"))
    if packaging and packaging.lower() not in REMA_STORAGE:
        out.append(packaging)
    if text(r.get("is_sugar_free")) == "Light":
        out.append("Light")
    if text(r.get("%")) and not is_alcoholic(r):
        out.append(text(r.get("%")))
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
    """The sheet cleanup turned "0,4%" into "0, 4%" — glue decimals back."""
    return re.sub(r"(\d), (\d)", r"\1,\2", s) if s else s


def strip_title(title):
    title = re.sub(r"\s*\([^()]*\)\s*$", "", fix_decimals(title or ""))
    title = re.sub(r",\s*(\d+\s*x\s*)?[\d.,]+\s*(g|kg|ml|cl|dl|l|stk)\.?\s*$", "", title, flags=re.I)
    return title.strip(" ,")


def bilka_name(b):
    """HelloCal_Title is "Name, quantity (Brand)" — the name is the part before.
    The cleanup cut abbreviations ("u. tilsat sukker" → "u"); then the
    uncut Product Name is used instead."""
    name = strip_title(text(b.get("HelloCal_Title")))
    if not name or re.search(r"\s\w$", name):
        name = strip_title(text(b.get("Product Name"))) or name
    return name or text(b.get("HelloCal_Title"))


def rema_name(r, brand):
    """REMA titles start with the brand ("Friland Hakket oksekød"); the brand
    is its own field, so it is not repeated in the name."""
    name = text(r.get("Hello Cal product title")) or ""
    if brand and name.lower().startswith(brand.lower() + " "):
        name = name[len(brand) + 1:]
    return name.strip() or text(r.get("Hello Cal product title"))


def pack_count(b, r):
    v = number(b.get("Pack Count")) if b else None
    if v is None and r:
        v = number(r.get("Amount"))
    return int(v) if v else None


# ---------- images ----------


def index_dir(path):
    by_stem = {}
    by_name = {}
    for name in os.listdir(path):
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


# ---------- build ----------


def build_product(ean, b, r, b_info, r_info, cutouts, originals):
    bn = nutrition(b_info, BILKA_NUTRITION)
    rn = nutrition(r_info, REMA_NUTRITION)
    nut = dict(rn)
    nut.update(bn)  # Bilka wins, REMA fills blanks.
    bx, rx = info_extra(b_info), info_extra(r_info)

    quantity = fix_decimals(first(text(b.get("Quantity")) if b else None, text(r.get("Quantity")) if r else None))
    brand = first(text(b.get("Brand")) if b else None, text(r.get("Brand")) if r else None)
    product_type = first(text(b.get("Product Type")) if b else None, text(r.get("Product type")) if r else None)
    category = product_category(b, r, quantity, product_type)
    is_drink = category == "DRINK"

    filters = merge_filters(bilka_filters(b) if b else None, rema_filters(r, is_drink) if r else None)
    if not filters.get("countryOfOrigin"):
        filters["countryOfOrigin"] = first(bx.get("country"), rx.get("country"))

    keywords = []
    if b:
        keywords += [text(b.get(f"Keyword {i}")) for i in range(1, 6)]
    if r:
        keywords += rema_keywords(r, is_drink)
    seen = set()
    keywords = [k for k in keywords if k and not (k.lower() in seen or seen.add(k.lower()))]

    image_path, image_tags = pick_image(ean, b, r, cutouts, originals)
    stores = (["Bilka"] if b else []) + (["Rema 1000"] if r else [])

    return {
        "ean": ean,
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
        "productCategory": category,
        "storeDepartment": text(b.get("Category")) if b else None,
        "keywords": keywords,
        "ingredients": first(bx.get("ingredients"), rx.get("ingredients")),
        "allergens": split_list(first(bx.get("allergens"), rx.get("allergens"))),
        "additives": split_list(bx.get("additives")),
        "sourceUrl": first(text(b.get("Source URL")) if b else None, text(r.get("Source url")) if r else None),
        "nutrition": nut,
        "filters": filters,
        "image": os.path.basename(image_path) if image_path else None,
        "imageTags": image_tags,
        "_imagePath": image_path,
    }


def score(p):
    """Sample ordering: products that exercise the most fields first."""
    f = p["filters"]
    filled = sum(1 for v in f.values() if v not in (None, [], ""))
    return (len(p["stores"]), filled, len(p["nutrition"]), bool(p["ingredients"]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()

    bilka = load(BILKA_SHEET)
    rema = load(REMA_SHEET)
    bilka_info = {ean_of(x.get("EAN")): x for x in load(BILKA_INFO) if ean_of(x.get("EAN"))}
    rema_info = {text(x.get("Source URL")).lower(): x for x in load(REMA_INFO) if text(x.get("Source URL"))}

    cutouts = index_dir(CUTOUT_DIR)
    originals = index_dir(ORIGINAL_DIR)

    by_ean = {}
    for b in bilka:
        e = ean_of(b.get("EAN"))
        if e:
            by_ean.setdefault(e, [None, None])[0] = b
    for r in rema:
        e = ean_of(r.get("EAN"))
        if e:
            by_ean.setdefault(e, [None, None])[1] = r

    products = []
    skipped = {"no_macros": 0}
    for ean, (b, r) in by_ean.items():
        r_info = rema_info.get((text(r.get("Source url")) or "").lower()) if r else None
        p = build_product(ean, b, r, bilka_info.get(ean), r_info, cutouts, originals)
        n = p["nutrition"]
        if any(n.get(k) is None for k in ("kcal", "protein", "carbs", "fat")):
            skipped["no_macros"] += 1
            continue
        products.append(p)

    if not args.all:
        both = sorted([p for p in products if len(p["stores"]) == 2 and p["image"]], key=score, reverse=True)
        bilka_only = sorted([p for p in products if p["stores"] == ["Bilka"] and p["image"]], key=score, reverse=True)
        rema_only = sorted([p for p in products if p["stores"] == ["Rema 1000"] and p["image"]], key=score, reverse=True)
        n_both = args.limit * 2 // 5
        n_bilka = args.limit * 2 // 5
        products = both[:n_both] + bilka_only[:n_bilka] + rema_only[: args.limit - n_both - n_bilka]

    if os.path.isdir(OUT_IMAGES):
        shutil.rmtree(OUT_IMAGES)
    os.makedirs(OUT_IMAGES, exist_ok=True)
    for p in products:
        src = p.pop("_imagePath")
        if src:
            ext = os.path.splitext(src)[1].lower()
            p["image"] = f"{p['ean']}{ext}"
            shutil.copyfile(src, os.path.join(OUT_IMAGES, p["image"]))

    with open(os.path.join(OUT_DIR, "store_products.json"), "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(products)} products; skipped {skipped}; "
          f"both={sum(len(p['stores']) == 2 for p in products)} "
          f"cutouts={sum('Cutout' in p['imageTags'] for p in products)} "
          f"no_image={sum(not p['image'] for p in products)}")


if __name__ == "__main__":
    main()
