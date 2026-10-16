import collections
import json
import os
import shutil
import sys
import tempfile

import openpyxl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rule_check as rc

ROOT = r"C:\Users\Peter\Desktop\Hello Cal"
HERE = os.path.dirname(os.path.abspath(__file__))
BATCH_DIR = os.path.join(HERE, "batches")
os.makedirs(BATCH_DIR, exist_ok=True)

SHEETS = {
    "DRK": ("Produkter/drk.xlsx", "da"),
    "Aarstiderne": ("Produkter/aarstiderne.xlsx", "da"),
    "Wolt": ("Produkter/DK/wolt.xlsx", "da"),
    "DM": ("Produkter/dm.xlsx", "de"),
    "EDEKA": ("Produkter/edeka.xlsx", "de"),
    "REWE": ("Produkter/rewe.xlsx", "de"),
}
BATCH = int(os.environ.get("BATCH", "90"))


def load(rel):
    dst = os.path.join(tempfile.gettempdir(), "mb_" + os.path.basename(rel))
    shutil.copy2(os.path.join(ROOT, rel), dst)
    ws = openpyxl.load_workbook(dst, read_only=True, data_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    h = [str(x) if x is not None else "" for x in next(it)]
    return h, list(it)


def s(v):
    return None if v in (None, "") else str(v).strip()


def build(sheet):
    rel, lang = SHEETS[sheet]
    h, rows = load(rel)
    idx = {}
    for i, n in enumerate(h):
        idx.setdefault(n, i)
    alc = [i for i, n in enumerate(h) if n == "_is_alcohol"]
    kw = [i for i, n in enumerate(h) if n.startswith("Keyword ")]
    g = lambda r, c: r[idx[c]] if c in idx else None
    items = []
    stats = collections.Counter()
    for n, r in enumerate(rows, start=2):
        inp = {
            "row": n, "lang": lang, "orig_title": s(g(r, "Original Title")), "subtitle": s(g(r, "Subtitle")),
            "brand": s(g(r, "Brand")), "subbrand": s(g(r, "Subbrand")), "cobrand": s(g(r, "Co-brand")), "category": s(g(r, "Category")),
            "product_type": s(g(r, "Product Type")), "variation": s(g(r, "Variation")),
            "keywords": [str(r[i]) for i in kw if r[i] not in (None, "")],
            "flags": {k: s(g(r, c)) for k, c in (("organic", "_is_organic"), ("alcohol_free", "_is_alcohol_free"), ("sugar_free", "_is_sugar_free"),
                                                  ("glutenfree", "_is_glutenfree"), ("lactose_free", "_is_lactose_free"), ("vegan", "_is_vegan")) if s(g(r, c))},
            "country": s(g(r, "_is_country_of_origen")),
            "alcohol_percent": s(r[alc[1]]) if len(alc) > 1 else None,
            "quantity": s(g(r, "Quantity")), "pack_count": s(g(r, "Pack Count")),
        }
        if not inp["orig_title"]:
            continue
        cur = {
            "row": n, "remove": False, "brand": inp["brand"], "subbrand": inp["subbrand"], "product_type": inp["product_type"],
            "product_type_plural": inp["product_type"] or "x", "variation": inp["variation"], "keywords": inp["keywords"], "flags": inp["flags"],
            "country": inp["country"], "alcohol_percent": inp["alcohol_percent"],
        }
        errs, warns = rc.check_row(inp, cur)
        errs = [e for e in errs if not e.startswith("V14")]
        if errs or not inp["product_type"] or not inp["brand"]:
            inp["_issues"] = errs + warns
            items.append(inp)
            stats["til_udtræk"] += 1
        else:
            stats["allerede_ok"] += 1
    return items, dict(stats)


def main():
    only = sys.argv[1:] or list(SHEETS)
    manifest = []
    for sheet in only:
        items, st = build(sheet)
        nb = (len(items) + BATCH - 1) // BATCH
        for b in range(nb):
            chunk = items[b * BATCH:(b + 1) * BATCH]
            fn = f"{sheet}_{b + 1:03d}"
            json.dump(chunk, open(os.path.join(BATCH_DIR, fn + ".in.json"), "w", encoding="utf-8"), ensure_ascii=False)
            manifest.append({"sheet": sheet, "batch": fn, "rows": len(chunk), "input": os.path.join(BATCH_DIR, fn + ".in.json"),
                             "output": os.path.join(BATCH_DIR, fn + ".out.json")})
        print(sheet, len(items), "rækker i", nb, "batches", st)
    json.dump(manifest, open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("batches i alt:", len(manifest))


if __name__ == "__main__":
    main()
