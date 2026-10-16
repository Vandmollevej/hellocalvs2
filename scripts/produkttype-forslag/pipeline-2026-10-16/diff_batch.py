"""Viser hvad en batch ændrer (input -> output) pr. række. Brug: py diff_batch.py <batch> [max] [kun_low]"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1]
lim = int(sys.argv[2]) if len(sys.argv) > 2 else 15
only_low = len(sys.argv) > 3 and sys.argv[3] == "low"
inp = {r["row"]: r for r in json.load(open(os.path.join(HERE, "batches", name + ".in.json"), encoding="utf-8"))}
out = json.load(open(os.path.join(HERE, "batches", name + ".out.json"), encoding="utf-8"))
shown = 0
changed = 0
for o in out:
    r = inp.get(o["row"])
    if not r:
        continue
    d = []
    for k_in, k_out in (("brand", "brand"), ("subbrand", "subbrand"), ("cobrand", "cobrand"), ("product_type", "product_type"), ("variation", "variation")):
        a, b = r.get(k_in), o.get(k_out)
        if (a or None) != (b or None):
            d.append(f"{k_in}: {a!r} -> {b!r}")
    if (r.get("keywords") or []) != (o.get("keywords") or []):
        d.append(f"kw: {r.get('keywords')} -> {o.get('keywords')}")
    if o.get("remove"):
        d.append("REMOVE")
    if d:
        changed += 1
    if only_low and o.get("confidence") != "low":
        continue
    if shown < lim:
        print(f"r{o['row']} [{o.get('confidence')}] {str(r['orig_title'])[:60]} | {' ; '.join(d) if d else '(uændret)'} | note={str(o.get('note'))[:110]}")
        shown += 1
print("rækker ændret:", changed, "af", len(out))
