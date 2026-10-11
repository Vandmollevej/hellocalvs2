"""Anvend AI-forslag (produkttype/variation/keywords/brand/maengde) paa dm, EDEKA, REWE og Wolt (2026-10-11).
Brug: py -3 anvend_ai_forslag.py <butik> <resultatmappe> [--dry]
  <resultatmappe> indeholder batch_NNN.json (forfatter) og review_NNN.json (kontrollor, overstyrer forfatteren).
  Hver batch-fil har en 'base' i AI-batchfilerne (ai_batches/<butik>/batch_NNN.json): feltvaerdierne da forslaget blev lavet.
  Er en celle aendret siden da (fx af en anden session), springes den celle over.

Regler (praecision foerst):
- confidence >= 4: product_type, variation og keywords erstattes (efter validering).
- confidence 3: product_type kun hvis den nuvaerende er tom / butikkens kategori / temakategori; variation og keywords kun hvis tomme.
- confidence <= 2: intet skrives - raekken logges til gennemgang.
- brand/subbrand kun hvis tomt og titlen starter med det foreslaaede maerke; quantity/pack_count kun hvis tomt og navnet i titlen.
- Originalkolonner roeres aldrig. Alkohol-raekker (vin-sessionen) roeres ikke. Arket gemmes oven i sig selv efter backup.
"""
import collections, csv, datetime, glob, json, os, re, shutil, sys, tempfile
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import optimer_ark as OA  # noqa: E402  (tidy, THEME, ph, cap1, lower_flag ...)
import omlaeg_til_bilka_kolonner as O  # noqa: E402

BACKUP = os.path.join(HERE, 'backup')
SHEET = {'dm': ('dm.xlsx', 'de'), 'edeka': ('edeka.xlsx', 'de'), 'rewe': ('rewe.xlsx', 'de'), 'wolt': ('wolt.xlsx', 'da')}
FLAGWORD = re.compile(OA.WB + r'(?:bio|öko|økologisk\w*|ökologisch\w*|vegan\w*|glutenfrei\w*|glutenfri\w*|laktosefrei\w*|laktosefri\w*|zuckerfrei\w*|sukkerfri\w*|'
                      r'alkoholfrei\w*|alkoholfri\w*|koffeinfrei\w*|entkoffeiniert\w*|tiefgekühlt\w*|frosne|frossen\w*)' + OA.WA, re.I)
QTYWORD = re.compile(r'\b\d+(?:[.,]\d+)?\s*(?:kg|g|gr|ml|cl|l|ltr|stk|st|stück|x)\b', re.I)
PETWORD = re.compile(r'hundefutter|katzenfutter|alleinfuttermittel|hundesnack|katzensnack|tierfutter|hundefoder|kattefoder', re.I)


def valid_pt(pt, row, brand, sub):
    if not isinstance(pt, str):
        return None
    pt = re.sub(r'\s+', ' ', pt).strip(' ,;:-–')
    if not (2 <= len(pt) <= 60) or '%' in pt or '/' in pt:
        return None
    if pt.isupper() and len(pt) > 4:
        return None
    if QTYWORD.search(pt) or FLAGWORD.search(pt):
        return None
    for b in (brand, sub):
        if b and len(b) >= 3 and OA.ph(b).search(pt) and pt.lower() != b.lower():
            return None
    ot = str(row.get('original_title') or '')
    if len(pt) > 30 and pt.lower() == ot.lower():
        return None
    return OA.cap1(pt)


def clean_var(v, pt, lang):
    if not isinstance(v, str) or not v.strip():
        return None
    v = re.sub(r'\s+', ' ', v).strip(' ,;:-–')
    if '%' in v or len(v) > 90 or QTYWORD.search(v):
        return None
    m = re.match(r'(?i)^(' + OA.FUNC[lang] + r')\b', v)
    if m and v[0].isupper():
        v = OA.lower1(v)
    ptoks = {w.lower() for w in re.split(r'[\s-]+', pt or '') if len(w) >= 4}
    vtoks = [w.lower() for w in re.split(r'[\s-]+', v) if len(w) >= 4]
    if vtoks and all(t in ptoks for t in vtoks):
        return None
    return v


def clean_kws(kws, pt, var, brand, sub):
    out = []
    own = {w.lower() for w in re.split(r'[\s-]+', ' '.join(x for x in (pt, var, brand, sub) if x)) if len(w) >= 3}
    for k in kws or []:
        if not isinstance(k, str):
            continue
        k = re.sub(r'\s+', ' ', k).strip(' ,;:-–')
        if not k or len(k) > 40 or '%' in k or QTYWORD.search(k) or FLAGWORD.fullmatch(k):
            continue
        toks = [w.lower() for w in re.split(r'[\s-]+', k) if len(w) >= 3]
        if toks and all(t in own for t in toks):
            continue
        if k.lower() in {o.lower() for o in out}:
            continue
        out.append(k)
    return out[:5]


def run(store, rdir, dry):
    fn, lang = SHEET[store]
    path = os.path.join(HERE, fn)
    lock = os.path.join(HERE, '~$' + fn)
    if os.path.exists(lock) and not dry:
        print(f'{store}: SPRUNGET OVER - {fn} er aaben i Excel')
        return
    sp = os.path.dirname(os.path.dirname(os.path.abspath(rdir)))  # scratchpad
    bdir = os.path.join(sp, 'ai_batches', store)
    base = {}
    for f in sorted(glob.glob(os.path.join(bdir, 'batch_*.json'))):
        for r in json.load(open(f, encoding='utf-8')):
            base[r['id']] = r
    prop = {}
    src = collections.Counter()
    for f in sorted(glob.glob(os.path.join(rdir, 'batch_*.json'))):
        try:
            for r in json.load(open(f, encoding='utf-8')):
                prop[r['id']] = r
                src['forfatter'] += 1
        except Exception as e:
            print('   (kan ikke laese', f, e, ')')
    for f in sorted(glob.glob(os.path.join(rdir, 'review_*.json'))):
        try:
            for r in json.load(open(f, encoding='utf-8')):
                if r.get('id') in prop:
                    prop[r['id']] = r
                    src['kontrol_overstyrer'] += 1
        except Exception as e:
            print('   (kan ikke laese', f, e, ')')
    print(f'{store}: {len(prop)} forslag ({dict(src)}), {len(base)} basisraekker')
    # raekkenumre forskydes hvis raekker slettes undervejs (fx dyrefoder) -> match paa Source URL via basis-kopien
    url2id = {}
    basexlsx = os.path.join(sp, f'ai_{store}.xlsx')
    if os.path.exists(basexlsx):
        bws = openpyxl.load_workbook(basexlsx, read_only=True).active
        bit = bws.iter_rows(values_only=True)
        bh = [str(h).strip() if h else h for h in next(bit)]
        ui = bh.index('Source URL')
        for k, r in enumerate(bit, 2):
            if ui < len(r) and r[ui]:
                url2id[str(r[ui])] = f'{store}#{k}'
        print(f'{store}: {len(url2id)} Source URL fra basiskopien')
    mtime = os.path.getmtime(path)
    wb = openpyxl.load_workbook(path)
    ws = wb.active
    hdr = [c.value.strip() if isinstance(c.value, str) else c.value for c in ws[1]]
    ix = {}
    for i, h in enumerate(hdr):
        ix.setdefault(h, i)
    alc = [i for i, h in enumerate(hdr) if h == '_is_alcohol']
    stats = collections.Counter()
    audit, review_rows, nonfood, pet = [], [], [], []
    master, fr = (O.bilka_master()[3], O.T.load_frida_plurals()) if lang == 'da' else (None, None)
    known_brands = OA.build_brands()
    for row in ws.iter_rows(min_row=2):
        rn = row[0].row
        url = row[ix['Source URL']].value if 'Source URL' in ix else None
        rid = url2id.get(str(url)) if url and url2id else f'{store}#{rn}'
        if rid is None:
            continue
        p = prop.get(rid)
        if not p:
            continue
        b = base.get(rid, {})
        cur = {h: row[ix[h]].value for h in ('Product Type', 'Variation', 'Brand', 'Subbrand', 'Quantity', 'Pack Count', 'Category', 'Original Title',
                                              'Keyword 1', 'Keyword 2', 'Keyword 3', 'Keyword 4', 'Keyword 5')}
        if any(row[i].value for i in alc):
            stats['alkohol_sprunget_over'] += 1
            continue
        s_ = lambda v: str(v).strip() if v not in (None, '') else ''  # noqa: E731
        cur_kws = [s_(cur[f'Keyword {n}']) for n in range(1, 6)]
        # konflikt: nogen har aendret cellen siden forslaget blev lavet
        conflict = (s_(cur['Product Type']) != s_(b.get('product_type')) or s_(cur['Variation']) != s_(b.get('variation')) or
                    [k for k in cur_kws if k] != list(b.get('keywords', [])))
        if conflict:
            stats['konflikt_sprunget_over'] += 1
            continue
        if not p.get('is_food', True):
            nonfood.append((f'{store}#{rn}', cur['Original Title'], p.get('product_type')))
        if p.get('is_pet_food') or PETWORD.search(str(cur['Original Title'] or '')):
            pet.append((f'{store}#{rn}', cur['Original Title']))
        conf = int(p.get('confidence') or 0)
        brand = s_(cur['Brand']) or s_(p.get('brand'))
        sub = s_(cur['Subbrand']) or s_(p.get('subbrand'))
        newpt = valid_pt(p.get('product_type'), b, brand, sub)
        if conf <= 2 or not newpt:
            stats['lav_sikkerhed_eller_ugyldig'] += 1
            review_rows.append([f'{store}#{rn}', conf, cur['Original Title'], cur['Product Type'], p.get('product_type'), p.get('note')])
            newpt = None
        changed = {}
        curpt = s_(cur['Product Type'])
        weak_pt = (not curpt) or curpt.lower() == s_(cur['Category']).lower() or curpt.lower() in OA.THEME
        if newpt and curpt != newpt and (conf >= 4 or (conf == 3 and weak_pt)):
            changed['Product Type'] = newpt
        ptf = changed.get('Product Type', curpt)
        newvar = clean_var(p.get('variation'), ptf, lang) if newpt else None
        curvar = s_(cur['Variation'])
        if newpt and (conf >= 4 or (conf == 3 and not curvar)):
            if (newvar or '') != curvar and (newvar or conf >= 4):
                changed['Variation'] = newvar
        newkws = clean_kws(p.get('keywords'), ptf, changed.get('Variation', curvar), brand, sub) if newpt else None
        if newkws is not None and (conf >= 4 or (conf == 3 and not any(cur_kws))):
            if newkws != [k for k in cur_kws if k]:
                kk = (newkws + [''] * 5)[:5]
                for n in range(1, 6):
                    if (kk[n - 1] or '') != cur_kws[n - 1]:
                        changed[f'Keyword {n}'] = kk[n - 1] or None
        # brand: kun hvis tomt og titlen starter med det
        nb = s_(p.get('brand'))
        if nb and not s_(cur['Brand']) and re.match(re.escape(nb) + r'\b', s_(cur['Original Title']), re.I) and len(nb) >= 2:
            kb = known_brands.get(OA.TB.norm(nb))  # kun maerker vi kender fra arkene (ikke fx "Gourmet")
            if kb:
                changed['Brand'] = kb[0]
        ns = s_(p.get('subbrand'))
        if ns and not s_(cur['Subbrand']) and OA.ph(ns).search(s_(cur['Original Title'])):
            changed['Subbrand'] = ns
        nq = s_(p.get('quantity'))
        if nq and not s_(cur['Quantity']):
            q2 = O.norm_qty(nq)
            if q2 and re.fullmatch(r'(?:ca\. )?(?:\d+ x )?\d+(?:\.\d+)? (?:g|kg|ml|cl|l)', q2) and re.search(re.escape(q2.split(' ')[-2].split('.')[0]), s_(cur['Original Title'])):
                changed['Quantity'] = q2
        npc = p.get('pack_count')
        if npc and int(npc) > 1 and not s_(cur['Pack Count']) and re.search(r'\b' + str(int(npc)) + r'\b', s_(cur['Original Title'])):
            changed['Pack Count'] = int(npc)
        for h, v in changed.items():
            old = row[ix[h]].value
            row[ix[h]].value = v
            stats[f'skrevet:{h}'] += 1
            audit.append([store, rn, h, old, v, f'ai_conf{conf}', p.get('note', '')])
        if lang == 'da' and 'Product Type' in changed and changed['Product Type']:
            pl = O.plural_for(changed['Product Type'], master, fr)
            if pl:
                t = changed['Product Type']
                pl = t if pl.lower() == t.lower() else (pl[0].upper() if t[0].isupper() else pl[0].lower()) + pl[1:]
            if 'Product type plural' in ix:
                row[ix['Product type plural']].value = pl
    print(f'{store}:', dict(stats))
    wb.calculation.fullCalcOnLoad = True
    fd, tmp = tempfile.mkstemp(suffix='.xlsx', dir=os.environ.get('TEMP'))
    os.close(fd)
    wb.save(tmp)
    wb.close()
    stamp = datetime.datetime.now().strftime('%Y-%m-%d_%H%M')
    if dry:
        print(f'{store}: proeve -> {tmp}')
    else:
        if os.path.getmtime(path) != mtime or os.path.exists(lock):
            print(f'{store}: SPRUNGET OVER - arket blev aendret/aabnet imens - koer igen')
            os.remove(tmp)
            return
        os.makedirs(BACKUP, exist_ok=True)
        shutil.copy2(path, os.path.join(BACKUP, f'{os.path.splitext(fn)[0]}_{stamp}_foer_ai-forslag.xlsx'))
        shutil.move(tmp, path)
        print(f'{store}: gemt -> {path}')
    out = BACKUP if not dry else (os.environ.get('TEMP') or tempfile.gettempdir())
    os.makedirs(out, exist_ok=True)
    for name, hdrs, data in (
        (f'ai_{store}_{stamp}_aendringer.csv', ['butik', 'raekke', 'kolonne', 'foer', 'efter', 'regel', 'note'], audit),
        (f'ai_{store}_{stamp}_til_gennemgang.csv', ['id', 'sikkerhed', 'original_title', 'nuvaerende_produkttype', 'forslag', 'note'], review_rows),
        (f'ai_{store}_{stamp}_ikke_mad.csv', ['id', 'original_title', 'produkttype'], nonfood),
        (f'ai_{store}_{stamp}_dyrefoder.csv', ['id', 'original_title'], pet),
    ):
        with open(os.path.join(out, name), 'w', newline='', encoding='utf-8-sig') as f:
            w = csv.writer(f, delimiter=';')
            w.writerow(hdrs)
            w.writerows(data)
    print(f'{store}: {len(audit)} aendringer, {len(review_rows)} til gennemgang, {len(nonfood)} ikke-mad, {len(pet)} dyrefoder -> {out}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    run(a[0], a[1], '--dry' in sys.argv)
