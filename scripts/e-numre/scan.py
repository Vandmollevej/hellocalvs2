"""Screener fritekst (fx en varedeklaration) for E-numre og sammenligner med
den lokale database i data/e_numre.csv.

Brug:
    python scan.py deklaration.txt
    echo "Indeholder E621, E150c og farvestof E999" | python scan.py
"""

import argparse
import csv
import re
import sys
from pathlib import Path

DEFAULT_CSV = Path(__file__).parent / "data" / "e_numre.csv"

E_NUMBER_RE = re.compile(r"\bE[\s-]?(\d{3,4}[a-h]?)\b", re.IGNORECASE)


def normalize(e_number: str) -> str:
    return e_number.upper().replace(" ", "").replace("-", "")


def load_database(csv_path: Path) -> dict:
    db = {}
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            db[normalize(row["E-nummer"])] = row
    return db


def scan_text(text: str, db: dict) -> tuple[dict, list[str]]:
    found = {}
    for match in E_NUMBER_RE.finditer(text):
        key = normalize("E" + match.group(1))
        found.setdefault(key, match.group(0))

    known = {key: db[key] for key in found if key in db}
    unknown = sorted(key for key in found if key not in db)
    return known, unknown


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", help="Tekstfil at scanne (ellers stdin)")
    parser.add_argument("--csv", default=str(DEFAULT_CSV), help="Sti til e_numre.csv")
    args = parser.parse_args()

    text = Path(args.input).read_text(encoding="utf-8") if args.input else sys.stdin.read()
    db = load_database(Path(args.csv))
    known, unknown = scan_text(text, db)

    if known:
        print(f"Kendte E-numre fundet ({len(known)}):")
        for key in sorted(known):
            row = known[key]
            print(f"  {row['E-nummer']} — {row['Internationalt navn']} ({row['Funktion']})")

    if unknown:
        print(f"\nE-numre fundet i teksten, som IKKE findes i databasen ({len(unknown)}):")
        for key in unknown:
            print(f"  {key}")

    if not known and not unknown:
        print("Ingen E-numre fundet i teksten.")


if __name__ == "__main__":
    main()
