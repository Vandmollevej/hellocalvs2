"""
Lidl/Aldi-varer: find flere detaljer end vi har (docs/LIDL-ALDI-ENRICH.md).

Kører lokalt på brugerens pc om natten (run-nightly.ps1). For hver vare i
filerne fra Lidl og Aldi på dansk og tysk:

1. Stregkoden slås op i Open Food Facts.
2. Giver den 0 resultater, søges titlen i Open Food Facts.
3. Giver også det 0 resultater, og varen har et billede, bruges Google Vision
   (WEB_DETECTION) — og kun da.

Det, Open Food Facts (eller Vision) ved mere om end vores fil, skrives til et
Excel-ark: vores titel, og i kolonnerne ved siden af de nye fakta. Intet
skrives til Hello Cals database. Genoptager, hvor den slap (cache.jsonl).
"""

import argparse
import base64
import csv
import json
import logging
import os
import re
import time
import unicodedata
from datetime import datetime
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
CONFIG_FILE = HERE / "config.local.json"
HEADERS = {"User-Agent": "HelloCal-lidl-aldi-enrich/1.0 (peter@packroff.dk)"}
OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
VISION_URL = "https://vision.googleapis.com/v1/images:annotate"
OFF_FIELDS = (
    "code,product_name,product_name_da,product_name_de,generic_name,brands,quantity,ingredients_text,"
    "ingredients_text_da,ingredients_text_de,allergens_tags,traces_tags,labels,origins,countries,categories,"
    "nutriments,nutriscore_grade,nova_group,packaging"
)

log = logging.getLogger("lidl-aldi-enrich")

DEFAULTS = {
    "inputDir": "",
    "outputDir": "",
    "visionCredentials": "",
    "languages": ["da", "de"],
    "stores": ["lidl", "aldi"],
    "delaySeconds": 1.5,
    "maxMinutes": 360,
}


def load_config():
    config = dict(DEFAULTS)
    if CONFIG_FILE.exists():
        config.update(json.loads(CONFIG_FILE.read_text(encoding="utf-8")))
    for key, env in (("inputDir", "LIDL_ALDI_INPUT_DIR"), ("outputDir", "LIDL_ALDI_OUTPUT_DIR"),
                     ("visionCredentials", "GOOGLE_VISION_CREDENTIALS")):
        if os.environ.get(env):
            config[key] = os.environ[env]
    if not config["inputDir"]:
        raise SystemExit("inputDir mangler (config.local.json eller LIDL_ALDI_INPUT_DIR)")
    config.setdefault("outputDir", "")
    if not config["outputDir"]:
        config["outputDir"] = str(Path(config["inputDir"]) / "nye-fakta")
    return config


# --- tekst -------------------------------------------------------------------

def norm(text):
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def words(text):
    return {w for w in norm(text).split() if len(w) >= 3}


def key_of(text):
    return norm(text).replace(" ", "")


# --- indlæsning --------------------------------------------------------------

ALIASES = {
    "title": ["titel", "title", "name", "navn", "produkt", "produktnavn", "product", "productname", "bezeichnung"],
    "barcode": ["ean", "gtin", "barcode", "stregkode", "ean13", "upc"],
    "brand": ["brand", "maerke", "marke", "mrke", "brands"],
    "image": ["image", "imageurl", "billede", "billedeurl", "bild", "picture", "foto"],
    "language": ["language", "sprog", "lang", "sprache"],
    "ingredients": ["ingredients", "ingredienser", "indhold", "zutaten", "ingredientstext"],
    "allergens": ["allergens", "allergener", "allergene"],
    "quantity": ["quantity", "maengde", "vaegt", "weight", "netto", "menge", "inhalt", "pakning", "size"],
    "origin": ["origin", "oprindelse", "herkunft", "oprindelsesland"],
    "categories": ["categories", "kategori", "kategorie", "category"],
    "kcal": ["kcal", "energikcal", "energy", "energi", "brennwert"],
    "fat": ["fedt", "fat", "fett"],
    "saturated": ["maettetfedt", "maettedefedtsyrer", "saturatedfat", "saturates", "gesaettigtefettsaeuren"],
    "carbs": ["kulhydrat", "kulhydrater", "carbohydrates", "carbs", "kohlenhydrate"],
    "sugars": ["sukker", "sugars", "sugar", "zucker", "heraf sukkerarter"],
    "fiber": ["fiber", "kostfibre", "fibre", "ballaststoffe"],
    "protein": ["protein", "eiweiss"],
    "salt": ["salt", "salz"],
}


def column_map(headers):
    """Overskrift -> felt, ud fra ALIASES (uden hensyn til store/små bogstaver og accenter)."""
    normalized = {key_of(h): h for h in headers if h}
    mapping = {}
    for field, aliases in ALIASES.items():
        for alias in aliases:
            if key_of(alias) in normalized:
                mapping[field] = normalized[key_of(alias)]
                break
    return mapping


def read_rows(path):
    suffix = path.suffix.lower()
    if suffix == ".xlsx":
        import openpyxl

        workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
        for sheet in workbook.worksheets:
            rows = sheet.iter_rows(values_only=True)
            headers = None
            for row in rows:
                if headers is None:
                    if any(cell not in (None, "") for cell in row):
                        headers = [str(c).strip() if c is not None else "" for c in row]
                    continue
                if any(cell not in (None, "") for cell in row):
                    yield {h: ("" if v is None else v) for h, v in zip(headers, row) if h}
    elif suffix == ".csv":
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
        yield from csv.DictReader(text.splitlines(), dialect=dialect)
    elif suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        if isinstance(data, dict):
            data = data.get("products") or data.get("items") or []
        for row in data:
            if isinstance(row, dict):
                yield {k: ("" if v is None else v) for k, v in row.items()}


def file_language(path):
    name = key_of(path.stem)
    tokens = set(norm(path.stem).split())
    if tokens & {"de", "tysk", "german", "deutsch"} or "tysk" in name:
        return "de"
    if tokens & {"da", "dk", "dansk", "danish"} or "dansk" in name:
        return "da"
    return None


def load_products(config):
    """Alle varer fra Lidl-/Aldi-filer på de valgte sprog. Returnerer (varer, oversprunget)."""
    products, skipped = [], 0
    root = Path(config["inputDir"])
    out_dir = Path(config["outputDir"]).resolve()
    for path in sorted(root.rglob("*")):
        if path.suffix.lower() not in (".xlsx", ".csv", ".json") or path.name.startswith("~$"):
            continue
        if out_dir in path.resolve().parents:
            continue
        store = next((s for s in config["stores"] if s in norm(str(path.relative_to(root))).replace(" ", "")), None)
        if not store:
            continue
        default_language = file_language(path)
        mapping = None
        for row in read_rows(path):
            if mapping is None:
                mapping = column_map(list(row.keys()))
                if "title" not in mapping:
                    log.warning("%s: ingen titel-kolonne (fundet: %s) — filen springes over", path.name, list(row.keys())[:8])
                    break
            language = (str(row.get(mapping.get("language"), "")).strip().lower()[:2] or default_language)
            if language and language not in config["languages"]:
                skipped += 1
                continue
            title = str(row.get(mapping["title"], "")).strip()
            if not title:
                continue
            ours = {field: row.get(column) for field, column in mapping.items()}
            barcode = re.sub(r"\D", "", str(ours.get("barcode") or ""))
            products.append({
                "store": store, "file": path.name, "title": title, "barcode": barcode, "language": language or "",
                "brand": str(ours.get("brand") or "").strip(), "image": str(ours.get("image") or "").strip(), "ours": ours,
                "key": barcode or f"{store}:{key_of(title)}",
            })
    return products, skipped


# --- Open Food Facts ----------------------------------------------------------

def off_get(url, **params):
    response = requests.get(url, params=params or None, headers=HEADERS, timeout=30)
    if response.status_code in (429, 503):
        time.sleep(30)
        response = requests.get(url, params=params or None, headers=HEADERS, timeout=30)
    return response.json() if response.ok else {}


def off_by_barcode(code):
    if not code:
        return None
    data = off_get(OFF_PRODUCT_URL.format(code=code), fields=OFF_FIELDS)
    return data.get("product") if data.get("status") == 1 else None


def off_by_title(product):
    """Titelsøgning. Et fund tæller kun, hvis mindst 60 % af vores titelord står i det
    (og brandet, hvis vi kender det)."""
    wanted = words(product["title"]) | words(product["brand"])
    if not wanted:
        return None
    data = off_get(OFF_SEARCH_URL, search_terms=" ".join(sorted(wanted)), search_simple=1, action="process",
                   json=1, page_size=10, fields=OFF_FIELDS)
    best, best_share = None, 0.0
    for candidate in data.get("products", []):
        text = " ".join(filter(None, [candidate.get("brands"), candidate.get("product_name"), candidate.get("generic_name")]))
        share = len(wanted & words(text)) / len(wanted)
        if product["brand"] and key_of(product["brand"]) not in key_of(candidate.get("brands")):
            continue
        if share >= 0.6 and share > best_share:
            best, best_share = candidate, share
    return best


FACT_ORDER = [
    "Produktnavn", "Beskrivelse", "Brand", "Mængde", "Ingredienser", "Allergener", "Kan indeholde spor",
    "Mærkninger", "Oprindelse", "Kategorier", "Emballage", "Nutri-Score", "NOVA",
    "Energi (kcal/100 g)", "Fedt (g/100 g)", "Heraf mættet (g/100 g)", "Kulhydrat (g/100 g)", "Heraf sukker (g/100 g)",
    "Fiber (g/100 g)", "Protein (g/100 g)", "Salt (g/100 g)",
    "Google Vision: bedste gæt", "Google Vision: emner", "Google Vision: sider",
]
NUTRIENTS = [
    ("Energi (kcal/100 g)", "energy-kcal_100g", "kcal"), ("Fedt (g/100 g)", "fat_100g", "fat"),
    ("Heraf mættet (g/100 g)", "saturated-fat_100g", "saturated"), ("Kulhydrat (g/100 g)", "carbohydrates_100g", "carbs"),
    ("Heraf sukker (g/100 g)", "sugars_100g", "sugars"), ("Fiber (g/100 g)", "fiber_100g", "fiber"),
    ("Protein (g/100 g)", "proteins_100g", "protein"), ("Salt (g/100 g)", "salt_100g", "salt"),
]


def tag_list(tags):
    return ", ".join(t.split(":", 1)[-1].replace("-", " ") for t in (tags or []))


def off_facts(off, language):
    """Fakta fra Open Food Facts som {felt: tekst} — kun udfyldte."""
    lang = language or "da"
    nutriments = off.get("nutriments") or {}
    facts = {
        "Produktnavn": off.get(f"product_name_{lang}") or off.get("product_name"),
        "Beskrivelse": off.get("generic_name"),
        "Brand": off.get("brands"),
        "Mængde": off.get("quantity"),
        "Ingredienser": off.get(f"ingredients_text_{lang}") or off.get("ingredients_text"),
        "Allergener": tag_list(off.get("allergens_tags")),
        "Kan indeholde spor": tag_list(off.get("traces_tags")),
        "Mærkninger": off.get("labels"),
        "Oprindelse": off.get("origins"),
        "Kategorier": off.get("categories"),
        "Emballage": off.get("packaging"),
        "Nutri-Score": (off.get("nutriscore_grade") or "").upper() if off.get("nutriscore_grade") not in (None, "unknown", "not-applicable") else "",
        "NOVA": off.get("nova_group"),
    }
    for label, off_key, _field in NUTRIENTS:
        if nutriments.get(off_key) not in (None, ""):
            facts[label] = round(float(nutriments[off_key]), 2)
    return {k: str(v).strip() for k, v in facts.items() if v not in (None, "", [])}


# Hvilken af vores kolonner et OFF-felt sammenlignes med.
OURS_FIELD = {"Produktnavn": "title", "Brand": "brand", "Mængde": "quantity", "Ingredienser": "ingredients",
              "Allergener": "allergens", "Oprindelse": "origin", "Kategorier": "categories"}
OURS_FIELD.update({label: field for label, _key, field in NUTRIENTS})


def adds_detail(label, new_value, ours):
    """Nyt = vi har intet, eller den nye tekst er markant længere og rummer ord, vi mangler."""
    current = str(ours.get(OURS_FIELD.get(label)) or "").strip() if label in OURS_FIELD else ""
    if not current:
        return True
    if label in {l for l, _k, _f in NUTRIENTS} or label == "Produktnavn":
        return False
    new_words, old_words = words(new_value), words(current)
    return len(norm(new_value)) > 1.5 * len(norm(current)) and bool(new_words - old_words)


def new_facts(product, facts):
    return {label: value for label, value in facts.items() if adds_detail(label, value, product["ours"])}


# --- Google Vision (kun ved 0 resultater i Open Food Facts) ------------------

_credentials = None


def vision_headers(path):
    global _credentials
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account

    if _credentials is None:
        _credentials = service_account.Credentials.from_service_account_file(
            path, scopes=["https://www.googleapis.com/auth/cloud-vision"])
    if not _credentials.valid:
        _credentials.refresh(Request())
    return {"Authorization": f"Bearer {_credentials.token}"}


def load_image_bytes(product, input_dir):
    image = product["image"]
    if image.startswith("http"):
        response = requests.get(image, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return response.content
    if image:
        for candidate in (Path(image), Path(input_dir) / image):
            if candidate.is_file():
                return candidate.read_bytes()
    return None


def vision_facts(product, config):
    """WEB_DETECTION på varens billede. Returnerer {felt: tekst} eller {}."""
    if not config["visionCredentials"] or not product["image"]:
        return {}
    content = load_image_bytes(product, config["inputDir"])
    if not content:
        return {}
    body = {"requests": [{"image": {"content": base64.b64encode(content).decode()},
                          "features": [{"type": "WEB_DETECTION", "maxResults": 10}]}]}
    response = requests.post(VISION_URL, headers=vision_headers(config["visionCredentials"]), json=body, timeout=60)
    response.raise_for_status()
    web = (response.json().get("responses") or [{}])[0].get("webDetection", {})
    guess = ", ".join(g.get("label", "") for g in web.get("bestGuessLabels", []))
    entities = ", ".join(e["description"] for e in web.get("webEntities", []) if e.get("description") and e.get("score", 0) >= 0.5)[:300]
    pages = " | ".join(p.get("pageTitle", "") for p in web.get("pagesWithMatchingImages", [])[:3] if p.get("pageTitle"))[:300]
    facts = {"Google Vision: bedste gæt": guess, "Google Vision: emner": entities, "Google Vision: sider": pages}
    return {k: v for k, v in facts.items() if v}


# --- kørsel --------------------------------------------------------------------

def lookup(product, config):
    """Returnerer cache-række. Rækkefølge: stregkode → titel → Vision (kun ved 0 resultater)."""
    off = off_by_barcode(product["barcode"])
    source = "Open Food Facts: stregkode"
    if not off:
        time.sleep(config["delaySeconds"])
        off = off_by_title(product)
        source = "Open Food Facts: titel"
    if off:
        facts = new_facts(product, off_facts(off, product["language"]))
        code = off.get("code") or product["barcode"]
        return {"source": source, "link": f"https://world.openfoodfacts.org/product/{code}", "facts": facts, "note": ""}
    facts = vision_facts(product, config)
    if facts:
        return {"source": "Google Vision", "link": "", "facts": facts, "note": ""}
    reason = "Ingen resultater i Open Food Facts" + ("" if product["image"] else " og intet billede til Google Vision")
    return {"source": "Intet fundet", "link": "", "facts": {}, "note": reason}


def load_cache(path):
    cache = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                cache[row["key"]] = row
    return cache


def write_sheet(path, products, cache):
    import openpyxl
    from openpyxl.styles import Font

    found = [(p, cache[p["key"]]) for p in products if p["key"] in cache and cache[p["key"]]["facts"]]
    missing = [(p, cache[p["key"]]) for p in products if p["key"] in cache and not cache[p["key"]]["facts"]]
    used = [label for label in FACT_ORDER if any(label in row["facts"] for _p, row in found)]
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Nye fakta"
    sheet.append(["Butik", "Vores titel", "Stregkode", "Kilde", "Link"] + used)
    for product, row in found:
        sheet.append([product["store"].capitalize(), product["title"], product["barcode"], row["source"], row["link"]]
                     + [row["facts"].get(label, "") for label in used])
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    sheet.freeze_panes = "C2"
    none_sheet = workbook.create_sheet("Intet nyt")
    none_sheet.append(["Butik", "Vores titel", "Stregkode", "Kilde", "Bemærkning"])
    for product, row in missing:
        none_sheet.append([product["store"].capitalize(), product["title"], product["barcode"], row["source"],
                           row["note"] or "Open Food Facts har intet, vi ikke allerede har"])
    for cell in none_sheet[1]:
        cell.font = Font(bold=True)
    workbook.save(path)
    return len(found), len(missing)


def main():
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--inspect", action="store_true", help="vis fundne filer, kolonner og antal — ingen opslag")
    parser.add_argument("--limit", type=int, default=0, help="slå kun op på de første N nye varer (prøvekørsel)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    config = load_config()
    products, skipped = load_products(config)
    log.info("%d varer på %s (%d på andre sprog sprunget over)", len(products), "/".join(config["languages"]), skipped)
    if args.inspect:
        by = {}
        for p in products:
            by[(p["store"], p["language"] or "ukendt sprog")] = by.get((p["store"], p["language"] or "ukendt sprog"), 0) + 1
        for (store, language), count in sorted(by.items()):
            log.info("  %s / %s: %d", store, language, count)
        log.info("  med stregkode: %d, med billede: %d", sum(1 for p in products if p["barcode"]), sum(1 for p in products if p["image"]))
        return

    out_dir = Path(config["outputDir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_path = out_dir / "cache.jsonl"
    cache = load_cache(cache_path)
    deadline = time.time() + config["maxMinutes"] * 60
    todo = [p for p in products if p["key"] not in cache]
    if args.limit:
        todo = todo[: args.limit]
    log.info("%d allerede slået op, %d tilbage", len(cache), len(todo))
    done = 0
    with cache_path.open("a", encoding="utf-8") as handle:
        for product in todo:
            if time.time() > deadline:
                log.info("tidsgrænsen (%d min.) nået — fortsætter næste nat", config["maxMinutes"])
                break
            try:
                row = lookup(product, config)
            except Exception:  # noqa: BLE001 - én vare må ikke stoppe natten; den prøves igen næste gang
                log.exception("opslag fejlede for %s", product["title"])
                continue
            cache[product["key"]] = {"key": product["key"], **row}
            handle.write(json.dumps(cache[product["key"]], ensure_ascii=False) + "\n")
            handle.flush()
            done += 1
            time.sleep(config["delaySeconds"])
    sheet_path = out_dir / "lidl-aldi-nye-fakta.xlsx"
    with_news, without = write_sheet(sheet_path, products, cache)
    log.info("%d varer slået op i nat. Ark: %s (%d med nye fakta, %d uden)", done, sheet_path, with_news, without)


if __name__ == "__main__":
    main()
