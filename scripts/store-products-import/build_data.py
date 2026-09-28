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

Usage: py build_data.py [--limit 50] [--all]
"""

import argparse
import csv
import json
import os
import re
import shutil

import openpyxl

# HELLO_CAL_ROOT: the main checkout (with the sheets), when run from a worktree.
ROOT = os.environ.get("HELLO_CAL_ROOT") or os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "Hello Cal")
)
SHEETS = os.path.join(ROOT, "Produkter klar til import", "Produktark")
BILKA_SHEET = os.path.join(SHEETS, "bilka.xlsx")
REMA_SHEET = os.path.join(SHEETS, "rema1000_version 2.xlsx")
BILKA_INFO = os.path.join(ROOT, "Productdatabase", "Bilka", "bilka_product_information.xlsx")
REMA_INFO = os.path.join(ROOT, "Productdatabase", "REMA1000", "rema1000_product_information.xlsx")
CUTOUT_DIR = os.path.join(ROOT, "Produkter klar til import", "Færdige produktbilleder")
ORIGINAL_DIR = os.path.join(ROOT, "Productdatabase", "Product Images")

OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUT_IMAGES = os.path.join(OUT_DIR, "images")
SUSPECT_CSV = os.path.join(SHEETS, "Tjekliste - mistænkelige rækker.csv")

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
    # Package shapes go to Product.packaging and "Færdigretter" to the category;
    # only other values (e.g. "i Skiver") stay keywords.
    for part in split_list(r.get("is_Packaging")):
        if part.lower() not in REMA_STORAGE and part.lower() not in ("bakke", "brik", "tindåse", "flaske", "færdigretter"):
            out.append(part)
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
    alcohol_free = f.get("alcohol") == "Alkoholfri" or has(r"alkoholfri|alcohol free|0,0 ?%|\b0 ?%", both)

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
    "name", "brand", "subbrand", "productType", "variant", "flavor", "quantity", "packCount",
    "productCategory", "keywords", "ingredients", "allergens", "additives", "sourceUrl", "nutrition", "filters",
)


def store_record(p):
    """One store's own version of the product (ProductSourceRecord.data)."""
    return {"ean": p["ean"], "stores": p["stores"], **{k: p.get(k) for k in SOURCE_FIELDS}}


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

    images = image_candidates(ean, b, r, cutouts, originals)
    image_path, image_tags = images[0] if images else (None, [])
    stores = (["Bilka"] if b else []) + (["Rema 1000"] if r else [])

    product = {
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
        "_imagePaths": images,
    }
    product["category"], product["subcategory"] = classify(product, b, r)
    product["productCategory"] = unit_category(
        product["category"], product["subcategory"], product["name"] or "", product["quantity"]
    )
    product["packaging"] = packaging(product, b, r)
    return product


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
    args = ap.parse_args()
    out_dir = args.out or OUT_DIR
    out_images = os.path.join(out_dir, "images")

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
        if b and r:
            # Both chains: keep each store's own fields so admin can compare
            # them side by side under "Dubletter" → Produkter.
            p["sources"] = {
                "BILKA": store_record(build_product(ean, b, None, bilka_info.get(ean), None, cutouts, originals)),
                "REMA1000": store_record(build_product(ean, None, r, None, r_info, cutouts, originals)),
            }
        products.append(p)

    suspects = [p for p in products if p.get("_suspect")]
    with open(SUSPECT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["EAN", "Kæde", "Navn", "Produkttype i arket", "Kødtype i arket", "Problem"])
        for p in suspects:
            w.writerow([p["ean"], ", ".join(p["stores"]), p["name"], p["productType"], p.get("_sheetMeat") or "", p["_suspect"]])
    print(f"{len(suspects)} suspicious rows -> {SUSPECT_CSV}")
    for p in products:
        p.pop("_suspect", None)
        p.pop("_sheetMeat", None)

    if not args.all:
        both = sorted([p for p in products if len(p["stores"]) == 2 and p["image"]], key=score, reverse=True)
        bilka_only = sorted([p for p in products if p["stores"] == ["Bilka"] and p["image"]], key=score, reverse=True)
        rema_only = sorted([p for p in products if p["stores"] == ["Rema 1000"] and p["image"]], key=score, reverse=True)
        n_both = args.limit * 2 // 5
        n_bilka = args.limit * 2 // 5
        products = spread(both, n_both) + spread(bilka_only, n_bilka) + spread(rema_only, args.limit - n_both - n_bilka)

    if os.path.isdir(out_images):
        shutil.rmtree(out_images)
    os.makedirs(out_images, exist_ok=True)
    for p in products:
        # Primary = "<EAN>.<ext>" as before; further variants "<EAN>_2.<ext>" …
        p["images"] = []
        for i, (src, tags) in enumerate(p.pop("_imagePaths")):
            ext = os.path.splitext(src)[1].lower()
            name = f"{p['ean']}{ext}" if i == 0 else f"{p['ean']}_{i + 1}{ext}"
            shutil.copyfile(src, os.path.join(out_images, name))
            p["images"].append({"file": name, "tags": tags})
        p["image"] = p["images"][0]["file"] if p["images"] else None

    with open(os.path.join(out_dir, "store_products.json"), "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=1)
    print(f"wrote {len(products)} products; skipped {skipped}; "
          f"both={sum(len(p['stores']) == 2 for p in products)} "
          f"cutouts={sum('Cutout' in p['imageTags'] for p in products)} "
          f"no_image={sum(not p['image'] for p in products)}")


if __name__ == "__main__":
    main()
