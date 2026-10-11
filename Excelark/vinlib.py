# -*- coding: utf-8 -*-
"""Fælles hjælpefunktioner til vin-regelmotoren (validering + anvendelse)."""
import re, unicodedata, difflib

DA_TYPES = {
    'Spritz', 'Aperitif', 'Likør',
    'Rødvin', 'Hvidvin', 'Rosévin', 'Orangevin', 'Mousserende vin', 'Champagne', 'Cava', 'Prosecco', 'Crémant', 'Portvin',
    'Sherry', 'Madeira', 'Marsala', 'Vermouth', 'Hedvin', 'Dessertvin', 'Sangria', 'Frugtvin', 'Vin',
}
DE_TYPES = {
    'Wein-Aperitif', 'Likör', 'Weinhaltiger Aperitif', 'Aperitif',
    'Rotwein', 'Weißwein', 'Roséwein', 'Orangewein', 'Schaumwein', 'Sekt', 'Prosecco', 'Champagner', 'Crémant', 'Cava', 'Perlwein',
    'Portwein', 'Sherry', 'Madeira', 'Marsala', 'Wermut', 'Likörwein', 'Dessertwein', 'Fruchtwein', 'Glühwein', 'Sangria', 'Wein',
}
SAME_PLURAL = {'Champagne', 'Cava', 'Prosecco', 'Crémant'}
NO_PLURAL = {'Sherry', 'Madeira', 'Marsala', 'Vermouth', 'Sangria'}
FUNC = {'og', 'med', 'uden', 'af', 'i', 'de', 'du', 'di', 'la', 'le', 'les', 'der', 'die', 'das', 'und', 'von', 'van', 'del', 'della',
        'dei', 'dos', 'da', 'des', 'the', 'of', 'et', 'en', 'el', 'a', 'e', 'o', 'y', 'by', 'mit', 'ohne', 'im', 'am', 'vom', 'zur', 'zum',
        'd', 'l', 'à', 'au', 'aux', 'sur', 'sous', 'di', 'delle', 'degli'}
COUNTRIES_DA = {'Frankrig', 'Italien', 'Spanien', 'Tyskland', 'Portugal', 'Australien', 'Chile', 'Argentina', 'Sydafrika', 'New Zealand',
                'USA', 'Østrig', 'Ungarn', 'Grækenland', 'Rumænien', 'Danmark', 'Schweiz', 'Moldova', 'Georgien', 'Bulgarien', 'Kroatien',
                'Slovenien', 'Libanon', 'Israel', 'Uruguay', 'Brasilien', 'Mexico', 'Canada', 'England', 'Sverige', 'Holland', 'Belgien',
                'Luxembourg', 'Tjekkiet', 'Slovakiet', 'Cypern', 'Malta', 'Marokko', 'Tunesien', 'Kina', 'Japan', 'Skotland', 'Irland',
                'Polen', 'Norge', 'Finland', 'Island', 'Cuba', 'Mexico', 'Peru', 'Armenien', 'Serbien', 'Makedonien', 'Montenegro',
                'Frankrig / Spanien'}


def fold(s):
    s = (s or '').replace('’', "'").replace('´', "'").replace('`', "'").replace('ʼ', "'")
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return s.casefold()


def tokens(s):
    return [t for t in re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)?", s or '')]


def ftokens(s):
    return [fold(t).replace('’', "'") for t in tokens(s)]


def plural_for(pt, lang):
    if lang == 'de' or not pt:
        return ''
    if pt in SAME_PLURAL:
        return pt
    if pt in NO_PLURAL:
        return ''
    if pt.lower().endswith('vin'):
        return pt + 'e'
    return None  # ukendt: rør ikke


def corpus(rec):
    """alle ord rækken selv indeholder (til 'opfundne ord'-tjekket)"""
    parts = [rec.get('ot'), rec.get('pn'), rec.get('st'), rec.get('pt'), rec.get('brand'), rec.get('sub'), rec.get('var'),
             rec.get('mf'), rec.get('cat'), rec.get('country')] + list(rec.get('kw') or [])
    out = set()
    for p in parts:
        for t in ftokens(p):
            out.add(t)
    return out


def prefix_ok(tok, pool):
    """tok er et ord der findes i pool, eller en fuldførelse af et afkortet ord (kilde-ord er præfiks), eller omvendt"""
    if tok in pool:
        return True
    if len(tok) >= 3:
        for p in pool:
            if len(p) >= 3 and (tok.startswith(p) or p.startswith(tok)):
                return True
    return False


EXPAND_OK = {'cabernet', 'sauvignon', 'chardonnay', 'zinfandel', 'tempranillo', 'mourvedre', 'classico', 'reserva', 'riserva', 'grande',
             'rose', 'rosé', 'blanc', 'rouge', 'rosso', 'bianco', 'sec', 'brut', 'doc', 'docg', 'aoc', 'aop', 'igt', 'igp'}
ROMAN = re.compile(r'^[ivxlc]+$')
COLOR = {'blanc', 'rouge', 'rosso', 'bianco', 'hvid', 'rød', 'rod', 'rose', 'rosé', 'white', 'red', 'rotwein', 'weisswein', 'rosato', 'tinto', 'blanco', 'rosado', 'branco', 'weiss', 'rot', 'weiß', 'rosa', 'noir', 'vin', 'wine', 'wein', 'vino'}


def validate(rec, out, lang):
    """returnér liste af (kode, tekst) for en række (rec = input, out = agentens resultat)"""
    iss = []
    sec = out['section']
    pt = out['productType']
    types = DA_TYPES if lang == 'da' else DE_TYPES
    if sec == 'other':
        return iss
    if sec in ('wine', 'sparkling', 'fortified', 'aperitif', 'fruitwine'):
        if pt not in types and not (lang == 'da' and re.fullmatch(r'[A-ZÆØÅ][a-zæøåé]+vin', pt or '')):
            iss.append(('TYPE', f'productType uden for listen: {pt!r}'))
    elif sec == 'spirit':
        if not pt:
            iss.append(('TYPE', 'spiritus uden produkttype'))
    brand = out['brand'] or ''
    sub = out['subbrand'] or ''
    var = out['variation'] or ''
    kws = out['keywords'] or []
    # nøgleord
    if len(kws) > 5: iss.append(('KW', 'flere end 5 nøgleord'))
    if any((k or '') != (k or '').strip() or not (k or '').strip() for k in kws): iss.append(('KW', 'tomt/uafklippet nøgleord'))
    for f, v in (('variation', var), ('subbrand', sub), ('brand', brand)):
        if v != v.strip(): iss.append(('WS', f'{f} har mellemrum først/sidst'))
    alltext = ' '.join([var, sub] + kws)
    if re.search(r'%|\bvol\b|\d+\s?(?:cl|ml|ltr|liter)\b|\d+\s?l\b', alltext, re.I):
        iss.append(('UNIT', f'procent/mængde i variation/nøgleord: {alltext[:80]}'))
    if re.search(r'[/&]', var) or re.search(r'[/&]', ' '.join(kws)):
        iss.append(('LIST', f'listetegn i variation/nøgleord: {var[:60]} | {kws}'))
    if lang == 'da':
        def lowerish(s):
            for t in re.findall(r"[^\s,]+", s):
                if t.isupper() and len(t) >= 2: continue  # forkortelse
                if t != t.lower(): return False
            return True
        if not lowerish(var): iss.append(('CASE', f'variation ikke med småt: {var}'))
        if any(not lowerish(k) for k in kws): iss.append(('CASE', f'nøgleord ikke med småt: {kws}'))
        c = out['country']
        if c and c not in COUNTRIES_DA: iss.append(('COUNTRY', f'ukendt/forkert skrevet land: {c}'))
    # dobbeltord
    seen = {}
    fields = [('type', pt), ('sub', sub), ('var', var)] + [(f'kw{i+1}', k) for i, k in enumerate(kws)]
    bw = {t for t in ftokens(brand) if t not in FUNC and len(t) > 1}
    for name, val in fields:
        for t in ftokens(val):
            if t in FUNC or len(t) < 2 or t.isdigit(): continue
            if t in seen and seen[t] != name:
                iss.append(('DUP', f'ord "{t}" i både {seen[t]} og {name}'))
            seen[t] = name
            if t in bw and name != 'sub':
                iss.append(('BRANDWORD' if name != 'var' else 'BRANDWORD_VAR', f'brandord "{t}" i {name}'))
    # samme ord to gange i samme celle
    for name, val in fields:
        tl = [t for t in ftokens(val) if t not in FUNC and not t.isdigit() and len(t) > 1]
        if len(tl) != len(set(tl)):
            iss.append(('DUPCELL', f'ord to gange i {name}: {val}'))
    # opfundne ord
    pool = corpus(rec)
    known_words = pool
    for name, val in [('brand', brand), ('sub', sub), ('var', var)] + [(f'kw{i+1}', k) for i, k in enumerate(kws)]:
        for t in ftokens(val):
            if t in FUNC or t.isdigit() or len(t) < 2: continue
            if not prefix_ok(t, known_words) and t not in EXPAND_OK:
                iss.append(('NEWWORD', f'nyt ord "{t}" i {name}: {val}'))
    # tabte ord
    new_all = set()
    for v in [brand, sub, var, pt, out['country'] or ''] + kws:
        for t in ftokens(v): new_all.add(t)
    old_text = ' '.join([rec.get('sub') or '', rec.get('var') or ''] + [k for k in (rec.get('kw') or [])])
    for t in ftokens(old_text):
        if t in FUNC or t.isdigit() or len(t) < 3: continue
        if t in new_all: continue
        if any(n.startswith(t) or t.startswith(n) and len(n) >= 4 for n in new_all): continue
        if t in COLOR or t in ('bib', 'bag', 'box', 'vol', 'bagin', 'pack', 'pak'): continue
        if any(difflib.SequenceMatcher(None, t, n).ratio() >= 0.75 for n in new_all): continue
        iss.append(('DROPPED', f'ord "{t}" fra gamle felter findes ikke længere'))
    if out.get('misfiled'):
        iss.append(('MISFILED', f'fejlplaceret: {rec.get("pt")} -> {pt}'))
    return iss
