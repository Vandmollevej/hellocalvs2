"""Regel-lint for butiksark (brugerens regler 2026-10-11). Læser en kopi af arket og tæller/viser overtrædelser."""
import collections
import os
import re
import shutil
import sys
import tempfile

import openpyxl

ROOT = r"C:\Users\Peter\Desktop\Hello Cal"
TOK = re.compile(r"[\wÆØÅæøåÄÖÜäöüß][\wÆØÅæøåÄÖÜäöüß'’\.]*", re.U)
FUNC = {
    "med", "uden", "i", "og", "af", "på", "fra", "til", "m", "u", "à", "mit", "ohne", "und", "in", "aus", "von", "für", "im", "am",
    "der", "die", "das", "den", "det", "en", "et", "ein", "eine", "nach", "auf", "zum", "zur", "bei", "mind", "dem", "des", "&", "x",
}
DATE = re.compile(r"\bMHD\b|\bmindestens\s+haltbar|\b\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4})\b|\b(?:best\s*before|bedst\s*før)\b", re.I)
PET = re.compile(r"alleinfutter|ergänzungsfutter|katzenfutter|hundefutter|katzen|hunde|futter|tierfutter|kattemad|hundefoder|dyrefoder|"
                 r"\bcat food\b|\bdog food\b|kitten|welpen|snack für (?:hunde|katzen)|\bfür katzen\b|\bfür hunde\b", re.I)
CATEGORY_PATTERN = re.compile(r"&|^aromen\b|\bgetränke?\b|\bsüßwaren\b|\bkonserven\b|\bbackzutaten\b|\bbackwaren\b", re.I)
WEIGHT_UNITS = r"(?:kg|g|gr|mg|ml|cl|dl|l|ltr|liter|lt)"
QTY_OK = re.compile(rf"^(?:ca\.\s*)?\d+(?:\.\d+)?\s(?:kg|g|mg|ml|cl|dl|l)$|^$")
FLAGWORDS = re.compile(r"\b(alkoholfri|alkoholfrei|sukkerfri|zuckerfrei|glutenfri|glutenfrei|laktosefri|laktosefrei|lactosefrei|vegansk|vegan|økologisk|bio)\b", re.I)
CERT = re.compile(r"\b(MSC|ASC|Fairtrade|Rainforest|Demeter|Bioland|Naturland)\b", re.I)
ALC = re.compile(r"%\s*vol|alkoholgehalt|\bvol\.?\b", re.I)
ORIGIN_ADJ = re.compile(r"\b(fransk|italiensk|spansk|tysk|dansk|svensk|norsk|græsk|tyrkisk|chilensk|argentinsk|sydafrikansk|portugisisk|østrigsk|"
                        r"französisch|italienisch|spanisch|deutsch|dänisch|griechisch|türkisch|chilenisch|argentinisch)\w*\b", re.I)


def load(rel):
    src = os.path.join(ROOT, rel)
    dst = os.path.join(tempfile.gettempdir(), "lint_" + os.path.basename(rel))
    shutil.copy2(src, dst)
    ws = openpyxl.load_workbook(dst, read_only=True, data_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    h = [str(x) if x is not None else "" for x in next(it)]
    return h, list(it)


def words(s):
    return [w.lower().strip(".'’") for w in TOK.findall(str(s or ""))]


def lint(rel, examples=3, only=None):
    h, rows = load(rel)
    ix = {}
    for i, n in enumerate(h):
        ix.setdefault(n, i)
    ix2 = {}
    alc_cols = [i for i, n in enumerate(h) if n == "_is_alcohol"]
    kw = [i for i, n in enumerate(h) if n.startswith("Keyword ")]
    isc = [i for i, n in enumerate(h) if n.startswith("_is_")]
    res = collections.defaultdict(list)

    def g(r, c):
        i = ix.get(c)
        return r[i] if i is not None else None

    for n, r in enumerate(rows, start=2):
        t = g(r, "Original Title")
        pt, var, br, sb = g(r, "Product Type"), g(r, "Variation"), g(r, "Brand"), g(r, "Subbrand")
        q, pc, cat = g(r, "Quantity"), g(r, "Pack Count"), g(r, "Category")
        kws = [r[i] for i in kw if r[i]]
        own = {"Product Type": pt, "Variation": var, "Brand": br, "Subbrand": sb, "Keywords": " | ".join(map(str, kws))}
        # L1/L2 Quantity
        if q not in (None, ""):
            qs = str(q).strip()
            if not QTY_OK.match(qs):
                res["L1_Quantity_ikke_vægt_volumen_eller_ukendt_format"].append((n, qs))
            if re.search(r"\b(stk|pk|pak|bakke|pose|stück|st)\b", qs, re.I):
                res["L1b_Quantity_indeholder_stk"].append((n, qs))
        # L3 Pack Count
        if pc not in (None, ""):
            if not re.fullmatch(r"\d+", str(pc).strip().split(".")[0]) or not str(pc).replace(".0", "").isdigit():
                res["L3_PackCount_ikke_heltal"].append((n, pc))
        # L5 MHD/dato
        for k, v in own.items():
            if v and DATE.search(str(v)):
                res["L5_MHD_dato_i_" + k].append((n, str(v)[:70]))
        # L6 tal som type
        if pt and re.match(r"^\s*\d", str(pt)):
            res["L6_produkttype_starter_med_tal"].append((n, pt))
        # L7 kategori som type
        if pt and (str(pt).strip().lower() == str(cat or "").strip().lower() or CATEGORY_PATTERN.search(str(pt))):
            res["L7_produkttype_ligner_kategori"].append((n, f"{pt} | kat={cat}"))
        # L8 brandord i type/variation/keywords
        bw = {w for w in words(br) + words(sb) if len(w) >= 4 and w not in FUNC}
        if bw:
            for k in ("Product Type", "Variation", "Keywords"):
                ow = set(words(own[k]))
                hit = bw & ow
                if hit:
                    res["L8_brandord_i_" + k].append((n, f"{sorted(hit)} i {str(own[k])[:50]}"))
        # L9 dubletter på tværs
        seen = {}
        for k in ("Product Type", "Variation", "Keywords"):
            for w in set(words(own[k])):
                if len(w) >= 4 and w not in FUNC:
                    seen.setdefault(w, []).append(k)
        dup = {w: v for w, v in seen.items() if len(v) > 1}
        if dup:
            res["L9_ord_to_gange_paa_tvaers"].append((n, str(dup)[:90]))
        # L10 bindestreg-rest
        for k in ("Product Type", "Variation"):
            v = own[k]
            if v and re.search(r"(?:^|\s)[\wÆØÅæøåÄÖÜäöüß]+-(?:\s|$)", str(v)):
                res["L10_bindestregsrest_i_" + k].append((n, str(v)[:60]))
        # L11 dyremad
        txt = " ".join(str(x) for x in (t, pt, var, cat) if x)
        if PET.search(txt):
            res["L11_dyremad"].append((n, str(t)[:60]))
        # L12 alkohol-%
        for k, v in own.items():
            if v and ALC.search(str(v)):
                res["L12_alkohol_procent_i_" + k].append((n, str(v)[:60]))
        # L13 flagord i type/variation/keywords
        for k in ("Product Type", "Variation", "Keywords"):
            v = own[k]
            if v and FLAGWORDS.search(str(v)):
                res["L13_flagord_i_" + k].append((n, str(v)[:60]))
        # L14 oprindelses-adjektiv i variation
        if var and ORIGIN_ADJ.search(str(var)) and not re.search(r"vin|wein", str(pt or ""), re.I):
            res["L14_oprindelsesadjektiv_i_variation"].append((n, str(var)[:50]))
        # L15 certifikat
        for k in ("Product Type", "Variation", "Keywords"):
            v = own[k]
            if v and CERT.search(str(v)):
                res["L15_certifikat_i_" + k].append((n, str(v)[:60]))
        # L16 mellemrum
        for k, v in own.items():
            if v and (str(v) != str(v).strip() or "  " in str(v)):
                res["L16_mellemrum_" + k].append((n, repr(v)[:50]))
        # L17 produkttype tom
        if not pt:
            res["L17_produkttype_tom"].append((n, str(t)[:60]))
    out = {}
    for k in sorted(res):
        out[k] = len(res[k])
    return h, rows, res, out


if __name__ == "__main__":
    rel = sys.argv[1]
    h, rows, res, out = lint(rel)
    print(f"## {rel}: {len(rows)} rækker")
    for k, v in out.items():
        print(f"  {k}: {v}")
    if len(sys.argv) > 2:
        for k in sorted(res):
            if sys.argv[2] in k:
                for ex in res[k][:12]:
                    print("     ", ex)
