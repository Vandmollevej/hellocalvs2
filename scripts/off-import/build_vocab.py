# -*- coding: utf-8 -*-
"""Bygger ordforrådet til Open Food Facts-opdeleren (src/lib/off-name-split.ts) af butiksarkene.

Arkene (Bilka, REMA, SPAR, Nemlig, Wolt, DRK, Årstiderne, Frida) er den facitliste, brugeren selv har
rettet efter navnereglerne (docs/REGLER.md, Excelark/NAVNEREGLER.md). Herfra hentes:
  brands      kendte mærker (+ hvilke der er kæder, ikke egentlige mærker)
  subbrands   linjer under et mærke
  types       produkttyper (ental, flertal, kategori, antal)
  keywords    kendte nøgleord (Keyword 1-5)
  words       ord brugt i variationer (så opdeleren kan se, hvad den kan forklare)

Kør (arkene må gerne være åbne i Excel — de kopieres først):
  py -3 scripts/off-import/build_vocab.py --out src/data/off-vocab.json
  py -3 scripts/off-import/build_vocab.py --holdout 5 --out <temp>/vocab_train.json --gold-out <temp>/gold_test.jsonl
    (hver 5. række holdes ude af ordforrådet og skrives som prøvesæt; bruges af evaluate-split.mjs)
"""
import argparse
import collections
import datetime
import json
import os
import re
import shutil
import sys
import tempfile
import zlib

import openpyxl

HOME = os.path.expanduser('~')
DEFAULT_ROOT = os.path.join(HOME, 'Desktop', 'Hello Cal')

# (visningsnavn, relativ sti, tillid til produkttype/variation: 1 = rettet af brugeren, 0 = skraberens egne ord)
SHEETS = [
    ('bilka', os.path.join('Excelark', 'bilka.xlsx'), 1),
    ('rema', os.path.join('Produkter', 'rema1000_version 2.xlsx'), 1),
    ('spar', os.path.join('Produkter', 'SPAR', 'spar.xlsx'), 1),
    ('frida', os.path.join('Frida-ark', 'frida.xlsx'), 1),
    ('nemlig', os.path.join('Produkter', 'Nemlig', 'nemlig.xlsx'), 0),
    ('wolt', os.path.join('Excelark', 'wolt.xlsx'), 0),
    ('drk', os.path.join('Excelark', 'drk.xlsx'), 0),
    ('aarstiderne', os.path.join('Excelark', 'aarstiderne.xlsx'), 0),
]
GOLD_SHEETS = {'bilka', 'rema', 'spar'}

CHAINS = {
    'rema 1000', 'rema1000', 'salling', 'netto', 'føtex', 'foetex', 'bilka', 'coop', 'irma', 'kvickly', 'superbrugsen',
    'brugsen', "dagli'brugsen", 'meny', 'spar', 'lidl', 'aldi', 'nemlig.com', 'nemlig', 'wolt', 'aarstiderne', '365discount',
    'min købmand', 'løvbjerg', 'let-køb', 'edeka', 'rewe', 'dm', 'penny', 'kaufland',
}
BAD_BRAND = re.compile(r'^(produceret for|ukendt|unknown|diverse|n/?a|-+|\d+)', re.I)
CATEGORY_OK = {'Kolonial', 'Drikkevarer', 'Mejeri & køl', 'Slik & snacks', 'Brød & kager', 'Mad fra hele verden',
               'Frost', 'Frugt & grønt', 'Kød & fisk'}


def key(s):
    s = str(s if s is not None else '').lower()
    for a, b in (('ä', 'æ'), ('ö', 'ø'), ('é', 'e'), ('è', 'e'), ('ê', 'e'), ('ü', 'u'), ('ß', 'ss'), ('ô', 'o'),
                 ('á', 'a'), ('à', 'a'), ('í', 'i'), ('ó', 'o'), ('ú', 'u'), ('ñ', 'n'), ('ç', 'c'), ('’', "'")):
        s = s.replace(a, b)
    return re.sub(r'[^0-9a-zæøå]+', ' ', s).strip()


def clean(v):
    if v is None:
        return ''
    if isinstance(v, float) and v == int(v):
        v = int(v)
    return re.sub(r'\s+', ' ', str(v)).strip()


def sentence(s):
    s = clean(s)
    if not s:
        return ''
    if s.isupper() and len(s) > 3:
        s = s.lower()
    return s[0].upper() + s[1:]


def load(path):
    tmp = os.path.join(tempfile.gettempdir(), 'offvocab_' + os.path.basename(path))
    shutil.copy2(path, tmp)
    wb = openpyxl.load_workbook(tmp, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    hdr = list(next(it))
    names, seen = [], collections.Counter()
    for h in hdr:
        seen[h] += 1
        names.append(h if seen[h] == 1 else f'{h}#{seen[h]}')
    rows = []
    for r in it:
        rows.append({names[i]: (r[i] if i < len(r) else None) for i in range(len(names))})
    wb.close()
    try:
        os.remove(tmp)
    except OSError:
        pass
    return rows


def pick(counter):
    """Mest brugte skrivemåde; ved lighed den der ikke er ALLE CAPS."""
    best = sorted(counter.items(), key=lambda kv: (-kv[1], kv[0].isupper(), kv[0]))
    return best[0][0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=DEFAULT_ROOT)
    ap.add_argument('--out', required=True)
    ap.add_argument('--holdout', type=int, default=0, help='hold hver N. række ude (kun bilka/rema/spar)')
    ap.add_argument('--gold-out', default='')
    args = ap.parse_args()

    brands = collections.defaultdict(collections.Counter)      # key -> {surface: n}
    brand_types = collections.defaultdict(collections.Counter)  # brand key -> {produkttype: n}
    sub_types = collections.defaultdict(collections.Counter)    # subbrand key -> {produkttype: n}
    subbrands = collections.defaultdict(lambda: {'surf': collections.Counter(), 'brands': collections.Counter()})
    types = collections.defaultdict(lambda: {'surf': collections.Counter(), 'plural': collections.Counter(),
                                              'cat': collections.Counter(), 'n': 0, 'trusted': 0})
    keywords = collections.defaultdict(collections.Counter)
    words = collections.Counter()
    gold = []
    stats = {}

    for name, rel, trusted in SHEETS:
        path = os.path.join(args.root, rel)
        if not os.path.exists(path):
            print('mangler', path, file=sys.stderr)
            continue
        rows = load(path)
        used = 0
        for idx, r in enumerate(rows):
            rid = f'{name}:{idx + 2}'
            held = bool(args.holdout) and name in GOLD_SHEETS and zlib.crc32(rid.encode()) % args.holdout == 0
            brand = clean(r.get('Brand'))
            sub = clean(r.get('Subbrand'))
            ptype = clean(r.get('Product Type'))
            plural = clean(r.get('Product type plural'))
            var = clean(r.get('Variation'))
            cat = clean(r.get('Category'))
            kws = [clean(r.get(f'Keyword {i}')) for i in range(1, 6)]
            kws = [k for k in kws if k]
            pack = clean(r.get('Packaging'))
            orig = clean(r.get('Original Title')) or clean(r.get('Product Name'))
            if held:
                if ptype and orig:
                    gold.append({
                        'id': rid, 'name': orig, 'brand': brand, 'quantity': clean(r.get('Quantity')),
                        'type': ptype, 'plural': plural, 'variation': var, 'subbrand': sub, 'keywords': kws,
                        'category': cat, 'packaging': pack,
                        'flags': {k: clean(r.get(k)) for k in (
                            '_is_organic', '_is_glutenfree', '_is_lactose_free', '_is_vegan', '_is_sugar_free',
                            '_is_sweeteners', '_is_frozen', '_is_cooked', '_is_decaf', '_is_alcohol_free', '_is_fat',
                            '_is_alcohol', '_is_alcohol#2', '_is_meat', '_is_whole_grain') if clean(r.get(k))},
                    })
                continue
            used += 1
            if brand and len(brand) <= 40 and not BAD_BRAND.match(brand) and '|' not in brand and '/' not in brand:
                brands[key(brand)][brand] += 1
            if sub and brand and len(sub) <= 40 and '|' not in sub:
                s = subbrands[key(sub)]
                s['surf'][sub] += 1
                s['brands'][brand] += 1
            if trusted and ptype and len(ptype) <= 48 and len(ptype.split()) <= 5:
                if brand:
                    brand_types[key(brand)][sentence(ptype)] += 1
                if sub:
                    sub_types[key(sub)][sentence(ptype)] += 1
            if trusted:
                if ptype and len(ptype) <= 48 and len(ptype.split()) <= 5 and not re.search(r'[%|]', ptype) and \
                        not re.fullmatch(r'[\d\W]+', ptype):
                    k = key(ptype)
                    if k and k != key(brand):
                        t = types[k]
                        t['surf'][sentence(ptype)] += 1
                        t['n'] += 1
                        t['trusted'] += 1
                        if plural and key(plural) != k and len(plural) <= 48:
                            t['plural'][sentence(plural)] += 1
                        if name == 'bilka' and cat in CATEGORY_OK:
                            t['cat'][cat] += 1
                for kw in kws + ([pack] if pack else []):
                    kk = key(kw)
                    if kk and len(kk) <= 32 and not re.fullmatch(r'\d+', kk):
                        keywords[kk][kw.lower()] += 1
                for w in re.findall(r'[a-zæøåäöüé]{3,}', var.lower()):
                    words[w] += 1
            else:
                # skraberens egne arkværdier: kun typer, der faktisk er udfyldt (Nemlig m.fl.), tæller svagt
                if ptype and len(ptype) <= 48 and len(ptype.split()) <= 5 and not re.search(r'[%|]', ptype) \
                        and not re.fullmatch(r'[\d\W]+', ptype):
                    k = key(ptype)
                    if k and k != key(brand):
                        t = types[k]
                        t['surf'][sentence(ptype)] += 1
                        t['n'] += 1
        stats[name] = {'rows': len(rows), 'used': used}
        print(name, len(rows), 'rækker,', used, 'brugt', flush=True)

    # --- saml
    min_types = 1
    out = {
        'version': 1,
        'builtAt': datetime.datetime.now().strftime('%Y-%m-%d'),
        'holdout': args.holdout,
        'sources': stats,
    }
    chain_keys = {key(x) for x in CHAINS}

    def top_type(counter):
        # mest brugte produkttype og dens andel (0-100) blandt mærkets/linjens varer
        total = sum(counter.values())
        if not total:
            return ['', 0]
        t, n = counter.most_common(1)[0]
        return [t, int(round(100 * n / total))]

    out['brands'] = sorted(
        [[pick(c), sum(c.values()), 1 if k in chain_keys else 0] + top_type(brand_types.get(k, collections.Counter()))
         for k, c in brands.items()],
        key=lambda x: (-x[1], x[0]))
    out['subbrands'] = sorted(
        [[pick(v['surf']), sum(v['surf'].values()), [b for b, _ in v['brands'].most_common(6)]]
         + top_type(sub_types.get(k, collections.Counter()))
         for k, v in subbrands.items()],
        key=lambda x: (-x[1], x[0]))
    brand_keys = set(brands)
    tlist = []
    for k, t in types.items():
        if t['n'] < min_types:
            continue
        # et produkttypenavn der bare er et mærke, er ikke en type
        if k in brand_keys and t['trusted'] == 0:
            continue
        plural = pick(t['plural']) if t['plural'] else ''
        tlist.append([pick(t['surf']), plural, pick(t['cat']) if t['cat'] else '', t['n']])
    out['types'] = sorted(tlist, key=lambda x: (-x[3], x[0]))
    out['keywords'] = sorted([[pick(c), sum(c.values())] for k, c in keywords.items() if sum(c.values()) >= 2],
                             key=lambda x: (-x[1], x[0]))
    out['words'] = sorted([[w, n] for w, n in words.items() if n >= 2], key=lambda x: (-x[1], x[0]))
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('ordforråd ->', args.out, {k: len(out[k]) for k in ('brands', 'subbrands', 'types', 'keywords', 'words')},
          os.path.getsize(args.out) // 1024, 'KB')
    if args.gold_out:
        with open(args.gold_out, 'w', encoding='utf-8') as f:
            for g in gold:
                f.write(json.dumps(g, ensure_ascii=False) + '\n')
        print('prøvesæt ->', args.gold_out, len(gold), 'rækker')


if __name__ == '__main__':
    main()
