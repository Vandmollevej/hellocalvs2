"""Stikprøve af ændringer på tværs af batches. Brug: py sample_changes.py <ark> <felt> <antal>   (felt: brand|subbrand|product_type|variation)"""
import glob
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sheet, field, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
random.seed(11)
hits = []
for f in sorted(glob.glob(os.path.join(HERE, "batches", sheet + "_*.in.json"))):
    inp = {r["row"]: r for r in json.load(open(f, encoding="utf-8"))}
    for o in json.load(open(f.replace(".in.json", ".out.json"), encoding="utf-8")):
        r = inp.get(o["row"])
        if not r or o.get("remove"):
            continue
        a, b = (r.get(field) or None), (o.get(field) or None)
        if a != b:
            hits.append((r["row"], r["orig_title"], a, b, r.get("brand"), o.get("brand"), o.get("confidence")))
print(len(hits), "ændringer i", field)
for h in random.sample(hits, min(n, len(hits))):
    print(f"r{h[0]} {str(h[1])[:62]} | {field}: {h[2]!r} -> {h[3]!r} | brand {h[4]!r}->{h[5]!r} [{h[6]}]")
