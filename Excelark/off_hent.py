# -*- coding: utf-8 -*-
"""Henter produkter fra Open Food Facts (OFF) for egne mærker og gemmer rå JSON.

Brug:  py -3 Excelark\\off_hent.py brand <slug> [<slug> ...]   (hent pr. brand-tag)
       py -3 Excelark\\off_hent.py store <slug> [<slug> ...]   (hent pr. butik-tag, kun Danmark)
Rå svar lægges i Backup\\off_raa\\<type>_<slug>.json (OFF-regel: max 10 søgninger/min -> 7 s pause).
"""
import json, os, sys, time, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "Backup", "off_raa")
HOST = "https://world.openfoodfacts.org"
UA = {"User-Agent": "HelloCal/1.0 (peter@packroff.dk)"}
FIELDS = ",".join([
    "code", "product_name", "product_name_da", "generic_name", "generic_name_da", "brands", "brands_tags",
    "quantity", "product_quantity", "product_quantity_unit", "categories", "categories_tags", "categories_old",
    "labels", "labels_tags", "allergens_tags", "traces_tags", "ingredients_text", "ingredients_text_da",
    "ingredients_analysis_tags", "countries_tags", "stores", "stores_tags", "origins", "origins_tags",
    "manufacturing_places", "packaging", "packaging_tags", "nutriments", "image_front_url", "image_url",
    "url", "states_tags", "nova_group", "nutriscore_grade", "last_modified_t", "lang", "serving_size",
])


PAGE_SIZE = int(os.environ.get("OFF_PAGE_SIZE", "100"))


def get(url):
    for i in range(8):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read())
        except Exception as e:  # 503 er almindeligt hos OFF -> prøv igen
            print("  retry", i + 1, e, flush=True)
            time.sleep(10 + i * 10)
    raise RuntimeError("OFF svarer ikke: " + url)


def fetch(kind, slug):
    tag = "brands_tags" if kind == "brand" else "stores_tags"
    page, items, total = 1, [], None
    os.makedirs(OUT, exist_ok=True)
    part = os.path.join(OUT, f"{kind}_{slug}.partial.json")  # genoptag efter en fejl midt i en lang hentning
    if os.path.exists(part):
        st = json.load(open(part, encoding="utf-8"))
        items, page = st["items"], st["page"] + 1
        print(f"{kind} {slug}: genoptager efter side {st['page']} ({len(items)} varer)", flush=True)
    while True:
        q = {tag: slug, "fields": FIELDS, "page_size": PAGE_SIZE, "page": page}
        q["countries_tags"] = "en:denmark"  # kun varer solgt i Danmark
        try:
            d = get(HOST + "/api/v2/search?" + urllib.parse.urlencode(q))
        except Exception:
            with open(part, "w", encoding="utf-8") as f:
                json.dump({"page": page - 1, "items": items}, f, ensure_ascii=False)
            raise
        total = d.get("count", 0)
        items += d.get("products", [])
        print(f"{kind} {slug}: side {page}, {len(items)}/{total}", flush=True)
        if len(items) >= total or not d.get("products"):
            break
        page += 1
        time.sleep(7)
    with open(os.path.join(OUT, f"{kind}_{slug}.json"), "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False)
    if os.path.exists(part):
        os.remove(part)
    return len(items)


if __name__ == "__main__":
    kind = sys.argv[1]
    for s in sys.argv[2:]:
        if os.path.exists(os.path.join(OUT, f"{kind}_{s}.json")) and not os.environ.get("OFF_REFRESH"):
            print(f"{kind} {s}: findes allerede (sæt OFF_REFRESH=1 for at hente igen)", flush=True)
            continue
        try:
            fetch(kind, s)
        except Exception as e:  # noqa: BLE001 - ét mærke der fejler må ikke stoppe resten
            print(f"{kind} {s}: FEJLEDE: {e}", flush=True)
        time.sleep(7)
