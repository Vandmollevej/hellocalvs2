import collections
import json
import random
import re

from ptype import *

random.seed(12)
BASE = r"C:\Users\Peter\AppData\Local\Temp\claude\C--Users-Peter-Desktop-Hello-Cal\a9cdef6b-c918-4988-a04f-bce306e12af7\scratchpad"

da_vocab = build_vocab(["Excelark/bilka.xlsx", "Produkter/rema1000_version 2.xlsx", "Frida-ark/frida.xlsx"])
da_brands = build_brands(["Excelark/bilka.xlsx", "Produkter/rema1000_version 2.xlsx"])
de_vocab = build_vocab(["Excelark/dm.xlsx", "Excelark/edeka.xlsx", "Excelark/rewe.xlsx"])

SHEETS = [
    ("DRK", "Excelark/drk.xlsx", "da"),
    ("Årstiderne", "Excelark/aarstiderne.xlsx", "da"),
    ("SPAR", "Excelark/spar.xlsx", "da"),
    ("Wolt", "Excelark/wolt.xlsx", "da"),
    ("DM", "Excelark/dm.xlsx", "de"),
    ("EDEKA", "Excelark/edeka.xlsx", "de"),
    ("REWE", "Excelark/rewe.xlsx", "de"),
]

ORG = re.compile(r"(?<!\w)(?:øko\.?|økologisk(?:e)?|økologi|bio)(?!\w)", re.I)
DISPLAY_NOISE_DE = re.compile(r"(?<!\w)(?:einweg|mehrweg)(?!\w)", re.I)
TOK = re.compile(r"[\wÆØÅæøåÄÖÜäöüß][\wÆØÅæøåÄÖÜäöüß'\-/\.]*")
FUNC = {
    "da": {"m", "m.", "m/", "med", "u", "u.", "u/", "uden", "i", "og", "af", "på", "fra", "til", "à", "&", "en", "et", "den", "det", "kl", "dk"},
    "de": {"mit", "ohne", "und", "in", "aus", "von", "für", "im", "am", "der", "die", "das", "&", "auf", "zum", "zur", "nach", "de", "la", "le"},
}
NORM_FUNC = {"m": "med", "m.": "med", "m/": "med", "u": "uden", "u.": "uden", "u/": "uden"}
UNIT = re.compile(r"^(?:\d+[.,]?\d*|\d+[.,]?\d*(?:kg|g|gr|mg|ml|cl|dl|l|lt|ltr|stk|pk)|kg|g|gr|mg|ml|cl|dl|l|lt|ltr|stk|pk|x|pcs|er|%|ca|ca\.|_)$", re.I)
ORGANIC_WORDS = {"øko", "øko.", "økologisk", "økologiske", "økologi", "bio"}


def display_title(t, lang):
    t = str(t)
    t = (QTY if lang == "da" else QTY_DE).sub(" ", t)
    t = PCT.sub(" ", t)
    t = ORG.sub(" ", t)
    if lang == "de":
        t = DISPLAY_NOISE_DE.sub(" ", t)
    if lang == "da":
        t = re.sub(r"(?<![\wÆØÅæøå])m[/.]\s*(?=[\wÆØÅæøå])", "med ", t, flags=re.I)
        t = re.sub(r"(?<![\wÆØÅæøå])u[/.]\s*(?=[\wÆØÅæøå])", "uden ", t, flags=re.I)
    t = re.sub(r"\s+", " ", t)
    return t.strip(" ,.-/")


def words_of(text):
    return {w.lower().strip(".,/-'") for w in TOK.findall(str(text or ""))}


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
    if lw.endswith("s") and len(lw) > 5 and vocab.get(lw[:-1], 0) >= 2:
        return True
    if "/" in lw or lw in ("str", "str.", "xl", "xxl", "stk", "m/l"):
        return True
    return False


def detect_brand_da(clean_t, brand_col, brands, vocab):
    if brand_col and str(brand_col).strip().lower() in clean_t.lower():
        return str(brand_col).strip(), "kolonne"
    low = clean_t.lower()
    for b in brands:
        if len(b) < 3:
            continue
        if low.startswith(b + " ") or low.endswith(" " + b) or (" " + b + " ") in low or low == b:
            k = low.find(b)
            return clean_t[k:k + len(b)], "liste"
    toks = clean_t.split()
    if len(toks) >= 2:
        lowers = sum(1 for x in toks if x[:1].islower())
        uppers = sum(1 for x in toks if x[:1].isupper())
        if lowers >= 1 and uppers >= 2:
            cap = [x for x in toks[1:] if x[:1].isupper() and not is_known_word(x, vocab) and not looks_like_modifier(x, vocab)]
            if cap:
                return " ".join(cap), "gæt"
        first = toks[0]
        if (first[:1].isupper() and len(first) >= 3 and vocab.get(first.lower(), 0) == 0
                and not looks_like_modifier(first, vocab) and any(vocab.get(x.lower(), 0) >= 3 for x in toks[1:])):
            return first, "gæt"
    return "", ""


def process(sheet, rel, lang):
    h, rows = load(rel)
    ix = {c: col(h, c) for c in ("Brand", "Subbrand", "Product Type", "Variation", "Original Title", "Subtitle", "Quantity",
                                  "Packaging", "Product type plural")}
    kwi = [i for i, n in enumerate(h) if n.startswith("Keyword ")]
    isi = [i for i, n in enumerate(h) if n.startswith("_is_")]
    vocab = da_vocab if lang == "da" else de_vocab
    changes = []
    stats = collections.Counter()
    for n, r in enumerate(rows, start=2):
        raw = r[ix["Original Title"]] if ix["Original Title"] is not None else None
        if not raw:
            continue
        sub = r[ix["Subtitle"]] if ix["Subtitle"] is not None else None
        brand_col = (r[ix["Brand"]] or "").strip() if ix["Brand"] is not None and r[ix["Brand"]] else ""
        cur_type = (r[ix["Product Type"]] or "").strip() if r[ix["Product Type"]] else ""
        cur_var = (r[ix["Variation"]] or "").strip() if ix["Variation"] is not None and r[ix["Variation"]] else ""
        shown = display_title(raw, lang)
        # --- brand
        brand_new, brand_src = brand_col, "kolonne" if brand_col else ""
        if lang == "da":
            if not brand_col:
                b, src = detect_brand_da(shown, "", da_brands, da_vocab)
                if b:
                    brand_new, brand_src = b, src
            prop, conf = propose_da(str(raw), sub, brand_new, da_vocab, da_brands)
        else:
            prop, conf = propose_de(str(raw), sub, brand_col, de_vocab, cur_type)
        # --- produkttype
        new_type = cur_type
        if prop and (not cur_type or conf in ("høj", "middel")):
            new_type = prop
        # --- ord der skal fordeles
        covered = set()
        for txt in (brand_new, r[ix["Subbrand"]] if ix["Subbrand"] is not None else "", new_type, cur_var,
                    r[ix["Quantity"]] if ix["Quantity"] is not None else "", r[ix["Packaging"]] if ix["Packaging"] is not None else ""):
            covered |= words_of(txt)
        for i in kwi + isi:
            if r[i] not in (None, ""):
                covered |= words_of(r[i])
        toks = TOK.findall(shown)
        out_tokens = []
        pending_func = []
        unplaced = []
        for t in toks:
            lw = t.lower().strip(".,/-'")
            if not lw or UNIT.match(lw) or lw in ORGANIC_WORDS:
                pending_func = []
                continue
            if lw in FUNC[lang]:
                pending_func.append(NORM_FUNC.get(lw, lw))
                continue
            is_cov = lw in covered or (len(lw) >= 6 and any(w.startswith(lw[:6]) or lw.startswith(w[:6]) for w in covered if len(w) >= 6))
            if is_cov:
                pending_func = []
                continue
            out_tokens.extend(pending_func)
            pending_func = []
            out_tokens.append(t if lang == "de" else t.lower())
            covered.add(lw)
        addition = " ".join(out_tokens).strip()
        new_var = cur_var
        note = None
        if addition:
            if lang == "de" and not brand_new:
                # ukendt brand i tyske ark: ordene kan være brandnavn -> ikke fordelt, men markeret
                note = "Ord ikke fordelt (brand mangler i arket): " + addition
                stats["tysk_uden_brand_flag"] += 1
            else:
                new_var = (cur_var + " " + addition).strip() if cur_var else addition
        ch = {}
        if brand_new and brand_new != brand_col and ix["Brand"] is not None:
            ch["Brand"] = brand_new
            stats["brand_" + (brand_src or "?")] += 1
        if new_type and new_type != cur_type:
            ch["Product Type"] = new_type
            stats["type_ny" if not cur_type else "type_rettet"] += 1
        if new_var != cur_var and ix["Variation"] is not None:
            ch["Variation"] = new_var
            stats["variation"] += 1
        if (ix["Product type plural"] is not None and not r[ix["Product type plural"]] and (new_type or cur_type)):
            ch["Product type plural"] = new_type or cur_type
            stats["plural_udfyldt"] += 1
        if note:
            ch["_note"] = note
        if ch:
            ch["row"] = n
            ch["orig"] = str(raw)
            changes.append(ch)
    return {"sheet": sheet, "file": rel, "lang": lang, "rows": len(rows), "changes": changes, "stats": dict(stats),
            "has_plural": ix["Product type plural"] is not None}


result = [process(*s) for s in SHEETS]
json.dump(result, open(BASE + r"\type_changes.json", "w", encoding="utf-8"), ensure_ascii=False)
for r in result:
    print(r["sheet"], r["rows"], "ændringer i", len(r["changes"]), "rækker", r["stats"])
for r in result:
    ex = random.sample(r["changes"], min(5, len(r["changes"])))
    print("##", r["sheet"])
    for c in ex:
        print("   ", c)
