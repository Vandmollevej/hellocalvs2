"""Mekanisk rensning af butiksark efter brugerens regler 2026-10-11 (lav risiko).
Kun: Quantity/Pack Count, MHD/datoer, certifikat-ord, alkohol-%, flag-ord -> _is_, dyremad (stregkode/ord).
Skriver mech_changes.json: pr. ark kolonne-indeks + nye værdier + rækker der skal slettes."""
import collections
import json
import os
import re
import shutil
import sys
import tempfile

import openpyxl

ROOT = r"C:\Users\Peter\Desktop\Hello Cal"
BASE = r"C:\Users\Peter\AppData\Local\Temp\claude\C--Users-Peter-Desktop-Hello-Cal\a9cdef6b-c918-4988-a04f-bce306e12af7\scratchpad"
WT = r"C:\Users\Peter\Desktop\HC-frida-publish"

SHEETS = [
    ("DRK", "Produkter/drk.xlsx", "da", "full"),
    ("Årstiderne", "Produkter/aarstiderne.xlsx", "da", "full"),
    ("Wolt", "Produkter/DK/wolt.xlsx", "da", "full"),
    ("DM", "Produkter/dm.xlsx", "de", "full"),
    ("EDEKA", "Produkter/edeka.xlsx", "de", "full"),
    ("REWE", "Produkter/rewe.xlsx", "de", "full"),
    ("Bilka", "Produkter/Bilka/bilka.xlsx", "da", "qty"),
    ("REMA", "Produkter/rema 1000/rema1000_version 2.xlsx", "da", "qty"),
    ("SPAR", "Produkter/SPAR/spar.xlsx", "da", "qty"),
    ("Nemlig", "Produkter/Nemlig/nemlig.xlsx", "da", "qty"),
]

# ---------------------------------------------------------------- dyremad (port af src/lib/pet-food-blacklist.ts)
pat = json.load(open(os.path.join(BASE, "petdata", "pet-food-patterns.json"), encoding="utf-8-sig"))
STRONG = [t.lower() for t in pat["strong"]]
WEAK = [t.lower() for t in pat["weak"]]
BRANDS = [t.lower() for t in pat.get("brands", [])]
MINWEAK = pat["minWeakHits"]


def norm_barcode(c):
    return re.sub(r"\D", "", str(c or "")).lstrip("0")


BARCODES = {norm_barcode(c) for c in json.load(open(os.path.join(BASE, "petdata", "pet-food-barcodes.json"), encoding="utf-8-sig")) if norm_barcode(c)}


def whole(text, term):
    return re.search(r"(^|[^a-zæøåäöü0-9])" + re.escape(term) + r"([^a-zæøåäöü0-9]|$)", text) is not None


def includes_word(text, term):
    return term in text if len(term) > 5 else whole(text, term)


def pet_match(texts, ean):
    e = norm_barcode(ean)
    if len(e) >= 6 and e in BARCODES:
        return "stregkode " + e
    text = " | ".join(str(t) for t in texts if t).lower()
    if not text:
        return None
    for t in STRONG:
        if t in text:
            return "stærkt ord: " + t
    for b in BRANDS:
        if whole(text, b):
            return "mærke: " + b
    hits = [t for t in WEAK if includes_word(text, t)]
    if len(hits) >= MINWEAK:
        return "svage ord: " + ", ".join(hits)
    return None


# ---------------------------------------------------------------- mængde
UNIT_NORM = {"gr": "g", "gram": "g", "g": "g", "kg": "kg", "mg": "mg", "ml": "ml", "cl": "cl", "dl": "dl", "l": "l", "ltr": "l", "liter": "l", "lt": "l", "litre": "l"}
COUNT_WORDS = r"(?:stk|st|stück|pk|pak|pakke|pack|bakke|pose|bdt|bundt|potte|glas|net|dåse|ds|flaske|fl|kasse|tabs|kapsler|portioner|blatt)"
NUM = r"\d+(?:[.,]\d+)?"


def fnum(s):
    return s.replace(",", ".")


def parse_qty(q):
    """returnerer (vægt/volumen-streng eller '', antal eller None, uændret?)"""
    if q is None:
        return None
    s = str(q).strip()
    if not s:
        return ""
    low = s.lower().replace("_", " ").strip()
    low = re.sub(r"\s+", " ", low)
    # N x M enhed
    m = re.fullmatch(rf"({NUM})\s*(?:x|\*)\s*({NUM})\s*({'|'.join(UNIT_NORM)})\.?", low)
    if m and m.group(3) in UNIT_NORM:
        return (f"{fnum(m.group(2))} {UNIT_NORM[m.group(3)]}", int(float(fnum(m.group(1)))))
    # N stk M enhed
    m = re.fullmatch(rf"({NUM})\s*{COUNT_WORDS}\.?\s*(?:/|,|-)?\s*(?:ca\.?\s*)?({NUM})\s*({'|'.join(UNIT_NORM)})\.?", low)
    if m:
        return (f"{fnum(m.group(2))} {UNIT_NORM[m.group(3)]}", int(float(fnum(m.group(1)))))
    # M enhed N stk
    m = re.fullmatch(rf"(?:ca\.?\s*)?({NUM})\s*({'|'.join(UNIT_NORM)})\.?\s*(?:/|,|-)?\s*({NUM})\s*{COUNT_WORDS}\.?", low)
    if m:
        return (f"{fnum(m.group(1))} {UNIT_NORM[m.group(2)]}", int(float(fnum(m.group(3)))))
    # kun antal
    m = re.fullmatch(rf"({NUM})\s*(?:-)?{COUNT_WORDS}\.?", low)
    if m:
        return ("", int(float(fnum(m.group(1)))))
    # rent mål
    m = re.fullmatch(rf"(ca\.?\s*)?({NUM})\s*({'|'.join(UNIT_NORM)})\.?", low)
    if m:
        pre = "ca. " if m.group(1) else ""
        return (f"{pre}{fnum(m.group(2))} {UNIT_NORM[m.group(3)]}", None)
    # tekst uden tal (g, stk, kg ...) er ikke en mængde
    if not re.search(r"\d", low):
        return ("", None)
    return None  # ukendt format: lad stå


def parse_pack(pc):
    if pc is None or str(pc).strip() == "":
        return None
    m = re.match(rf"^\s*({NUM})\s*(?:-)?\s*(?:{COUNT_WORDS})?\.?\s*$", str(pc).strip(), re.I)
    if m:
        try:
            return int(float(fnum(m.group(1))))
        except ValueError:
            return None
    return None


# ---------------------------------------------------------------- tekst
DATE = re.compile(
    r"(?:[-–,]\s*)?\bMHD\b\.?:?\s*(?:\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2}))?|\bmindestens\s+haltbar(?:\s+bis)?\s*(?:\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2}))?|\b\d{1,2}\.\d{1,2}\.(?:\d{4}|\d{2})\b",
    re.I,
)
CERT = re.compile(r"\b(?:MSC|ASC)(?:[-\s]zertifiziert)?\b-?\s*", re.I)
ALC_PCT = re.compile(r"(?:alkoholgehalt:?\s*)?(\d{1,2}(?:[.,]\d)?)\s*%\s*(?:vol\.?|alk\.?)?", re.I)
FLAGS = {
    "da": {
        r"økologisk(?:e)?|øko": ("_is_organic", "økologisk"),
        r"alkoholfri(?:e)?": ("_is_alcohol_free", "alkoholfri"),
        r"sukkerfri(?:e)?": ("_is_sugar_free", "sukkerfri"),
        r"glutenfri(?:e)?": ("_is_glutenfree", "glutenfri"),
        r"laktosefri(?:e)?": ("_is_lactose_free", "laktosefri"),
        r"vegansk(?:e)?": ("_is_vegan", "vegansk"),
    },
    "de": {
        r"bio": ("_is_organic", "bio"),
        r"alkoholfrei(?:e|er|es)?": ("_is_alcohol_free", "alkoholfrei"),
        r"zuckerfrei(?:e|er|es)?": ("_is_sugar_free", "zuckerfrei"),
        r"glutenfrei(?:e|er|es)?": ("_is_glutenfree", "glutenfrei"),
        r"laktosefrei(?:e|er|es)?|lactosefrei(?:e|er|es)?": ("_is_lactose_free", "laktosefrei"),
        r"vegan(?:e|er|es)?": ("_is_vegan", "vegan"),
    },
}


def tidy(s):
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s*[-–]\s*$", "", s.strip())
    s = re.sub(r"^\s*[-–,]\s*", "", s)
    s = re.sub(r"\s+,", ",", s)
    s = re.sub(r"\(\s*\)", "", s)
    return s.strip(" ,")


def clean_text(s, lang, flags_found, alc_found, drop_flags=True):
    """renser én celle; returnerer ny tekst (eller tom)."""
    if s is None:
        return None
    t = str(s)
    t = DATE.sub(" ", t)
    t = CERT.sub(" ", t)
    for m in ALC_PCT.finditer(t):
        if re.search(r"vol|alk", m.group(0), re.I):
            alc_found.append(m.group(1).replace(",", "."))
    t = re.sub(r"(?:alkoholgehalt:?\s*)?\d{1,2}(?:[.,]\d)?\s*%\s*(?:vol\.?|alk\.?)", " ", t, flags=re.I)
    t = re.sub(r"alkoholgehalt:?", " ", t, flags=re.I)
    if drop_flags:
        for rx, (col, val) in FLAGS[lang].items():
            pattern = re.compile(rf"(?<![\wÆØÅæøåÄÖÜäöüß])(?:{rx})(?![\wÆØÅæøåÄÖÜäöüß])", re.I)
            if pattern.search(t):
                flags_found.add(col)
                t = pattern.sub(" ", t)
    return tidy(t)


def load(rel):
    src = os.path.join(ROOT, rel)
    dst = os.path.join(tempfile.gettempdir(), "mech_" + os.path.basename(rel))
    shutil.copy2(src, dst)
    ws = openpyxl.load_workbook(dst, read_only=True, data_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    h = [str(x) if x is not None else "" for x in next(it)]
    return h, list(it)


def run(sheet, rel, lang, mode="full"):
    apply_pet = mode == "full"
    text_clean = mode == "full"
    h, rows = load(rel)
    idx = {}
    for i, n in enumerate(h):
        idx.setdefault(n, i)
    alc_cols = [i for i, n in enumerate(h) if n == "_is_alcohol"]
    kwi = [i for i, n in enumerate(h) if n.startswith("Keyword ")]
    text_cols = [idx[c] for c in ("Product Type", "Variation", "Subbrand") if c in idx] + kwi
    if "Clean Subtitle" in idx:
        text_cols.append(idx["Clean Subtitle"])
    qi, pi = idx.get("Quantity"), idx.get("Pack Count")
    changes, delete = [], []
    stats = collections.Counter()
    pet_rows = []
    for n, r in enumerate(rows, start=2):
        orig = r[idx["Original Title"]]
        cols = {}
        # --- dyremad
        if apply_pet:
            texts = [orig, r[idx["Product Name"]] if "Product Name" in idx else None, r[idx["Subtitle"]] if "Subtitle" in idx else None]
            for c in (("Product Type", "Variation", "Category", "Brand") if lang == "de" else ("Brand",)):
                if c in idx:
                    texts.append(r[idx[c]])
            hit = pet_match(texts, r[idx["EAN"]] if "EAN" in idx else None)
            if hit:
                delete.append(n)
                pet_rows.append((n, str(orig)[:70], hit))
                stats["dyremad_rækker"] += 1
                continue
        # --- mængde / antal
        if qi is not None:
            q = r[qi]
            parsed = parse_qty(q) if q not in (None, "") else None
            newq, newn = (None, None)
            if parsed is not None and parsed != "":
                newq, newn = parsed
            pack = parse_pack(r[pi]) if pi is not None else None
            if pi is not None and r[pi] not in (None, "") and pack is None:
                # tekstformat i Pack Count (fx "6-pak", "10 stk"): kun hvis parse_pack ikke kunne -> lad stå
                pass
            if parsed is not None and parsed != "":
                if newq != str(q).strip():
                    cols[qi] = newq if newq != "" else None
                    stats["quantity_ændret"] += 1
                if newn is not None and pi is not None and pack is None:
                    cols[pi] = newn
                    stats["packcount_sat_fra_quantity"] += 1
            # pack count tekst -> heltal
            if pi is not None and r[pi] not in (None, ""):
                if pack is not None and str(r[pi]).strip() != str(pack):
                    cols[pi] = pack
                    stats["packcount_normaliseret"] += 1
        # --- tekstkolonner
        flags, alc = set(), []
        for ci in (text_cols if text_clean else []):
            v = r[ci]
            if v in (None, ""):
                continue
            nv = clean_text(v, lang, flags, alc, drop_flags=(h[ci] in ("Product Type", "Variation") or h[ci].startswith("Keyword ")))
            if nv != str(v).strip():
                cols[ci] = nv if nv else None
                stats["tekst_renset_" + h[ci].split()[0]] += 1
        for fcol in flags:
            if fcol in idx and r[idx[fcol]] in (None, ""):
                val = [v for rx, (c, v) in FLAGS[lang].items() if c == fcol][0]
                cols[idx[fcol]] = val
                stats["flag_til_" + fcol] += 1
        if alc and len(alc_cols) >= 2:
            if r[alc_cols[1]] in (None, ""):
                cols[alc_cols[1]] = alc[0] + "%"
                stats["alkohol_procent_flyttet"] += 1
            if r[alc_cols[0]] in (None, ""):
                cols[alc_cols[0]] = "enthält alkohol" if lang == "de" else "indeholder alkohol"
        if cols:
            changes.append({"row": n, "orig": str(orig), "cols": {str(k): v for k, v in cols.items()}})
    return {"sheet": sheet, "file": rel, "lang": lang, "header": h, "rows": len(rows), "changes": changes, "delete_rows": delete,
            "pet": pet_rows, "stats": dict(stats), "mode": mode, "removed": [list(rows[n - 2]) for n in delete]}


if __name__ == "__main__":
    only = set(sys.argv[1:])
    out = []
    for s in SHEETS:
        if only and s[0] not in only:
            continue
        if not os.path.exists(os.path.join(ROOT, s[1])):
            print(s[0], "mangler")
            continue
        r = run(*s)
        out.append(r)
        print(r["sheet"], r["rows"], "rækker:", len(r["changes"]), "celleændringsrækker,", len(r["delete_rows"]), "dyremad-rækker", r["stats"])
    json.dump(out, open(os.path.join(BASE, "mech_changes_2.json"), "w", encoding="utf-8"), ensure_ascii=False)

    # eksportér fjernede (dyremad-)rækker til blacklist-mappen
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    total = 0
    for r in out:
        if not r.get("removed"):
            continue
        ws = wb.create_sheet(r["sheet"][:30])
        ws.append(r["header"])
        for row in r["removed"]:
            ws.append(row)
        total += len(r["removed"])
    if total:
        dest = os.path.join(BASE, "fjernede_raekker_dry_2026-10-16.xlsx")
        wb.save(dest)
        print("fjernede rækker gemt:", dest, total)
