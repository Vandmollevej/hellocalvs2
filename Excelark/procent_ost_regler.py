"""Procent- og ost-regler (brugerens regler 2026-10-10), gaelder alle ark.
- "45+" o.l. (NN+) betyder ost: flyttes til variant og staar FOERST, adskilt med komma fra resten ("45+, med kommen").
  Staar det kun i Original Title, hentes det derfra.
- % maa aldrig staa i produkttype, variant eller keywords: fedt-% -> _is_fat, alkohol-% -> _is_alcohol.
  Ingrediens-% (49% nougat, 70% kakao, 80% koed) er hverken fedt eller alkohol og fjernes fra teksten.
- Produkttype der starter med % er fejlet: ny type fra Original Title; resten -> variant (hvis tom) ellers keyword.
Brug: python procent_ost_regler.py <kopi.xlsx> [--apply]   (uden --apply: kun aendringsliste)
  --apply retter cellerne direkte i det aabne Excel-ark (bilka.xlsx) og gemmer.
"""
import re, sys, os, time, collections

NPLUS = re.compile(r'(?<![\d,.+])(?:\+\s?(\d{2})|(\d{2})\s?\+)(?![\d%+])')
PCT = re.compile(
    r'(?P<lp>\(\s*)?'
    r'(?P<pre>(?:(?:mindst|minimum|min\.?|max\.?|maks\.?|ca\.?|heraf|totalt|fedtindhold|indhold af frugt:?|frugtindhold:?|juiceindhold|saftindhold)\s+)*)'
    r'(?P<num>\d+(?:\s*(?:[,.]|og)\s*\d+)?(?:\s*-\s*\d+(?:\s*[,.]\s*\d+)?)?)\s*/?\s*%'
    r'(?P<rp>\s*\))?'
    r'(?P<post>\s+(?P<proc>procent\s+)?(?P<pw>[a-zæøåéA-ZÆØÅ]+))?', re.I)
DROPW = {'kød', 'kakao', 'kakaotørstof', 'frugtindhold', 'frugt'}  # ordet ryger med procenten
ALCO = re.compile(r'\b(øl|ipa|pilsner|lager|vin|rødvin|hvidvin|rosé|likør|snaps|akvavit|gin|rom|vodka|whisky|tequila|cognac|cider|cocktail|spritz|alkohol\w*)\b', re.I)
JUNK_KW = re.compile(r'^(min|mindst|minimum|i tørstof|tilsat|med og med|heraf.*|i den .*|procent alkohol|alkohol|indhold af frugt|frugtindhold|juiceindhold|saftindhold|fedtindhold|totalt fedtindhold|kød|kakao|kakaotørstof.*)$', re.I)
STOPW = {'med', 'og', 'i', 'af', 'uden', 'til', 'på', 'et', 'en', 'den', 'det', 'heraf', 'min', 'mindst', 'minimum', 'eller'}
GRAM = re.compile(r'\b\d+(?:[,.]\d+)?\s*(?:kg|gram|g)\b', re.I)

# fejlede produkttyper (starter med %) / rodede raekker: EAN -> faste vaerdier
OVERRIDE = {
    '5701049190923': dict(type='Fransknougat', plural='Fransknougat'),  # P-tærter Original ekstra store
    '5701049193061': dict(type='Fransknougat', plural='Fransknougat'),  # P-tærter Original
    '5701049193108': dict(type='Fransknougat', plural='Fransknougat'),  # P-tærter Extra dark
    '5701049193085': dict(type='Fransknougat', plural='Fransknougat'),  # P-tærter Karamel
    '5766632527425': dict(type='Flødeisvaffel', plural='Flødeisvafler', variant='med saltkaramel'),  # Flødeisvafler m. saltkaramel
    '5772739450351': dict(type='Agavesirup', plural='Agavesirup'),  # Agavesirup m. honning og karamelsmag
    '5700001861024': dict(type='Indbagt sej i butterdej', plural='Indbagt sej i butterdej', variant='med citron', rest=''),  # Indbagt sej m. citron
    '5701043001522': dict(type='Blandingsprodukt', plural='Blandingsprodukt'),  # Blok til bagning
    '5703985054925': dict(type='Danbo ost', plural='Danbo oste', rest=''),  # Guld danbo skæreost mellemlagret 45+
    '5711953166839': dict(type='Fast modnet ost', plural='Fast modnede oste', variant='45+, lagret', rest=''),  # Skæreost lagret 45+
    '5711953161032': dict(type='Revet ost', plural='Revet oste', variant='hvid cheddar 50+, hård modnet ost 40+ og maasdammer 45+', rest=''),  # Revet cheddar og Maasdammer ost
}


def norm_num(n):
    n = re.sub(r'\s*(?:[,.]|og)\s*', ',', n.strip())
    return n.split('-')[-1].strip() + '%'


def tidy(s):
    s = re.sub(r'\(\s*\)', '', s)
    if s.count('(') > s.count(')'):
        s = s.replace('(', '', s.count('(') - s.count(')'))
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s+([,.)])', r'\1', s)
    s = re.sub(r'\(\s+', '(', s)
    s = re.sub(r'\s*/\s*(?=,|$)', '', s)
    s = re.sub(r'^\s*/\s*', '', s)
    s = re.sub(r'(?:\s*,)+', ',', s)
    s = re.sub(r',(?=\S)', ', ', s)
    s = re.sub(r'\b(og)\s+(?:og\b)', r'\1', s)
    s = re.sub(r'\b(og|i|af|med|eller)\s*(?=,|$)', '', s)
    s = re.sub(r'^(?:og|i|af|eller)\b\s*', '', s.strip())
    s = re.sub(r',\s*\d+$', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip(' ,:;/-')


def strip_nplus(s):
    found = [(a or b) + '+' for a, b in NPLUS.findall(s or '')]
    return (tidy(NPLUS.sub(' ', s)) if found else s), found


def strip_pct(s, ctx):
    """fjern alle %-udtryk; returnerer (tekst, fedt-vaerdier, alkohol-vaerdier, ingrediens-vaerdier)"""
    fat, alc, ingr = [], [], []
    out, pos = [], 0
    for m in PCT.finditer(s):
        pw = (m.group('pw') or '').lower()
        pre = (m.group('pre') or '').lower()
        paren = bool(m.group('lp') and m.group('rp'))
        val = norm_num(m.group('num'))
        end = m.end('rp') if m.group('rp') else m.end('num')
        end = s.index('%', m.end('num') - 1) + 1 if not m.group('rp') else end
        if pw == 'fedt' or 'fedt' in pre:
            kind = 'fat'
            if pw == 'fedt':
                end = m.end()
        elif pw in ('alkohol', 'vol') or m.group('proc'):
            kind = 'alc'
            end = m.end()
        elif paren:
            kind = 'ingr'
        elif ctx['alcoholic']:
            kind = 'alc'
        elif pw in DROPW:
            kind = 'ingr'
            end = m.end()
            if pw == 'kakaotørstof':
                t = re.match(r'\s+i\s+(?:den\s+)?[a-zæøå]+', s[end:], re.I)
                end += t.end() if t else 0
        elif ctx['cheese'] or (ctx['dairy'] and not pw):
            kind = 'fat'
        else:
            kind = 'ingr'
        {'fat': fat, 'alc': alc, 'ingr': ingr}[kind].append(val)
        start = m.start('lp') if paren else m.start('pre') if m.group('pre') else m.start('num')
        out.append(s[pos:start] + ' ')
        pos = end
    if pos == 0:
        return s, fat, alc, ingr
    out.append(s[pos:])
    return tidy(''.join(out)), fat, alc, ingr


def put_kw(kws, val):
    if not val or any(k and k.lower() == val.lower() for k in kws):
        return
    for i, k in enumerate(kws):
        if not k:
            kws[i] = val
            return


def process(r):
    """r: dict med type, variant, kw (liste), fat, alc, alcflag, plural, orig, cat, ean -> ny dict"""
    r = dict(r, kw=list(r['kw']))
    ov = OVERRIDE.get(str(r.get('ean') or '').strip(), {})
    orig = r.get('orig') or ''
    S = lambda v: v if isinstance(v, str) else ''
    texts = [S(r['type']), S(r['variant'])] + [S(k) for k in r['kw']]
    # NN+ (ost)
    nps = []
    for t in texts:
        nps += [x for x in strip_nplus(t)[1] if x not in nps]
    multi = len(nps) > 1  # blandinger (fx revet ost af tre oste): NN+ bliver ved hver ost
    if not nps and (r['cat'] == 'Mejeri & køl' or re.search(r'ost\b', r['type'] or '', re.I)):
        onp = list(dict.fromkeys(strip_nplus(orig)[1]))
        nps = onp if len(onp) == 1 else []
    ctx = dict(cheese=bool(nps), dairy=r['cat'] == 'Mejeri & køl',
               alcoholic=bool(r.get('alcflag') or (r['alc'] and r['cat'] == 'Drikkevarer'))
               or (r['cat'] == 'Drikkevarer' and bool(ALCO.search((r['type'] or '') + ' ' + orig))))
    fats, alcs, ingrs = [], [], []

    def clean(t, is_kw=False):
        if not isinstance(t, str) or not t:
            return t
        if is_kw and re.search(r'kakaotørstof|^heraf\b', t, re.I):  # kakao-% / fedtfordeling er ikke et keyword
            return None
        if not multi:
            t = strip_nplus(t)[0]
        t, f, a, g = strip_pct(t, ctx)
        fats.extend(f); alcs.extend(a); ingrs.extend(g)
        if is_kw and (JUNK_KW.match(t) or not set(t.lower().split()) - STOPW):
            return None
        return t or None

    old_type = S(r['type'])
    failed = bool(re.match(r'\s*\d+(?:\s*[,.]\s*\d+)?\s*%', old_type)) or (not old_type.strip() and '%' in (r['variant'] or ''))
    new_type = clean(old_type)
    new_var = clean(r['variant']) if isinstance(r['variant'], str) else r['variant']
    kw_before = list(r['kw'])
    r['kw'] = [clean(k, True) if k else k for k in r['kw']]
    plural = r['plural']
    if isinstance(plural, str) and plural and plural != old_type:
        plural = clean(plural)
    elif plural:
        plural = new_type
    if new_type and new_type != old_type:
        new_type = tidy(GRAM.sub(' ', new_type))
        plural = tidy(GRAM.sub(' ', plural)) if plural else plural
    if failed or 'type' in ov:
        rest = ov.get('rest', new_type)
        new_type = ov.get('type', new_type)
        plural = ov.get('plural', plural)
        if rest and not re.search(re.escape(rest.lower()), (new_type or '').lower()):
            parts = [p for p in re.split(r'\s*,\s*|\s+og\s+', rest) if p and p.lower() not in (new_type or '').lower()]
            rest = ', '.join(parts[:-1]) + (' og ' if len(parts) > 1 else '') + parts[-1] if parts else ''
            if rest and not new_var and 'variant' not in ov:
                new_var = rest
            elif rest:
                put_kw(r['kw'], rest)
    if 'variant' in ov:
        new_var = ov['variant']
    if (failed or ov) and isinstance(new_var, str) and new_var and new_type:  # ord der allerede staar i typen
        parts = [p for p in re.split(r'\s*,\s*', new_var) if p.lower() not in new_type.lower()]
        new_var = ', '.join(parts) or None
    for k in ov.get('kw', []):
        put_kw(r['kw'], k)
    # NN+ foerst i variant
    if nps and not multi and 'variant' not in ov and not isinstance(new_var, (int, float)):
        rest = [p for p in re.split(r'\s*,\s*', new_var or '') if p and p not in nps]
        new_var = ', '.join(nps + rest)
    # fedt / alkohol
    fat, alc = r['fat'], r['alc']
    if fats and not fat:
        fat = fats[0]
    if alcs and not alc:
        alc = alcs[0]
    if fat and (fat in ingrs or any(fat == n[:-1] + '%' and int(n[:-1]) >= 45 for n in nps)):
        fat = None  # ingrediens-% eller ostens NN+ (fx Brie 60+ -> "60% fedt") var lagt i fedt ved en fejl
    if alc and alc in ingrs and not ctx['alcoholic']:
        alc = None  # fx eddike 5%, chokolade "fyld (22 %)"
    if r['kw'] != kw_before:  # komprimer keywords mod venstre, kun hvis noget er aendret
        kws = [k for k in r['kw'] if k]
        r['kw'] = kws + [None] * (len(r['kw']) - len(kws))
    r.update(type=new_type or None, variant=new_var or None, fat=fat, alc=alc, plural=plural or None)
    return r


# ---------- koersel paa et faerdigt ark (databasekolonnenavne) ----------
COLS = dict(type='productType', variant='variant', fat='_is_fat', plural='Product type plural', orig='Original Title',
            cat='category', ean='barcode')


def plan(path):
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    hdr = list(rows[0])
    ix = {k: hdr.index(v) for k, v in COLS.items()}
    alc_cols = [i for i, h in enumerate(hdr) if h == '_is_alcohol']
    ix['alc'], ix['alcflag'] = alc_cols[-1], alc_cols[0]
    kwi = [hdr.index(f'keyword{n}') for n in range(1, 6)]
    changes = []
    for rn, row in enumerate(rows[1:], 2):
        g = lambda i: row[i] if i < len(row) else None
        r = {k: g(i) for k, i in ix.items()}
        r['alcflag'] = (g(ix['alcflag']) or '') == 'indeholder alkohol'
        r['kw'] = [g(i) for i in kwi]
        n = process(r)
        for k in ('type', 'variant', 'fat', 'alc', 'plural'):
            if (n[k] or None) != (r[k] or None):
                changes.append((rn, ix[k], k, r[k], n[k], r['ean']))
        for i, (a, b) in enumerate(zip(r['kw'], n['kw'])):
            if (a or None) != (b or None):
                changes.append((rn, kwi[i], f'keyword{i + 1}', a, b, r['ean']))
    return hdr, changes


def apply_live(changes, hdr, book='bilka.xlsx'):
    import win32com.client
    xl = win32com.client.GetActiveObject('Excel.Application')
    wb = xl.Workbooks(book)
    ws = wb.Worksheets(1)
    ean_col = hdr.index('barcode') + 1
    done, skipped = 0, []
    for rn, ci, k, old, new, ean in changes:
        for attempt in range(20):
            try:
                c = ws.Cells(rn, ci + 1)
                if str(ws.Cells(rn, ean_col).Value or '').split('.')[0] != str(ean or '').split('.')[0] or (c.Value or None) != (old or None):
                    skipped.append((rn, k, old, c.Value))
                    break
                if new is None:
                    c.ClearContents()
                else:
                    c.Value = ("'" + new) if re.match(r'[\d+\-=]', new) else new
                done += 1
                break
            except Exception:  # Excel er optaget (brugeren skriver i en celle)
                time.sleep(1)
    wb.Save()
    return done, skipped


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    hdr, ch = plan(sys.argv[1])
    out = os.path.join(os.environ.get('TEMP', '.'), 'procent_ost_aendringer.tsv')
    with open(out, 'w', encoding='utf-8') as f:
        for c in ch:
            f.write('\t'.join(str(x) for x in (c[0], c[2], c[3], c[4], c[5])) + '\n')
    print(len(ch), 'aendringer i', len({c[0] for c in ch}), 'raekker ->', out)
    print(collections.Counter(c[2] for c in ch))
    if '--apply' in sys.argv:
        done, skipped = apply_live(ch, hdr)
        print('rettet', done, 'sprunget over (aendret af andre imens)', len(skipped))
        for s in skipped[:30]:
            print('  ', s)
