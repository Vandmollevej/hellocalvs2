"""Dansk Variation: lille begyndelsesbogstav (brugerens regel). Skriver lower_changes.json i apply_mech-format.
Springer alkohol-rækker, ord med >=2 store bogstaver (akronymer: BBQ, XL) og kendte egennavne over.
Brug: py lower_var.py [--show]"""
import collections
import json
import os
import re
import shutil
import sys
import tempfile

import openpyxl

ROOT = r"C:\Users\Peter\Desktop\Hello Cal"
BASE = os.path.dirname(os.path.abspath(__file__))
SHEETS = [("DRK", "Produkter/drk.xlsx"), ("Årstiderne", "Produkter/aarstiderne.xlsx"), ("Wolt", "Produkter/DK/wolt.xlsx")]
# egennavne/lånte navne der med rette står med stort i en dansk variation
KEEP_CAPS = {
    "hawaii", "texas", "mexico", "napoli", "parma", "bolognese", "cheddar", "mozzarella", "gouda", "edamer", "brie", "camembert", "feta", "parmesan",
    "jalapeño", "jalapeno", "sriracha", "tabasco", "heinz", "milka", "oreo", "nutella", "coca-cola", "pepsi", "fanta", "sprite", "lays", "pringles", "max",
    "cola", "tex-mex", "new", "york", "california", "caesar", "ceasar", "tikka", "masala", "korma", "teriyaki", "tandoori", "sichuan", "thai", "asia",
}


def load(rel):
    dst = os.path.join(tempfile.gettempdir(), "lv_" + os.path.basename(rel))
    shutil.copy2(os.path.join(ROOT, rel), dst)
    ws = openpyxl.load_workbook(dst, read_only=True, data_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    h = [str(x) if x is not None else "" for x in next(it)]
    return h, list(it)


def main():
    show = "--show" in sys.argv
    out = []
    firsts = collections.Counter()
    skipped = collections.Counter()
    for sheet, rel in SHEETS:
        h, rows = load(rel)
        idx = {}
        for i, n in enumerate(h):
            idx.setdefault(n, i)
        alc = [i for i, n in enumerate(h) if n == "_is_alcohol"]
        changes = []
        for n, r in enumerate(rows, start=2):
            v = r[idx["Variation"]]
            if v in (None, ""):
                continue
            v = str(v)
            if not v[0].isupper() or re.match(r"^[A-ZÆØÅ]{2,}", v):
                continue
            if any(r[i] not in (None, "") for i in alc):
                skipped["alkohol"] += 1
                continue
            first = re.split(r"[\s,]", v)[0]
            if first.lower().strip("-") in KEEP_CAPS:
                skipped["egennavn:" + first] += 1
                continue
            nv = v[0].lower() + v[1:]
            firsts[first] += 1
            changes.append({"row": n, "orig": str(r[idx["Original Title"]]), "cols": {str(idx["Variation"]): nv}})
        out.append({"sheet": sheet, "file": rel, "header": h, "rows": len(rows), "changes": changes, "delete_rows": [], "stats": {"variation_lille": len(changes)}})
        print(sheet, len(rows), "rækker:", len(changes), "variationer får lille begyndelsesbogstav")
    json.dump(out, open(os.path.join(BASE, "lower_changes.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("sprunget over:", dict(skipped))
    if show:
        print("hyppigste første ord:", firsts.most_common(60))


if __name__ == "__main__":
    main()
