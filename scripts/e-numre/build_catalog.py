"""Bygger src/data/e-numbers.json — Hello Cals E-nummer-opslagsværk.

Kilder:
  data/off_base.json  Udtræk af Open Food Facts' additives-taxonomi
                      (github.com/openfoodfacts/openfoodfacts-server,
                      taxonomies/additives.txt): navne, varianter,
                      funktionsklasser, EFSA-udtalelse (titel, DOI, dato, ADI).
  data/texts/*.json   Redaktionelle danske tekster pr. E-nummer
                      (beskrivelse, anvendelse, sundhed, forskning, nøglestudier).

Kør:  python scripts/e-numre/build_catalog.py
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent.parent / "src" / "data" / "e-numbers.json"

FIELDS = ["nameDa", "nameEn", "category", "euStatus", "origin", "summary", "description",
          "uses", "health", "research", "keyReferences", "pubmedTerm", "flags"]


def main() -> None:
    base = {e["code"]: e for e in json.loads((HERE / "data" / "off_base.json").read_text("utf-8"))}
    texts = {}
    for path in sorted((HERE / "data" / "texts").glob("*.json")):
        for item in json.loads(path.read_text("utf-8")):
            texts[item["code"]] = item

    catalog = []
    for code, b in base.items():
        t = texts.get(code)
        if not t:
            raise SystemExit(f"Mangler tekst for {code}")
        entry = {"code": code}
        for field in FIELDS:
            entry[field] = t.get(field, [] if field in ("keyReferences", "flags") else "")
        entry["nameDa"] = entry["nameDa"] or b.get("da", "")
        entry["nameEn"] = entry["nameEn"] or b.get("en", "")
        if entry["euStatus"] not in ("approved", "banned", "not_approved"):
            entry["euStatus"] = "not_approved"
        if entry["origin"] not in ("natural", "nature_identical", "synthetic", "mixed"):
            entry["origin"] = "mixed"
        entry["classes"] = [c.strip().removeprefix("en:") for c in b.get("additives_classes", "").split(",") if c.strip()]
        entry["variants"] = [{"code": v["code"], "nameDa": v.get("da", ""), "nameEn": v.get("en", "")} for v in b["variants"]]
        entry["efsa"] = (
            {
                "title": b.get("efsa_evaluation", ""),
                "url": b["efsa_evaluation_url"],
                "date": b.get("efsa_evaluation_date", ""),
                "adi": b.get("efsa_evaluation_adi", ""),
                "overexposureRisk": b.get("efsa_evaluation_overexposure_risk", ""),
            }
            if b.get("efsa_evaluation_url")
            else None
        )
        entry["wikipedia"] = b.get("wikipedia", "")
        entry["wikidata"] = b.get("wikidata", "")
        catalog.append(entry)

    catalog.sort(key=lambda e: (int(re.sub(r"\D", "", e["code"])), e["code"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", "utf-8")
    print(f"{len(catalog)} E-numre -> {OUT}")


if __name__ == "__main__":
    main()
