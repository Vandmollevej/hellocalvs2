import collections
import random
import re

from ptype import *

random.seed(8)
da_vocab = build_vocab(["Excelark/bilka.xlsx", "Produkter/rema1000_version 2.xlsx", "Frida-ark/frida.xlsx"])
da_brands = build_brands(["Excelark/bilka.xlsx", "Produkter/rema1000_version 2.xlsx"])
de_vocab = build_vocab(["Excelark/dm.xlsx", "Excelark/edeka.xlsx", "Excelark/rewe.xlsx"])

SHEETS = {
    "da": [("DRK", "Excelark/drk.xlsx"), ("Årstiderne", "Excelark/aarstiderne.xlsx"), ("SPAR", "Excelark/spar.xlsx"), ("Wolt", "Excelark/wolt.xlsx")],
    "de": [("DM", "Excelark/dm.xlsx"), ("EDEKA", "Excelark/edeka.xlsx"), ("REWE", "Excelark/rewe.xlsx")],
}

ORG = re.compile(r"(?<!\w)(?:øko\.?|økologisk(?:e)?|økologi|bio)(?!\w)", re.I)
DISPLAY_NOISE_DE = re.compile(r"(?<!\w)(?:einweg|mehrweg)(?!\w)", re.I)


def display_title(t, lang):
    t = str(t)
    t = (QTY if lang == "da" else QTY_DE).sub(" ", t)
    t = PCT.sub(" ", t)
    t = ORG.sub(" ", t)
    if lang == "de":
        t = DISPLAY_NOISE_DE.sub(" ", t)
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s+([,.])", r"\1", t)
    t = re.sub(r"(,\s*)+$", "", t.strip())
    return t.strip(" ,.-/")


def is_known_word(w, vocab):
    return vocab.get(w.lower(), 0) >= 2


ADJ_SUFFIX = ("fri", "røget", "kogt", "stegt", "skåret", "hakket", "blandet", "fyldt", "tørret", "saltet", "pillet", "bladet",
              "ede", "ende", "ig", "lig", "agtig", "holdig", "hvidt", "salt")


def looks_like_modifier(w, vocab):
    lw = w.lower().strip(".,")
    if lw in MODIFIERS_DA:
        return True
    if lw.endswith(ADJ_SUFFIX) and len(lw) > 4:
        return True
    # sammensætningsled med genitiv-s: "fuldkorns", "grøntsags" (stammen er et kendt ord)
    if lw.endswith("s") and len(lw) > 5 and vocab.get(lw[:-1], 0) >= 2:
        return True
    if "/" in lw or lw in ("str", "str.", "xl", "xxl", "stk", "m/l"):
        return True
    return False


def detect_brand_da(clean_t, brand_col, brands, vocab):
    """returnerer (brand, kilde)"""
    if brand_col and str(brand_col).strip().lower() in clean_t.lower():
        return str(brand_col).strip(), "Brand-kolonne"
    low = clean_t.lower()
    for b in brands:
        if len(b) < 3:
            continue
        if low.startswith(b + " ") or low.endswith(" " + b) or (" " + b + " ") in low or low == b:
            k = low.find(b)
            return clean_t[k:k + len(b)], "brandliste (Bilka/REMA)"
    toks = clean_t.split()
    if len(toks) >= 2:
        lowers = sum(1 for x in toks if x[:1].islower())
        uppers = sum(1 for x in toks if x[:1].isupper())
        # blandet store/små (fx DRK): store bogstaver midt i teksten = formentlig brand
        if lowers >= 1 and uppers >= 2:
            cap = [x for x in toks[1:] if x[:1].isupper() and not is_known_word(x, vocab) and not looks_like_modifier(x, vocab)]
            if cap:
                return " ".join(cap), "gæt: stort bogstav midt i titlen"
        # første ord ukendt, resten genkendt som produkttype
        first = toks[0]
        if (
            first[:1].isupper()
            and len(first) >= 3
            and vocab.get(first.lower(), 0) == 0
            and not looks_like_modifier(first, vocab)
            and any(vocab.get(x.lower(), 0) >= 3 for x in toks[1:])
        ):
            return first, "gæt: ukendt første ord"
    return "", ""


def detect_brand_de(clean_t, brand_col):
    if brand_col and str(brand_col).strip():
        return str(brand_col).strip(), "Brand-kolonne"
    return "", ""


out = openpyxl.Workbook()
out.remove(out.active)
summary = {}
HEAD = ["Ark", "Række", "Originaltitel (renset for økologi, mængde mv.)", "Subtitel (Subtitle)", "Nuværende Product Type",
        "Forslag: produkttype", "Brand", "Brand-kilde", "Sikkerhed", "Original (uændret)"]
for lang, files in SHEETS.items():
    ws = out.create_sheet("Danske" if lang == "da" else "Tyske")
    ws.append(HEAD)
    cnt = collections.Counter()
    bcnt = collections.Counter()
    for name, rel in files:
        h, rows = load(rel)
        ti, si, pi, bi = col(h, "Original Title"), col(h, "Subtitle"), col(h, "Product Type"), col(h, "Brand")
        for n, r in enumerate(rows, start=2):
            raw = r[ti] if ti is not None else None
            if not raw:
                continue
            sub = r[si] if si is not None else None
            brand_col = r[bi] if bi is not None else None
            cur = r[pi] if pi is not None else None
            shown = display_title(raw, lang)
            if lang == "da":
                brand, src = detect_brand_da(shown, brand_col, da_brands, da_vocab)
                prop, conf = propose_da(str(raw), sub, brand or brand_col, da_vocab, da_brands)
            else:
                brand, src = detect_brand_de(shown, brand_col)
                prop, conf = propose_de(str(raw), sub, brand_col, de_vocab, cur)
            ws.append([name, n, shown, sub, cur, prop, brand, src, conf, raw])
            cnt[conf] += 1
            bcnt[(name, src or "ingen")] += 1
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    for c, w in zip("ABCDEFGHIJ", (12, 8, 52, 24, 28, 28, 22, 26, 10, 52)):
        ws.column_dimensions[c].width = w
    summary[lang] = (dict(cnt), dict(bcnt))

dest = os.path.join(ROOT, "Excelark", "produkttype-forslag-2.xlsx")
out.save(dest)
print(dest)
for lang, (c, b) in summary.items():
    print(lang, c)
    for k, v in sorted(b.items()):
        print("   ", k, v)
wb = openpyxl.load_workbook(dest, read_only=True)
rows = [r for r in wb["Danske"].iter_rows(min_row=2, values_only=True) if r[0] == "DRK"]
for r in random.sample(rows, 25):
    print("  ", repr(r[2])[:48], "|", r[5], "|", r[6], "|", r[7], "|", r[8])

