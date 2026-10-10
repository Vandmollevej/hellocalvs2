"""REMA til Bilka-kolonnerne og Bilka-reglerne (brugerens oenske 2026-10-10: "alt det vi har gjort i Bilka").
Brug: python omlaeg_rema.py [--dry]   (arket skal vaere lukket i Excel, naar det ikke er --dry)

Bygger oven paa omlaeg_til_bilka_kolonner.py (samme kolonner, formler og danske regler som SPAR/Nemlig/Wolt):
- REMA's egne kolonnenavne (is_vegan, is_biological, is_Packaging ...) laeses som Bilkas (_is_vegan, _is_organic, packaging ...).
- Originalkolonnerne (Original Title, Product Name, Subtitle, Source URL, Image File, Parse Status) hentes 1:1 fra
  den raa skrabning `Excelark/rema1000 - To be compaired.xlsx` (match paa varenummeret i Source URL) og rettes aldrig.
- category udfyldes med REMA's egen kategori fra skrabningen, hvor den er tom.
- _is_fat "0.4% fedt" -> "0.4%"; "light"/"0 kcal" i sukker-/fedtkolonnen og "i skiver" i pakning bliver keywords (som i Bilka).
- REMA's ekstra kolonner (Type, size, is_healthy, is_social_responsibility) bevares bagerst; dem bruger importen.
- Masse-ord (O.MASS_BLANK) faar tomt `Product type plural`, foer Bilkas flertal slaas op.
- Kan koeres igen paa det omlagte ark.
"""
import datetime, os, re, shutil, sys, tempfile
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import omlaeg_til_bilka_kolonner as O  # noqa: E402
import titel_ental_flertal as T  # noqa: E402

SRC = os.path.join(O.ROOT, 'Produkter', 'rema1000_version 2.xlsx')
RAW = os.path.join(HERE, 'rema1000 - To be compaired.xlsx')
RENAME = {
    'is_vegan': '_is_vegan', 'is_meat': '_is_meat', '_is_allergies': '_is_allergy', 'is_lactose_free': '_is_lactose_free',
    'is_gluten_free': '_is_glutenfree', 'is_sugar_free': '_is_sugar_free', 'is_alcohol_free': '_is_alcohol_free',
    'is_biological': '_is_organic', 'is_whole_grain': '_is_whole_grain', 'is_animal_wellfare': '_is_animal_welfare',
    'is_country_of_origin': '_is_country_of_origen', 'is_Packaging': 'packaging',
    'Source url': 'Source URL', 'Image file': 'Image File', 'Parse status': 'Parse Status',
}
VARE_ID = re.compile(r'/varer/(\d+)', re.I)
_plural_for = O.plural_for


def plural_for(ty, master, fr):
    """masse-ord (sodavand, tofu, skyr, kaffe ...) har intet flertal (NAVNEREGLER) - ogsaa naar Bilka-flertallet siger andet;
    ellers bliver ental-titlen boejet i flertal ('Sodavand ... sukkerfrie')"""
    words = ty.strip().lower().split(' ')
    head = words[0]
    for i, w in enumerate(words):
        if i > 0 and w in T.PREP:
            break
        head = w
    return None if head in O.MASS_BLANK else _plural_for(ty, master, fr)


O.plural_for = plural_for


def vare_id(url):
    m = VARE_ID.search(str(url or ''))
    return m.group(1) if m else None


def prepare(tmpdir):
    """REMA-arket med Bilka-navne + raa ark med kun originalkolonnerne -> to midlertidige filer"""
    hdr, rows = O.read(SRC)
    raw_hdr, raw_rows = O.read(RAW)
    rx = {h: i for i, h in enumerate(raw_hdr)}
    raw_by_id = {vare_id(r[rx['Source URL']]): r for r in raw_rows}
    hdr = [RENAME.get(h, h) for h in hdr]
    ix = {h: i for i, h in enumerate(hdr)}
    for h in ('Original Title', 'Product Name', 'Subtitle'):
        if h not in ix:
            hdr.append(h)
            ix[h] = len(hdr) - 1
    kw = [f'keyword{n}' for n in range(1, 6)]
    for k in kw:
        if k not in ix:
            hdr.append(k)
            ix[k] = len(hdr) - 1
    out = []
    for r in rows:
        r = list(r) + [None] * (len(hdr) - len(r))
        raw = raw_by_id.get(vare_id(r[ix['Source URL']]))
        if raw is not None:
            r[ix['Source URL']] = raw[rx['Source URL']]  # samme tekst som skrabningen, saa O.convert kan matche
            if not r[ix['category']] and raw[rx['Category']]:
                r[ix['category']] = raw[rx['Category']]
        kws = [r[ix[k]] for k in kw]

        def add_kw(v):
            if not any(isinstance(k, str) and k.lower() == v for k in kws):
                kws[kws.index(None)] = v
        fat = r[ix['_is_fat']]
        if isinstance(fat, str) and re.search(r'kcal|kalorier|^\s*light\s*$', fat, re.I):  # ikke fedt: bliver keyword
            r[ix['_is_fat']] = None
            add_kw(fat.strip().lower())
        elif isinstance(fat, str) and '%' in fat:
            r[ix['_is_fat']] = re.sub(r'\s*fedt\b', '', fat).strip() or None
        if isinstance(r[ix['_is_sugar_free']], str) and r[ix['_is_sugar_free']].strip().lower() == 'light':
            r[ix['_is_sugar_free']] = None
            add_kw('light')
        pk = r[ix['packaging']]
        if isinstance(pk, str) and 'i skiver' in pk.lower():
            rest = [p for p in re.split(r'\s*,\s*', pk) if p.strip().lower() != 'i skiver']
            r[ix['packaging']] = ', '.join(rest) or None
            add_kw('i skiver')
        for k, v in zip(kw, kws):
            r[ix[k]] = v
        out.append(r)
    paths = []
    for name, h, rr in (('rema_laes', hdr, out),
                        ('rema_raa', [h for h in O.ORIG if h in rx], [[r[rx[h]] for h in O.ORIG if h in rx] for r in raw_rows])):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(h)
        for r in rr:
            ws.append(r)
        p = os.path.join(tmpdir, name + '.xlsx')
        wb.save(p)
        paths.append(p)
    return paths


def main(dry):
    tmpdir = tempfile.mkdtemp(dir=os.environ.get('TEMP'))
    read_path, raw_path = prepare(tmpdir)
    if not dry:
        lock = os.path.join(os.path.dirname(SRC), '~$' + os.path.basename(SRC))
        if os.path.exists(lock):
            raise SystemExit('REMA er aaben i Excel - luk den foerst')
        os.makedirs(O.BACKUP, exist_ok=True)
        stamp = datetime.datetime.now().strftime('%Y-%m-%d_%H%M')
        shutil.copy2(SRC, os.path.join(O.BACKUP, f'rema1000_version 2_{stamp}_foer_bilka-kolonner.xlsx'))
    bhdr, a2, b2, master = O.bilka_master()
    fr = T.load_frida_plurals()
    cfg = dict(src=SRC, read=read_path, raw=raw_path, lang='da')
    return O.convert('rema', cfg, bhdr, a2, b2, master, fr, dry)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(main('--dry' in sys.argv))
