"""Skriver en CSV-log (før/efter pr. felt) over alt udtrækket har ændret, så næste tråd kan se hvad der skete."""
import csv
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = r"C:\Users\Peter\Desktop\Hello Cal\Produkter\Backup\produkttype_udtraek_aendringer_2026-10-16.csv"
FIELDS = ("brand", "subbrand", "cobrand", "product_type", "variation")
n = 0
with open(DEST, "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.writer(fh, delimiter=";")
    w.writerow(["ark", "række (før skrivning)", "Original Title", "felt", "før", "efter", "sikkerhed", "note"])
    for f in sorted(glob.glob(os.path.join(HERE, "batches", "*.in.json"))):
        sheet = os.path.basename(f).split("_")[0]
        inp = {r["row"]: r for r in json.load(open(f, encoding="utf-8"))}
        for o in json.load(open(f.replace(".in.json", ".out.json"), encoding="utf-8")):
            r = inp.get(o["row"])
            if not r:
                continue
            if o.get("remove"):
                w.writerow([sheet, o["row"], r["orig_title"], "RÆKKE SLETTET (ikke mad)", "", "", o.get("confidence"), o.get("note")])
                n += 1
                continue
            for k in FIELDS:
                a, b = (r.get(k) or ""), (o.get(k) or "")
                if a != b:
                    w.writerow([sheet, o["row"], r["orig_title"], k, a, b, o.get("confidence"), o.get("note")])
                    n += 1
            ka, kb = " | ".join(r.get("keywords") or []), " | ".join(o.get("keywords") or [])
            if ka != kb:
                w.writerow([sheet, o["row"], r["orig_title"], "keywords", ka, kb, o.get("confidence"), o.get("note")])
                n += 1
print("log-linjer:", n, "->", DEST)
