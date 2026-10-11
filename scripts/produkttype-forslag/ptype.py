import collections
import os
import re
import shutil
import tempfile

import openpyxl

ROOT = r"C:\Users\Peter\Desktop\Hello Cal"
TMP = tempfile.mkdtemp()


def load(rel):
    src = os.path.join(ROOT, rel)
    dst = os.path.join(TMP, os.path.basename(rel))
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
    ws = openpyxl.load_workbook(dst, read_only=True, data_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    header = [str(x) if x is not None else "" for x in next(it)]
    return header, list(it)


def col(h, n):
    return h.index(n) if n in h else None


MODIFIERS_DA = set("""
røde rød hvide hvid grønne grøn gule gul sorte sort blå brune brun lyse lys mørke mørk små stor store lille mini maxi
hel hele halv halve helt halvt frisk friske fersk ferske salt salte søde sød syrlige sur sure naturel original classic
light zero plus extra extra premium gourmet special familie familiepakke økologisk øko dansk danske
sprød sprøde blød bløde fyldt fyldte gravad røget kogt kogte stegt stegte tør tørre tørret frossen frosne varm kold
ny nye gammel gamle fin fine grov grove stærk stærke mild milde klassisk klassiske ægte rigtig
""".split())

PREP = re.compile(r"\s+(?:m\.|m/|u\.|u/)\s*(?=\S)|\s+(?:m|u|med|uden|i|på|af|fra|til|à)\s+(?=\S)", re.I)
QTY = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:x|\*)\s*\d+(?:[.,]\d+)?\s*(?:kg|gr|g|mg|ml|cl|dl|ltr|l|stk|pk)\b\.?"
    r"|\b\d+(?:[.,]\d+)?\s*(?:kg|gr|g|mg|ml|cl|dl|ltr|l|stk|pk|pcs|er|_)\b\.?"
    r"|\b\d+\s*-\s*\d+\s*(?:g|gr|kg|ml|cl)\b\.?"
    r"|\bca\.?\s*\d+[.,]?\d*\s*(?:g|gr|kg|ml|cl|l)?\b\.?",
    re.I,
)
PCT = re.compile(r"\b\d+(?:[.,]\d+)?\s*%")
NOISE = re.compile(r"\b(?:øko|økologisk|bio|dk|kl\.?\s*\d|danmark|se\s+vare[n]?|land/kl\.?|land|nul\s+sukker|fairtrade|xxl|xl|kyl\.?|stk\.?|pk\.?|pakke)(?=\W|$)\.?", re.I)
WORD = re.compile(r"[\wæøåäöüß][\wæøåäöüß\-&']*", re.I)


def build_vocab(files, min_len=3):
    c = collections.Counter()
    for rel in files:
        h, rows = load(rel)
        i = col(h, "Product Type")
        if i is None:
            continue
        for r in rows:
            v = r[i]
            if isinstance(v, str):
                v = re.sub(r"\s+", " ", v.strip().lower())
                if len(v) >= min_len:
                    c[v] += 1
    return c


def build_brands(files):
    s = set()
    for rel in files:
        h, rows = load(rel)
        bi = col(h, "Brand")
        for r in rows:
            v = r[bi] if bi is not None else None
            if isinstance(v, str) and len(v.strip()) > 2:
                s.add(v.strip().lower())
    return sorted(s, key=len, reverse=True)


def strip_brand(t, brand, brands):
    low = t.lower()
    cands = []
    if brand:
        cands.append(str(brand).strip().lower())
    cands += brands
    for b in cands:
        if not b:
            continue
        if low.startswith(b + " ") or low == b:
            return t[len(b):].lstrip(" ,.-"), True
    for b in cands:
        if b and low.endswith(" " + b):
            return t[: -len(b)].rstrip(" ,.-"), True
    if brand:
        b = str(brand).strip().lower()
        k = low.find(" " + b + " ")
        if b and k >= 0:
            return (t[:k] + " " + t[k + len(b) + 2:]).strip(" ,.-"), True
    return t, False


def head_phrase(words, vocab):
    """vælg produkttypen i en ordliste: længste frase i ordforrådet bagfra, ellers sidste ikke-modifier-ord."""
    n = len(words)
    for k in (3, 2):
        if n >= k:
            ng = " ".join(words[-k:])
            if vocab.get(ng, 0) >= 2:
                return ng, "høj"
    # fjern afsluttende modifiers
    w = list(words)
    while len(w) > 1 and w[-1] in MODIFIERS_DA:
        w.pop()
    last = w[-1]
    if vocab.get(last, 0) >= 3:
        # tilføj foranstillet modifier (røde linser) hvis den frase findes
        if len(w) >= 2 and vocab.get(w[-2] + " " + last, 0) >= 1:
            return w[-2] + " " + last, "høj"
        return last, "høj"
    if len(w) >= 2 and w[-2] not in MODIFIERS_DA and vocab.get(w[-2] + " " + last, 0) >= 1:
        return w[-2] + " " + last, "middel"
    if vocab.get(last, 0) >= 1:
        return last, "middel"
    # sidste ord er ikke et kendt produkttype (fx smag: "skyr airy strawberry"): tag et tidligere kendt ord
    for cand in w[:-1]:
        if cand not in MODIFIERS_DA and vocab.get(cand, 0) >= 5:
            return cand, "middel"
    # sammensat ord der ender på et kendt ord (fx "hvidvin")
    for k in range(len(last) - 3, 2, -1):
        suf = last[k:]
        if len(suf) >= 4 and vocab.get(suf, 0) >= 5:
            return last, "middel"
    return last, "lav"


def propose_da(title, subtitle, brand, vocab, brands):
    t = (title or "").strip()
    if not t:
        return "", "ingen"
    t = QTY.sub(" ", t)
    t = PCT.sub(" ", t)
    t = NOISE.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip(" ,.-/")
    t, _ = strip_brand(t, brand, brands)
    t = re.sub(r"\s+", " ", t).strip(" ,.-/")
    if not t:
        return "", "ingen"
    low = t.lower()
    if re.search(r"\b\d{2}\+", low):
        return "Ost", "middel"
    segs = [s.strip() for s in low.split(",") if s.strip()]
    best = None
    for s in segs:
        s = PREP.split(" " + s, 1)[0].strip()
        words = WORD.findall(s)
        if not words:
            continue
        ph, conf = head_phrase(words, vocab)
        score = {"høj": 3, "middel": 2, "lav": 1}[conf]
        if best is None or score > best[0]:
            best = (score, ph, conf)
        if score == 3:
            break
    if best is None:
        return "", "ingen"
    return best[1][:1].upper() + best[1][1:], best[2]


# ---------------------------------------------------------------- tysk
MODS_DE = set("""
bio original classic natur naturell natürlich natürliche natürliches fein feine feines extra mild milde mildes frisch frische
frisches vegan vegane veganes glutenfrei laktosefrei light zero mini maxi groß große großes klein kleine kleines
premium gourmet special spezial edel edle traditionell traditionelle klassisch klassische hell helle helles dunkel dunkle
gemahlen ganz ganze ganzes gesalzen ungesalzen gezuckert ungezuckert halbtrocken trocken lieblich süß süße scharf
leicht leichte kernig zart zarte cremig cremige knusprig knusprige pur pure deutsche deutscher deutsches regional regionale
""".split())

PREP_DE = re.compile(r"\s+(?:mit|ohne|in|aus|auf|von|nach|im|am|für|und|&)\s+(?=\S)", re.I)
QTY_DE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:x|\*)\s*\d+(?:[.,]\d+)?\s*(?:kg|g|mg|ml|cl|l|st|stk|stück|er|pk)\b\.?"
    r"|\b\d+(?:[.,]\d+)?\s*(?:kg|g|mg|ml|cl|l|ltr|st|stk|stück|er|blatt|tabs|portionen)\b\.?",
    re.I,
)
NOISE_DE = re.compile(r"\b(?:einweg|mehrweg|dose|flasche|glas|tüte|beutel|bio|vegan|ohne\s+\w+)\b\.?", re.I)


def propose_de(title, subtitle, brand, vocab, current):
    t = (title or "").strip()
    if not t:
        return "", "ingen"
    t = QTY_DE.sub(" ", t)
    t = PCT.sub(" ", t)
    t = re.sub(r'["„“”]', " ", t)
    t = NOISE_DE.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip(" ,.-/")
    b = (str(brand).strip() if brand else "").lower()
    low = t.lower()
    # fjern brand i starten (også flere gange: "REWE Bio", "Gut & Günstig")
    for _ in range(2):
        if b and low.startswith(b + " "):
            t = t[len(b):].lstrip(" ,.-")
            low = t.lower()
    for pre in ("rewe bio", "rewe beste wahl", "rewe regional", "rewe feine welt", "rewe", "edeka bio", "edeka herzstücke", "edeka", "gut & günstig", "alnatura", "dmbio", "dm bio"):
        if low.startswith(pre + " "):
            t = t[len(pre):].lstrip(" ,.-")
            low = t.lower()
            break
    if not t:
        return (current or ""), ("lav" if current else "ingen")
    segs = [s.strip() for s in low.split(",") if s.strip()]
    first = PREP_DE.split(" " + segs[0], 1)[0].strip()
    words = [w for w in WORD.findall(first)]
    if not words:
        return (current or ""), ("lav" if current else "ingen")
    # DM-format: "Typ, Sorte, Menge" -> første komma-led er typen
    if len(segs) >= 2:
        ph = " ".join(words[-2:]) if vocab.get(" ".join(words[-2:]), 0) >= 1 else words[-1]
        return cap_de(ph), "høj"
    # hvis ét ord i ordforrådet (kategorier), tag første/bedste
    best = None
    for w in words:
        if w in MODS_DE:
            continue
        n = vocab.get(w, 0)
        if n >= 2 and (best is None or n > best[0]):
            best = (n, w)
    if best:
        return cap_de(best[1]), "høj" if best[0] >= 5 else "middel"
    for w in words:
        if w not in MODS_DE and len(w) > 3:
            return cap_de(w), "lav"
    return (current or ""), ("lav" if current else "ingen")


def cap_de(s):
    return s[:1].upper() + s[1:] if s else s
