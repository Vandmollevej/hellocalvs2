#!/usr/bin/env python
"""Regel-validator for produkttype-udtræk. Brug: py rule_check.py <input.json> <output.json> [--json]
Returnerer exit 1 hvis der er fejl. Fejlkoder svarer til AGENT_RULES.md."""
import json
import re
import sys
import unicodedata

GENERIC_SUBBRANDS = {
    "bio", "vegan", "vegansk", "zero", "light", "original", "classic", "classico", "extra", "natur", "naturell", "premium", "pur", "mild",
    "økologisk", "øko", "organic", "frisch", "frisk", "fein", "gold", "silber", "red", "blue", "green", "white", "black", "plus", "mini", "maxi", "xl", "xxl",
    "glutenfrei", "glutenfri", "laktosefrei", "laktosefri", "zuckerfrei", "sukkerfri", "alkoholfrei", "alkoholfri", "protein", "high protein",
}
CATEGORY_HEADS = {"aromen", "getränk", "getränke", "süßwaren", "konserven", "backzutaten", "gewürze", "snacks", "desserts", "backen", "feinkost"}

FUNC = {
    "med", "uden", "i", "og", "af", "på", "fra", "til", "m", "u", "à", "en", "et", "den", "det", "ca", "pr", "per", "t", "mod", "for",
    "mit", "ohne", "und", "in", "aus", "von", "für", "im", "am", "der", "die", "das", "dem", "des", "ein", "eine", "einer", "nach",
    "auf", "zum", "zur", "bei", "mind", "mindestens", "haltbar", "bis", "a", "la", "le", "de", "du", "des", "con", "al", "alla", "the", "of", "and",
    "abverkauf", "angebot", "aktion", "sonderposten", "restposten", "neu", "new", "tilbud", "kampagne",
    "stk", "stück", "stuck", "pk", "pak", "pakke", "bakke", "pose", "ltr", "liter", "kg", "ml", "gr", "etikett", "beschädigt", "verschmutzt",
}
DATE = re.compile(r"\bMHD\b|\bmindestens\s+haltbar|\b\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4})\b", re.I)
CERT = re.compile(r"\b(MSC|ASC|Fairtrade|Rainforest(?:\s+Alliance)?|Demeter|Bioland|Naturland|UTZ)\b", re.I)
PET = re.compile(
    r"alleinfutter|ergänzungsfutter|ergaenzungsfutter|katzenfutter|hundefutter|vogelfutter|tierfutter|katzensnack|hundesnack|kauknochen|kausnack|"
    r"kattemad|hundefoder|dyrefoder|fuglefoder|kattegræs|kattegraes|tyggestæng|tyggeben|\bfür (?:hunde|katzen)\b|\bfor (?:hunde|katte)\b|"
    r"dental sticks|\bhello my cat\b|\bkitten\b|\bwelpen",
    re.I,
)
FLAGS = {
    "organic": r"økologisk(?:e)?|øko\b|\bbio\b|\borganic\b",
    "alcohol_free": r"alkoholfri(?:e)?|alkoholfrei(?:e|er|es)?|\b0[.,]0\s*%\s*vol",
    "sugar_free": r"sukkerfri(?:e)?|zuckerfrei(?:e|er|es)?|ohne\s+zuckerzusatz|uden\s+tilsat\s+sukker",
    "glutenfree": r"glutenfri(?:e)?|glutenfrei(?:e|er|es)?",
    "lactose_free": r"laktosefri(?:e)?|laktosefrei(?:e|er|es)?|lactosefrei(?:e|er|es)?",
    "vegan": r"\bvegansk(?:e)?\b|\bvegan(?:e|er|es)?\b",
}
CATEGORY_WORDS = {
    "aromen", "getränk", "getränke", "alkoholisches getränk", "konserven", "süßwaren", "sonstiges", "lebensmittel", "spezialitäten", "backzutaten",
    "backen", "desserts", "bonbons", "kaugummi", "snacks", "tee", "kaffee", "feinkost", "fertiggerichte", "gewürze", "drogerie", "tiefkühlkost",
    "fleisch", "wurst", "käse", "milchprodukte", "backwaren", "brot", "obst", "gemüse", "frühstück", "getränkepulver", "aromatisiertes getränkepulver",
    "mejeri", "drikkevarer", "kolonial", "dybfrost", "diverse", "andet",
}
ORIGIN = re.compile(
    r"\b(fransk|italiensk|spansk|tysk|dansk|svensk|norsk|græsk|tyrkisk|chilensk|argentinsk|sydafrikansk|portugisisk|østrigsk|"
    r"französisch|italienisch|spanisch|deutsch|dänisch|griechisch|türkisch|chilenisch|argentinisch|österreichisch)\w*\b",
    re.I,
)
QTY_TOKEN = re.compile(r"^\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?)?[a-zA-Z]{0,4}$", re.I)
WORD = re.compile(r"[A-Za-zÆØÅæøåÄÖÜäöüßéèêáàçñ0-9][A-Za-zÆØÅæøåÄÖÜäöüßéèêáàçñ0-9'’&\-]*", re.U)


import os
try:
    KNOWN_BRANDS = set(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "known_brands.json"), encoding="utf-8")))
except Exception:
    KNOWN_BRANDS = set()
GENERIC_HEADS = {"getränk", "getränke", "drikkevare", "drikkevarer", "lebensmittel", "produkt", "zubereitung", "erzeugnis", "ware", "waren", "artikel", "mischung", "sonstiges"}
COUNTRY_STEMS = {
    "frankreich": ["franz", "frankreich", "france", "français"], "frankrig": ["frans", "frankrig", "france"], "deutschland": ["deutsch", "german", "aus de"],
    "tyskland": ["tysk", "tyskland"], "italien": ["italien", "italia", "ital."], "spanien": ["spani", "spain", "españa", "espa"], "spanien ": ["span"],
    "dänemark": ["dänisch", "dänemark", "danish", "denmark"], "danmark": ["dansk", "danmark"], "schweden": ["schwed"], "sverige": ["svensk", "sverige"],
    "norwegen": ["norweg"], "norge": ["norsk", "norge"], "griechenland": ["griech", "greek"], "grækenland": ["græsk", "grækenland"],
    "türkei": ["türk", "turk"], "tyrkiet": ["tyrk"], "österreich": ["österreich"], "østrig": ["østrig"], "portugal": ["portug"],
    "niederlande": ["niederl", "holländ", "dutch"], "holland": ["holland", "hollandsk"], "belgien": ["belg"], "england": ["engl", "brit"],
    "usa": ["usa", "american", "amerikan"], "japan": ["japan"], "china": ["chin"], "kina": ["kines"], "thailand": ["thai"], "indien": ["ind", "india"],
    "mexiko": ["mexi"], "chile": ["chil"], "argentinien": ["argentin"], "südafrika": ["südafrika", "south africa"], "polen": ["pol"],
}
ADJ_VAR = {"original", "classic", "classico", "light", "zero", "natur", "naturell", "mild", "extra", "fein", "pur", "bio", "trocken", "halbtrocken", "lieblich", "süß", "scharf"}


def words(s, split_hyphen=True):
    out = []
    for w in WORD.findall(str(s or "")):
        w = w.strip("-'’&").lower()
        if not w:
            continue
        out.append(w)
        if split_hyphen and "-" in w:
            out.extend(p for p in w.split("-") if p)
    return out


def real_words(s):
    return [w for w in words(s) if len(w) >= 3 and w not in FUNC and not re.fullmatch(r"\d+", w)]


def fold(s):
    """sammenligningsform: små bogstaver, uden accenter/umlaut-varianter/bindestreger/apostroffer (Hafer-Drink = Haferdrink, Althüs = Althues)."""
    s = unicodedata.normalize("NFKD", str(s).lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("ß", "ss").replace("æ", "ae").replace("ø", "o").replace("å", "a")
    s = re.sub(r"ae|oe|ue", lambda m: m.group(0)[0], s)
    return re.sub(r"[-'’]", "", s)


def same(a, b):
    a, b = fold(a), fold(b)
    if a == b:
        return True
    if min(len(a), len(b)) >= 5 and (a in b or b in a):
        return True
    return False


def title_tokens(title):
    t = DATE.sub(" ", str(title or ""))
    t = re.sub(r"\b\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:kg|g|mg|ml|cl|dl|l|ltr|st|stk|stück|er)\b", " ", t, flags=re.I)
    toks = []
    for raw in re.split(r"[\s,;/()]+", t):
        raw = raw.strip(".,:;-–!?")
        if not raw or QTY_TOKEN.match(raw):
            continue
        for part in re.split(r"[.]", raw):
            part = part.strip().lower().strip("-'’&")
            if len(part) >= 3 and part not in FUNC and not re.fullmatch(r"\d+", part):
                toks.append(part)
                if "-" in part:
                    toks.extend(p for p in part.split("-") if len(p) >= 3 and p not in FUNC)
    return toks


def check_row(inp, out):
    errs, warns = [], []
    if out.get("remove"):
        return errs, warns
    lang = inp.get("lang", "de")
    title = inp.get("orig_title") or ""
    sub = inp.get("subtitle") or ""
    cat = (inp.get("category") or "").strip().lower()
    brand, subbrand = out.get("brand") or "", out.get("subbrand") or ""
    cobrand = out.get("cobrand") or ""
    ptype, var = out.get("product_type") or "", out.get("variation") or ""
    kws = [k for k in (out.get("keywords") or []) if k]
    flags = {k: v for k, v in (out.get("flags") or {}).items() if v}
    country = out.get("country") or ""

    # V10 dyremad ikke markeret
    if PET.search(" ".join([title, sub, inp.get("product_type") or "", cat])):
        errs.append("V10 dyremad/kæledyrsvare men remove er ikke true")
        return errs, warns
    # V1 produkttype
    if not ptype.strip():
        errs.append("V1 product_type mangler")
    else:
        pl = ptype.strip().lower()
        if re.match(r"^\d", pl):
            errs.append(f"V1 product_type starter med tal: {ptype!r}")
        in_title = any(same(w, t) for w in real_words(ptype) for t in words(title + " " + sub))
        if "&" in pl:
            errs.append(f"V2 product_type ligner butikskategori (&): {ptype!r}")
        elif (pl == cat or pl in CATEGORY_WORDS) and not in_title:
            errs.append(f"V2 product_type ligner butikskategori og står ikke i titlen: {ptype!r}")
        if len(pl.split()) > 4:
            errs.append(f"V2 product_type for lang (beskrivelse?): {ptype!r}")
        if pl.split()[-1] in GENERIC_HEADS and len(pl.split()) >= 1:
            errs.append(f"V2 product_type er generisk ('{pl.split()[-1]}') — find selve varen (fx Cider, Wein, Saft): {ptype!r}")
        first = re.split(r"[-\s]", pl)[0]
        if first in CATEGORY_HEADS and first != pl:
            errs.append(f"V2 product_type starter med butikskategori-ord ('{first}'): {ptype!r}")
        # V16: produkttypen er (næsten) hele titlen — varen er ikke skilt fra variation/brand
        tt_core = [t for t in title_tokens(title) if not any(same(t, b) for b in real_words(brand + " " + subbrand))]
        pw = real_words(ptype)
        if len(pw) >= 3 and tt_core and sum(1 for t in tt_core if any(same(t, p) for p in pw)) >= max(3, len(tt_core) - 1) and not var.strip():
            errs.append(f"V16 product_type ser ud til at være hele titlen (varen skal skilles fra variation/brand): {ptype!r}")
    # kendt brand/subbrand i variation/type/keywords (advarsel)
    own = {w for w in real_words(brand + " " + subbrand)}
    for fld, txt in (("product_type", ptype), ("variation", var), ("keywords", " ".join(kws))):
        low = " " + re.sub(r"[^\wäöüßæøå ]+", " ", txt.lower()) + " "
        for kb in KNOWN_BRANDS:
            if len(kb) >= 5 and (" " + kb + " ") in low and not any(same(kb, w) for w in own):
                warns.append(f"V3b kendt brand/subbrand '{kb}' står i {fld} — skal det være brand/subbrand?")
                break
    # type + enkelt-ords variation er ét udtryk i titlen (delt sammensætning?)
    vwords = [w for w in re.findall(r"[\wÄÖÜäöüß\-]+", var)]
    if ptype and len(vwords) == 1 and vwords[0].lower() not in ADJ_VAR and vwords[0][:1].isupper():
        tl = re.sub(r"\s+", " ", title.lower())
        if (ptype.lower() + " " + vwords[0].lower()) in tl:
            warns.append(f"V6w '{ptype} {vwords[0]}' står sammen i titlen — er det ét ord (sammensætning)?")
    # V14 plural (kun danske ark; de tyske ark har bevidst tomt flertal)
    if lang == "da" and not (out.get("product_type_plural") or "").strip() and ptype:
        errs.append("V14 product_type_plural mangler")
    # V15 subbrand er et generisk ord/flag (Bio, Vegan, Zero, Original ...) — hører ikke til som subbrand
    if subbrand and (subbrand.strip().lower() in GENERIC_SUBBRANDS):
        errs.append(f"V15 subbrand er et almindeligt ord/flag, ikke en produktlinje: {subbrand!r} (fjern; ordet hører til flag/variation)")
    # V3 brandord i type/variation/keywords
    bw = [w for w in real_words(brand + " " + subbrand + " " + cobrand) if len(w) >= 3]
    for fld, txt in (("product_type", ptype), ("variation", var), ("keywords", " ".join(kws))):
        tw = real_words(txt)
        hit = sorted({b for b in bw for t in tw if same(b, t)})
        if hit:
            errs.append(f"V3 brandord {hit} står i {fld}")
    # V4 dubletter på tværs
    fields = {"product_type": real_words(ptype), "variation": real_words(var), "keywords": real_words(" ".join(kws)),
              "brand": real_words(brand), "subbrand": real_words(subbrand), "cobrand": real_words(cobrand)}
    names = list(fields)
    dups = set()
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            for wa in fields[a]:
                for wb in fields[b]:
                    if same(wa, wb):
                        dups.add(f"{wa}/{wb} ({a}+{b})")
    # også dubletter inden i variation
    vw = [w for w in words(var, split_hyphen=False) if len(w) >= 3 and w not in FUNC and not re.fullmatch(r"\d+", w)]
    for i in range(len(vw)):
        for j in range(i + 1, len(vw)):
            if same(vw[i], vw[j]):
                dups.add(f"{vw[i]}/{vw[j]} (variation+variation)")
    if dups:
        errs.append("V4 ord gentaget: " + "; ".join(sorted(dups))[:200])
    # V6 bindestregs-rester og delte sammensatte ord
    for fld, txt in (("product_type", ptype), ("variation", var), ("keywords", " ".join(kws))):
        if re.search(r"(?:^|\s)[\wÄÖÜäöüß]+-(?:\s|$)", txt) or re.search(r"(?:^|\s)-[\wÄÖÜäöüß]+", txt):
            if not re.search(r"\b\w+- (?:und|og|&|oder) \w+", txt):
                errs.append(f"V6 bindestregs-rest i {fld}: {txt!r}")
    tt = set(w.replace("-", "") for w in words(title, split_hyphen=False))
    seq = []
    for txt in (ptype, var):
        seq.extend(w.strip("-") for w in re.findall(r"[\wÄÖÜäöüß\-]+", txt.lower()))
    for x, y in zip(seq, seq[1:]):
        joined = (x + y).replace("-", "")
        if len(joined) >= 8 and joined in tt and x not in tt and y not in tt:
            errs.append(f"V6 delt sammensat ord: {x} + {y} = {joined}")
    # V7 dato/MHD
    for fld, txt in (("product_type", ptype), ("variation", var), ("keywords", " ".join(kws)), ("brand", brand), ("subbrand", subbrand)):
        if DATE.search(txt):
            errs.append(f"V7 MHD/dato i {fld}: {txt!r}")
    # V11 certifikat
    for fld, txt in (("product_type", ptype), ("variation", var), ("keywords", " ".join(kws))):
        if CERT.search(txt):
            errs.append(f"V11 certifikat i {fld}: {txt!r}")
    # V8 flag-ord
    src = " ".join([title, sub])
    for key, rx in FLAGS.items():
        if re.search(rx, src, re.I) and key != "organic":
            if not flags.get(key):
                errs.append(f"V8 flag {key} mangler (ordet står i titlen)")
        if re.search(rx, ptype + " " + var + " " + " ".join(kws), re.I):
            errs.append(f"V8 flag-ord ({key}) står stadig i tekstfelt")
    if re.search(FLAGS["organic"], src, re.I) and not flags.get("organic") and not inp.get("flags", {}).get("organic"):
        warns.append("V8 økologisk/bio i titel men flag organic mangler")
    # V9 alkohol-%
    if re.search(r"%\s*vol|alkoholgehalt", src, re.I) and not out.get("alcohol_percent"):
        errs.append("V9 alkohol-% mangler (står i titlen)")
    if re.search(r"\d\s*%", ptype + " " + var):
        warns.append("V9 procent i type/variation (alkohol/fedt hører i egne felter)")
    # V9b alkohol-% skal stå i titlen (ingen opfundne tal)
    ap = (out.get("alcohol_percent") or "").strip()
    if ap and ap != (inp.get("alcohol_percent") or ""):
        def _f(x):
            try:
                return float(x.replace(",", "."))
            except ValueError:
                return None
        want = _f(re.sub(r"[^\d.,]", "", ap) or "x")
        have = {_f(x) for x in re.findall(r"\d+(?:[.,]\d+)?", src)}
        if want is None or want not in have:
            errs.append(f"V9b alkohol-% '{ap}' findes ikke i titlen/subtitlen (opfundet?)")
    # V12b land skal være belagt i titlen
    cn = (out.get("country") or "").strip().lower()
    if cn and cn != (inp.get("country") or "").strip().lower():
        stems = COUNTRY_STEMS.get(cn, [cn[:5]])
        if not any(st in src.lower() for st in stems):
            errs.append(f"V12b land '{out.get('country')}' er ikke belagt i titlen (ingen gæt ud fra brand)")
    # V12 oprindelses-adjektiv
    if ORIGIN.search(var) and not re.search(r"vin|wein", (ptype + " " + cat).lower()):
        errs.append(f"V12 oprindelses-adjektiv i variation (flyt til country): {var!r}")
    # V13 dansk variation lille begyndelsesbogstav
    if lang == "da" and var and var[0].isupper() and not re.match(r"^[A-ZÆØÅ]{2,}", var):
        warns.append(f"V13 variation starter med stort: {var!r}")
    # V5 dækning
    outw = []
    for txt in (brand, subbrand, cobrand, ptype, var, " ".join(kws), country):
        outw.extend(words(txt))
    for val in flags.values():
        outw.extend(words(val))
    outw.extend(words(out.get("alcohol_percent") or ""))
    flag_rx = re.compile("|".join(FLAGS.values()), re.I)
    uncovered = []
    for t in title_tokens(title):
        if flag_rx.search(t) or CERT.search(t):
            continue
        if re.match(r"^[+\d]", t) or "%" in t:
            continue
        if not any(same(t, o) for o in outw):
            uncovered.append(t)
    if uncovered:
        errs.append("V5 ord fra titlen ikke fordelt: " + ", ".join(sorted(set(uncovered))[:10]))
    # brand uændret?
    if inp.get("brand") and brand and inp["brand"].strip().lower() != brand.strip().lower():
        warns.append(f"brand ændret fra {inp['brand']!r} til {brand!r}")
    return errs, warns


def main():
    inp = json.load(open(sys.argv[1], encoding="utf-8"))
    out = json.load(open(sys.argv[2], encoding="utf-8"))
    as_json = "--json" in sys.argv
    by_row = {o.get("row"): o for o in out}
    report = []
    total_err = 0
    missing = [r["row"] for r in inp if r["row"] not in by_row]
    for r in inp:
        o = by_row.get(r["row"])
        if o is None:
            continue
        errs, warns = check_row(r, o)
        if errs or warns:
            report.append({"row": r["row"], "title": r.get("orig_title"), "errors": errs, "warnings": warns})
            total_err += len(errs)
    if as_json:
        print(json.dumps({"missing_rows": missing, "rows_with_errors": sum(1 for x in report if x["errors"]), "report": report}, ensure_ascii=False))
    else:
        if missing:
            print(f"MANGLER {len(missing)} rækker i output: {missing[:20]}")
        for x in report:
            for e in x["errors"]:
                print(f"row {x['row']} [{str(x['title'])[:50]!r}] FEJL {e}")
            for w in x["warnings"]:
                print(f"row {x['row']} [{str(x['title'])[:50]!r}] advarsel {w}")
        print(f"== {len(inp)} rækker, {sum(1 for x in report if x['errors'])} med fejl, {total_err} fejl i alt, {len(missing)} manglende")
    sys.exit(1 if (total_err or missing) else 0)


if __name__ == "__main__":
    main()
