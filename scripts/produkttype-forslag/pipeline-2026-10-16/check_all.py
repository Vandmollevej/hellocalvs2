import collections
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rule_check as rc

want = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "ALL" else None
samples = int(sys.argv[2]) if len(sys.argv) > 2 else 0
by_sheet = collections.defaultdict(collections.Counter)
rows_n = collections.Counter()
rows_err = collections.Counter()
rows_removed = collections.Counter()
rows_low = collections.Counter()
missing = collections.Counter()
ex = collections.defaultdict(list)
for f in sorted(glob.glob(os.path.join(HERE, "batches", "*.in.json"))):
    name = os.path.basename(f).replace(".in.json", "")
    sheet = name.split("_")[0]
    if want and sheet != want:
        continue
    of = f.replace(".in.json", ".out.json")
    if not os.path.exists(of):
        missing[sheet] += 1
        continue
    try:
        out = {o["row"]: o for o in json.load(open(of, encoding="utf-8"))}
    except Exception as e:  # noqa: BLE001
        print("fejl", of, e)
        continue
    for r in json.load(open(f, encoding="utf-8")):
        o = out.get(r["row"])
        rows_n[sheet] += 1
        if o is None:
            by_sheet[sheet]["MANGLER_RÆKKE"] += 1
            continue
        if o.get("remove"):
            rows_removed[sheet] += 1
        if o.get("confidence") == "low":
            rows_low[sheet] += 1
        errs, warns = rc.check_row(r, o)
        if errs:
            rows_err[sheet] += 1
        for e in errs:
            code = e.split(" ")[0]
            by_sheet[sheet][code] += 1
            if len(ex[(sheet, code)]) < samples:
                ex[(sheet, code)].append(f"r{r['row']} {str(r['orig_title'])[:55]} | {e[:130]}")
for s in rows_n:
    print(f"## {s}: {rows_n[s]} rækker, {rows_err[s]} med fejl, {rows_removed[s]} fjernes, {rows_low[s]} low, manglende batchfiler {missing[s]}; {dict(by_sheet[s])}")
for k, v in ex.items():
    for line in v:
        print(k[0], k[1], line)
print("manglende batchfiler:", dict(missing))
