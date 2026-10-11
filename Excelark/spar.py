from __future__ import annotations

import re
import sys
import time
import traceback
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font

# ============================================================
# Fixed Hello Cal scraper structure
# ============================================================
RETAILER = "spar"
ROOT_DIR = Path(r"C:\Users\Peter\Desktop\Hello Cal\Productdatabase\SPAR")
IMAGES_DIR = ROOT_DIR / "Images"
TEMP_DIR = ROOT_DIR / "Temp"
CHECKPOINT_PATTERN = f"{RETAILER}_checkpoint_*.xlsx"
PRODUCT_FILE = ROOT_DIR / f"{RETAILER}.xlsx"
PRODUCT_INFO_FILE = ROOT_DIR / f"{RETAILER}_product_information.xlsx"

# SPAR runs one separate webshop per city/store ("Spartid"), each with its own
# merchant id and its own assortment - there is no single site that covers
# 100% of SPAR. This scraper runs every known store below in one pass;
# products already saved from an earlier store are recognised by EAN/SKU and
# skipped, so only genuinely new products are added. To add a store found
# later, resolve its merchant id (GET https://<slug>.spar.dk/ and read the
# "merchantId":NNNN embedded in the raw HTML - no browser needed) and append
# it to STORES.
API_BASE = "https://longjohnapi.azurewebsites.net"
CATEGORY_URL = f"{API_BASE}/Category"
PRODUCT_QUERY_URL = f"{API_BASE}/Product/query"
PRODUCT_DETAIL_URL = f"{API_BASE}/Product/Sku"


@dataclass(frozen=True)
class Store:
    slug: str
    merchant_id: int

    @property
    def base_url(self) -> str:
        return f"https://{self.slug}.spar.dk"


# Resolved from spar.dk/spartid's store list (2026-09-06). "christiansvej"
# and "simonsbakke" from that list did not resolve to a live subdomain and
# are left out until their correct slug is found.
STORES = [
    Store("aakirkeby", 1219),
    Store("glostrup", 1222),
    Store("borup", 1189),
    Store("hirtshals", 1225),
    Store("norrebro", 1229),
    Store("stoholm", 1226),
    Store("struervej", 1228),
    Store("valsgard", 1231),
    Store("arden", 1243),
    Store("as-vig", 1262),
    Store("asaa", 1188),
    Store("bjerringbro", 1275),
    Store("blavand", 1241),
    Store("blokhus", 1224),
    Store("borbjerg", 1251),
    Store("brovst", 1227),
    Store("ebberup", 1190),
    Store("erslev", 1327),
    Store("gjern", 1294),
    Store("groefthoej", 1320),
    Store("horne", 1214),
    Store("hornsyld", 1277),
    Store("humlum", 1337),
    Store("jebjerg", 1296),
    Store("karrebaeksminde", 1285),
    Store("kastetvej", 1271),
    Store("koldby", 772),
    Store("nordensalle", 1298),
    Store("nors", 1213),
    Store("nykoebingf", 1321),
    Store("obronderslev", 1216),
    Store("ornhoj", 1254),
    Store("risskov", 1267),
    Store("rorvigvej", 1253),
    Store("skallerup", 1217),
    Store("skals", 1276),
    Store("stubbekoebing", 1301),
    Store("thyboron", 1284),
    Store("tved", 767),
    Store("ullerslev", 1281),
    Store("vadum", 770),
    Store("visse", 1283),
    Store("vissenbjerg", 768),
]

PAGE_SIZE = 100
CHECKPOINT_EVERY = 40
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 1.5

KCAL_PER_KJ = 1 / 4.184

# This is a food database. SPAR's own category tree also covers personal
# care, household, baby and pet products - out of scope, same convention as
# nemlig.py / bilka.py (Danish grocery scrapers only cover food and drink).
# "Kiosk - slik og snack" mixes food with tobacco, magazines and medicine, so
# that one is filtered at the subcategory level instead of excluded whole.
EXCLUDED_TOP_CATEGORIES = {
    "Personlig pleje",
    "Baby og børn",
    "Husholdning",
    "Dyrenes verden",
}
EXCLUDED_SUBCATEGORIES = {
    "Tobak og tilbehør",
    "Blade og magasiner",
    "Håndkøbsmedicin",
    "Forkølelse",
    "Hovedpine og feber",
    "Prævention",
}

# No brand field exists anywhere in SPAR's product data (checked both the
# API and the rendered product page) - only a free-text product name. Some
# names start with a real brand ("Kellogg's", "Marvel"), others start with
# an internal supplier code that only looks like one ("Fp", "Gb"). Guessing
# would silently plant wrong brands, so Brand is left blank and flagged
# instead (per explicit decision - do not guess a brand from the title).
PRODUCT_HEADERS = [
    "HelloCal_Title",
    "Product Name",
    "Original Title",
    "Quantity",
    "Brand",
    "EAN",
    "Pack Count",
    "Category",
    "Subcategory",
    "Keyword 1",
    "Keyword 2",
    "Keyword 3",
    "Keyword 4",
    "Keyword 5",
    "Source URL",
    "Manufacturer",
    "Image File",
    "Parse Status",
]

PRODUCT_INFO_HEADERS = [
    "HelloCal_Title",
    "Energy kJ per 100 g",
    "Energy kcal per 100 g",
    "Fat per 100 g",
    "Saturated Fat per 100 g",
    "Carbohydrate per 100 g",
    "Sugars per 100 g",
    "Fibre per 100 g",
    "Protein per 100 g",
    "Salt per 100 g",
    "Ingredients",
    "Allergens",
    "Storage",
    "Country of Origin",
    "Additional Product Information",
    "Source URL",
]

NUTRIENT_FIELD_MAP = {
    "fedt": "Fat per 100 g",
    "heraf maettede fedtsyrer": "Saturated Fat per 100 g",
    "kulhydrater": "Carbohydrate per 100 g",
    "heraf sukkerarter": "Sugars per 100 g",
    "kostfibre": "Fibre per 100 g",
    "protein": "Protein per 100 g",
    "salt": "Salt per 100 g",
}

NUTRIENT_UNIT_MAP = {
    "kilojoule": "kJ",
    "kilokalorier": "kcal",
    "gram": "g",
    "milligram": "mg",
    "mikrogram": "µg",
}

QUANTITY_UNIT_MAP = {
    "gr": "g",
    "g": "g",
    "kg": "kg",
    "mg": "mg",
    "ml": "ml",
    "cl": "cl",
    "l": "l",
    "st": "stk",
    "stk": "stk",
}


@dataclass
class Category:
    id: int
    name: str
    top_name: str


@dataclass
class ScrapeState:
    products: list[dict[str, Any]] = field(default_factory=list)
    product_information: list[dict[str, Any]] = field(default_factory=list)
    # (merchant_id, category_id) - category ids are shared/reused across
    # stores, so "seen" must be scoped per store or every store after the
    # first would look already-done and get skipped without ever being
    # queried (a real bug caught while scraping the second store).
    seen_categories: set[tuple[int, int]] = field(default_factory=set)
    processed_skus: set[str] = field(default_factory=set)
    failed_skus: set[str] = field(default_factory=set)


# ============================================================
# General helpers
# ============================================================
def ensure_directories() -> None:
    ROOT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_key(text: str) -> str:
    # NFKD does not decompose æ/ø/å (they are not composed of a base letter
    # + combining mark), so without this they would be dropped entirely
    # instead of transliterated - breaking lookups like "mættede fedtsyrer".
    text = (text or "").replace("æ", "ae").replace("Æ", "AE")
    text = text.replace("ø", "o").replace("Ø", "O")
    text = text.replace("å", "aa").replace("Å", "AA")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def safe_filename(text: str, fallback: str = "product") -> str:
    text = clean_text(text)
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", text)
    text = re.sub(r"\s+", " ", text).strip(" ._")
    return (text[:180] or fallback).strip()


def first_nonempty(*values: Any) -> str:
    for value in values:
        value = clean_text(value)
        if value:
            return value
    return ""


def parse_number(text: Any) -> str:
    text = clean_text(text)
    if not text:
        return ""
    match = re.search(r"-?\d+(?:[.,]\d+)?", text)
    if not match:
        return ""
    number = match.group(0).replace(",", ".")
    if number.endswith(".0"):
        number = number[:-2]
    return number


def tighten_quantity(quantity: str) -> str:
    quantity = clean_text(quantity)
    return re.sub(r"(\d)\s+([a-zA-Z]+)$", r"\1\2", quantity)


def build_key(brand: str, title: str, quantity: str) -> str:
    """"Title, Quantity (Brand)" - same shape as nemlig.py / dm.py. Brand is
    omitted entirely (no parens) when unknown, instead of leaving "()"."""
    name = clean_text(title)
    if quantity:
        name = f"{name}, {tighten_quantity(quantity)}"
    if brand:
        name = f"{name} ({clean_text(brand)})"
    return clean_text(name)


def parse_quantity(summary: str) -> tuple[str, bool]:
    """SPAR's "summary" field is already just "<number> <unit>" (e.g. "375
    GR", "1 KG", "8 KG"). Returns (quantity, ok) - ok is False when the unit
    is missing/unrecognised (SPAR's own data has a handful of broken units
    stored as "_", e.g. "750 _") so the raw text is kept instead of guessed."""
    text = clean_text(summary)
    match = re.match(r"^([\d.,]+)\s*([A-Za-z_]+)\.?$", text)
    if not match:
        return text, False
    number, unit = match.groups()
    mapped = QUANTITY_UNIT_MAP.get(unit.lower())
    if not mapped:
        return text, False
    number = number.replace(",", ".")
    if number.endswith(".0"):
        number = number[:-2]
    return f"{number}{mapped}", True


def parse_pack_count(text: str) -> str:
    match = re.search(r"\b(\d+)\s*[x×]\s*\d", clean_text(text), flags=re.IGNORECASE)
    return match.group(1) if match else ""


def extract_keywords(title: str, category: str, subcategory: str) -> list[str]:
    words = re.findall(r"[A-Za-zÆØÅæøåÄÖÜäöü0-9][A-Za-zÆØÅæøåÄÖÜäöü0-9\-]+", title or "")
    stop = {
        "med", "uden", "og", "eller", "til", "fra", "for", "the", "with", "and", "of",
        "stk", "gram", "kg", "g", "ml", "cl", "l", "liter",
    }
    category_words = normalize_key(category).split() + normalize_key(subcategory).split()
    result: list[str] = []
    seen: set[str] = set()
    for word in words:
        key = normalize_key(word)
        if not key or key in stop or key in category_words or key.isdigit() or len(key) < 3:
            continue
        if key in seen:
            continue
        seen.add(key)
        result.append(clean_text(word))
        if len(result) >= 5:
            break
    return result


def parse_nutrient_entry(quantity_text: str) -> tuple[str, str]:
    """"1559 Kilojoule" -> ("1559", "kJ"); "2.1 Gram" -> ("2.1", "g")."""
    match = re.match(r"^([\d.,]+)\s*(\S+)$", clean_text(quantity_text))
    if not match:
        return "", ""
    number, unit = match.groups()
    number = number.replace(",", ".")
    if number.endswith(".0"):
        number = number[:-2]
    unit_key = normalize_key(unit)
    return number, NUTRIENT_UNIT_MAP.get(unit_key, unit)


def build_nutrition(product_nutrines: list[dict[str, Any]] | None) -> tuple[dict[str, str], dict[str, str]]:
    """Returns (fixed nutrition fields, dynamic extra fields e.g. vitamins).
    SPAR reports either kJ or kcal for energy (never consistently both) - the
    missing one is derived by conversion so both columns are always filled
    when at least one was reported."""
    result = {h: "" for h in PRODUCT_INFO_HEADERS if h.endswith("per 100 g")}
    extra: dict[str, str] = {}
    energy_kj = ""
    energy_kcal = ""

    for entry in product_nutrines or []:
        name = clean_text(entry.get("name"))
        norm_name = normalize_key(name)
        number, unit = parse_nutrient_entry(entry.get("quantity") or "")
        if not number:
            continue
        if norm_name == "energi":
            if unit == "kJ":
                energy_kj = number
            elif unit == "kcal":
                energy_kcal = number
            continue
        field_name = NUTRIENT_FIELD_MAP.get(norm_name)
        if field_name:
            result[field_name] = number
        else:
            # Vitamins/minerals aren't part of the fixed schema - keep them
            # as their own dynamic column (named after the source label)
            # instead of dropping them.
            extra[f"{name} ({unit})" if unit else name] = number

    if energy_kj and not energy_kcal:
        energy_kcal = str(round(float(energy_kj) * KCAL_PER_KJ))
    elif energy_kcal and not energy_kj:
        energy_kj = str(round(float(energy_kcal) / KCAL_PER_KJ))

    result["Energy kJ per 100 g"] = energy_kj
    result["Energy kcal per 100 g"] = energy_kcal
    return result, extra


# ============================================================
# API helpers
# ============================================================
def fetch_json(url: str, params: dict[str, Any] | None = None) -> Any:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            print(f"Request attempt {attempt}/{MAX_RETRIES} failed: {url} - {exc}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
    return None


def fetch_category_tree(store: Store) -> list[dict[str, Any]]:
    data = fetch_json(CATEGORY_URL, params={"merchantId": store.merchant_id})
    return data or []


def collect_leaf_categories(nodes: list[dict[str, Any]], top_name: str | None = None) -> list[Category]:
    leaves: list[Category] = []
    for node in nodes:
        name = clean_text(node.get("name"))
        is_top = top_name is None
        top = name if is_top else top_name
        if is_top and name in EXCLUDED_TOP_CATEGORIES:
            continue
        if name in EXCLUDED_SUBCATEGORIES:
            continue
        children = node.get("subCategories") or []
        if children:
            leaves.extend(collect_leaf_categories(children, top))
        else:
            leaves.append(Category(id=node.get("id"), name=name, top_name=top))
    return leaves


def fetch_product_page(store: Store, category_id: int, page_number: int) -> dict[str, Any] | None:
    return fetch_json(
        PRODUCT_QUERY_URL,
        params={
            "merchantId": store.merchant_id,
            "pageNumber": page_number,
            "pageSize": PAGE_SIZE,
            "displayedInStore": "true",
            "categoryId": category_id,
        },
    )


def fetch_product_detail(store: Store, sku: str) -> dict[str, Any] | None:
    return fetch_json(PRODUCT_DETAIL_URL, params={"sku": sku, "merchantId": store.merchant_id})


def sniff_image_extension(content: bytes) -> str:
    """SPAR's image CDN cannot be trusted on either the URL suffix or the
    Content-Type header - files named "*.jpg" and served as "image/jpeg"
    routinely turn out to be actual PNGs (verified against live responses).
    Detect the real format from the file's own magic bytes instead."""
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if content.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
        return ".gif"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return ".webp"
    return ".jpg"


def download_image(image_url: str, ean: str, key: str) -> str:
    if not image_url:
        return ""
    stem = safe_filename(ean or key or "product")

    # Avoid re-downloading an already saved product image during resume -
    # the extension is only known after the bytes arrive, so check for any
    # extension already saved under this stem.
    for existing in IMAGES_DIR.glob(f"{stem}.*"):
        return existing.name

    try:
        response = requests.get(image_url, timeout=REQUEST_TIMEOUT)
        if not response.ok:
            print(f"Image download failed ({response.status_code}): {image_url}")
            return ""
        filename = f"{stem}{sniff_image_extension(response.content)}"
        (IMAGES_DIR / filename).write_bytes(response.content)
        return filename
    except Exception as exc:
        print(f"Image download failed: {image_url} - {exc}")
        return ""


# ============================================================
# Product extraction
# ============================================================
def extract_product(list_item: dict[str, Any], detail: dict[str, Any] | None, category: Category, store: Store) -> tuple[dict[str, Any], dict[str, Any]]:
    sku = clean_text(list_item.get("sku"))
    title = clean_text(list_item.get("productDisplayName"))
    quantity, quantity_ok = parse_quantity(list_item.get("summary") or "")

    brand = ""  # No brand field exists anywhere in SPAR's data - see note above PRODUCT_HEADERS.
    key = build_key(brand, title, quantity)

    source_url = f"{store.base_url}/produkter/produkt-{sku}"

    image_url = first_nonempty(
        (detail or {}).get("highResImg"),
        (detail or {}).get("medResImg"),
        list_item.get("highResImg"),
        list_item.get("medResImg"),
        list_item.get("lowResImg"),
    )
    image_file = download_image(image_url, sku, key)

    manufacturer = clean_text((detail or {}).get("producer"))
    country = clean_text((detail or {}).get("countryOfOrigin"))
    storage = clean_text((detail or {}).get("storageInstructions"))
    ingredients = clean_text((detail or {}).get("ingredients"))
    description = clean_text((detail or {}).get("productDescription"))
    allergens = ", ".join(clean_text(a) for a in ((detail or {}).get("productAllergenes") or []) if clean_text(a))

    nutrition, dynamic_nutrients = build_nutrition((detail or {}).get("productNutrines"))
    nutrition_found = any(clean_text(v) for v in nutrition.values())

    keywords = extract_keywords(title, category.top_name, category.name)
    keywords += [""] * (5 - len(keywords))

    parse_status_flags: list[str] = ["MISSING_BRAND"]
    if not quantity_ok:
        parse_status_flags.append("UNKNOWN_QUANTITY_UNIT")
    if detail is None:
        parse_status_flags.append("DETAIL_FETCH_FAILED")
    if not nutrition_found:
        parse_status_flags.append("MISSING_NUTRITION_TABLE")
    if image_url and not image_file:
        parse_status_flags.append("IMAGE_DOWNLOAD_FAILED")
    parse_status = " | ".join(parse_status_flags)

    product_row = {
        "HelloCal_Title": key,
        "Product Name": clean_text(key),
        "Original Title": title,
        "Quantity": quantity,
        "Brand": brand,
        "EAN": sku,
        "Pack Count": parse_pack_count(quantity or title),
        "Category": category.top_name,
        "Subcategory": category.name,
        "Keyword 1": keywords[0],
        "Keyword 2": keywords[1],
        "Keyword 3": keywords[2],
        "Keyword 4": keywords[3],
        "Keyword 5": keywords[4],
        "Source URL": source_url,
        "Manufacturer": manufacturer,
        "Image File": image_file,
        "Parse Status": parse_status,
    }

    info_row = {
        "HelloCal_Title": key,
        **nutrition,
        "Ingredients": ingredients,
        "Allergens": allergens,
        "Storage": storage,
        "Country of Origin": country,
        "Additional Product Information": description,
        **dynamic_nutrients,
        "Source URL": source_url,
    }

    return product_row, info_row


# ============================================================
# Workbook helpers
# ============================================================
def style_header(ws) -> None:
    for cell in ws[1]:
        cell.font = Font(bold=True)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions


def dynamic_headers(base_headers: list[str], rows: list[dict[str, Any]]) -> list[str]:
    headers = list(base_headers)
    seen = set(headers)
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                headers.append(key)
    return headers


def write_rows_to_workbook(path: Path, sheet_name: str, headers: list[str], rows: list[dict[str, Any]]) -> None:
    headers = dynamic_headers(headers, rows)
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(headers)
    for row in rows:
        ws.append([row.get(header, "") for header in headers])
    style_header(ws)
    wb.save(path)


def save_final_files(state: ScrapeState) -> None:
    try:
        write_rows_to_workbook(PRODUCT_FILE, "Products", PRODUCT_HEADERS, state.products)
        write_rows_to_workbook(PRODUCT_INFO_FILE, "Product Information", PRODUCT_INFO_HEADERS, state.product_information)
    except PermissionError:
        print(f"Could not save {PRODUCT_FILE.name} / {PRODUCT_INFO_FILE.name} - file is open elsewhere. Skipped.")


def save_temp(state: ScrapeState) -> None:
    wb = Workbook()

    product_headers = dynamic_headers(PRODUCT_HEADERS, state.products)
    ws_products = wb.active
    ws_products.title = "Products"
    ws_products.append(product_headers)
    for row in state.products:
        ws_products.append([row.get(header, "") for header in product_headers])
    style_header(ws_products)

    info_headers = dynamic_headers(PRODUCT_INFO_HEADERS, state.product_information)
    ws_info = wb.create_sheet("Product Information")
    ws_info.append(info_headers)
    for row in state.product_information:
        ws_info.append([row.get(header, "") for header in info_headers])
    style_header(ws_info)

    ws_state = wb.create_sheet("State")
    ws_state.append(["Type", "Value"])
    for merchant_id, category_id in sorted(state.seen_categories):
        ws_state.append(["category_seen", f"{merchant_id}:{category_id}"])
    for sku in sorted(state.processed_skus):
        ws_state.append(["processed_sku", sku])
    for sku in sorted(state.failed_skus):
        ws_state.append(["failed_sku", sku])
    style_header(ws_state)

    checkpoint_file = TEMP_DIR / f"{RETAILER}_checkpoint_{len(state.products):07d}.xlsx"
    try:
        wb.save(checkpoint_file)
        print(f"Checkpoint saved: {checkpoint_file} ({len(state.products)} products)")
    except PermissionError:
        print(f"Could not save checkpoint {checkpoint_file.name} - file is open elsewhere. Skipped.")


def latest_checkpoint_file() -> Path | None:
    checkpoints = sorted(TEMP_DIR.glob(CHECKPOINT_PATTERN))
    return checkpoints[-1] if checkpoints else None


def load_temp() -> ScrapeState:
    state = ScrapeState()
    checkpoint_file = latest_checkpoint_file()
    if checkpoint_file is None:
        return state

    try:
        wb = load_workbook(checkpoint_file, read_only=True, data_only=True)

        if "Products" in wb.sheetnames:
            ws = wb["Products"]
            rows = ws.iter_rows(values_only=True)
            headers = [clean_text(x) for x in next(rows)]
            for values in rows:
                row = {headers[i]: values[i] if i < len(values) else "" for i in range(len(headers))}
                if any(clean_text(v) for v in row.values()):
                    state.products.append(row)

        if "Product Information" in wb.sheetnames:
            ws = wb["Product Information"]
            rows = ws.iter_rows(values_only=True)
            headers = [clean_text(x) for x in next(rows)]
            for values in rows:
                row = {headers[i]: values[i] if i < len(values) else "" for i in range(len(headers))}
                if any(clean_text(v) for v in row.values()):
                    state.product_information.append(row)

        if "State" in wb.sheetnames:
            ws = wb["State"]
            for row in ws.iter_rows(min_row=2, values_only=True):
                kind = clean_text(row[0]).lower() if row else ""
                value = clean_text(row[1]) if len(row) > 1 else ""
                if not value:
                    continue
                if kind == "category_seen":
                    # Old pre-fix checkpoints stored a bare category id with
                    # no store scope (the bug above) - those can't be
                    # trusted to belong to the right store, so they are
                    # discarded rather than migrated; affected categories
                    # simply get re-verified once.
                    if ":" in value:
                        merchant_str, _, cat_str = value.partition(":")
                        try:
                            state.seen_categories.add((int(merchant_str), int(cat_str)))
                        except ValueError:
                            pass
                elif kind == "processed_sku":
                    state.processed_skus.add(value)
                elif kind == "failed_sku":
                    state.failed_skus.add(value)

        wb.close()
        print(
            f"Checkpoint loaded: {len(state.products)} products, "
            f"{len(state.seen_categories)} subcategories already scanned"
        )
        return state
    except Exception as exc:
        print(f"Could not load checkpoint. Starting fresh. Reason: {exc}")
        return ScrapeState()


# ============================================================
# Crawl
# ============================================================
def crawl_store(store: Store, state: ScrapeState, existing_keys: set[str]) -> None:
    """Discover and scrape one subcategory at a time within a single store:
    fetch its product list, fetch+save each product immediately, then
    checkpoint - instead of discovering every product up front."""
    tree = fetch_category_tree(store)
    if not tree:
        print(f"  Could not reach the SPAR category API for {store.slug}.")
        return
    categories = collect_leaf_categories(tree)
    print(f"  {len(categories)} food/drink subcategories in scope")

    for category in categories:
        cat_key = (store.merchant_id, category.id)
        if cat_key in state.seen_categories:
            continue

        print(f"  Subcategory: {category.top_name} / {category.name} (id {category.id})")
        page_number = 0
        fetched = 0
        total = None
        processed_since_checkpoint = 0
        category_ok = True

        while True:
            data = fetch_product_page(store, category.id, page_number)
            if data is None:
                print(f"    Could not fetch page {page_number} - subcategory will be retried next run.")
                category_ok = False
                break

            products = data.get("products") or []
            if total is None:
                total = data.get("total", len(products))
            if not products:
                break

            for item in products:
                fetched += 1
                sku = clean_text(item.get("sku"))
                if not sku or sku in state.processed_skus:
                    continue
                if item.get("isTobacco"):
                    state.processed_skus.add(sku)
                    continue

                try:
                    detail = fetch_product_detail(store, sku)
                    product_row, info_row = extract_product(item, detail, category, store)
                    key = clean_text(product_row.get("HelloCal_Title"))
                    if key and key not in existing_keys:
                        state.products.append(product_row)
                        state.product_information.append(info_row)
                        existing_keys.add(key)
                        print(f"    Saved product: {key} | EAN: {sku} | Image: {product_row.get('Image File') or '-'}")
                    else:
                        print(f"    Duplicate skipped: {key or sku}")
                    state.processed_skus.add(sku)
                    state.failed_skus.discard(sku)
                except KeyboardInterrupt:
                    print("\nStop requested. Saving checkpoint and final files before exit...")
                    save_temp(state)
                    save_final_files(state)
                    raise
                except Exception as exc:
                    print(f"    Product failed: {sku} - {exc}")
                    traceback.print_exc()
                    state.failed_skus.add(sku)

                processed_since_checkpoint += 1
                if processed_since_checkpoint >= CHECKPOINT_EVERY:
                    save_temp(state)
                    save_final_files(state)
                    processed_since_checkpoint = 0

            if total is not None and fetched >= total:
                break
            page_number += 1

        if category_ok:
            state.seen_categories.add(cat_key)

        # Checkpoint after every subcategory, so a crash never costs more
        # than the current subcategory's progress.
        save_temp(state)
        save_final_files(state)


def crawl_and_scrape(state: ScrapeState) -> None:
    """Run every known SPAR store in one pass. A store whose subcategories
    are all already in state.seen_categories falls through in one cheap
    category-tree fetch with nothing left to do."""
    existing_keys = {clean_text(row.get("HelloCal_Title")) for row in state.products if clean_text(row.get("HelloCal_Title"))}
    existing_skus = {clean_text(row.get("EAN")) for row in state.products if clean_text(row.get("EAN"))}
    state.processed_skus |= existing_skus

    for store in STORES:
        print(f"Store: {store.slug} (merchant id {store.merchant_id})")
        crawl_store(store, state, existing_keys)


# ============================================================
# Main
# ============================================================
def main() -> None:
    ensure_directories()
    state = load_temp()

    print("SPAR scraper started")
    print(f"Stores queued: {len(STORES)}")
    print(f"Root: {ROOT_DIR}")
    print(f"Images: {IMAGES_DIR}")
    print(f"Temp checkpoint folder: {TEMP_DIR} ({CHECKPOINT_PATTERN})")
    print("Discovery mode: one store, one subcategory at a time, scraped as it is found")

    try:
        crawl_and_scrape(state)
        save_temp(state)
        save_final_files(state)
        print(f"Completed. Products saved: {len(state.products)}")
        print(f"Product file: {PRODUCT_FILE}")
        print(f"Product information file: {PRODUCT_INFO_FILE}")
        print(f"Images saved directly in: {IMAGES_DIR}")
    except KeyboardInterrupt:
        raise


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Stopped by user.")
        sys.exit(130)
