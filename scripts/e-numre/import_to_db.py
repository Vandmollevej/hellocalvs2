"""Importerer scripts/e-numre/data/e_numre.csv til Postgres-tabellen "additives".

Kør efter migration 20260828130000_additives er anvendt (`npm run db:deploy`):
    DATABASE_URL=... python import_to_db.py

Idempotent: upserter på e_number, så scriptet trygt kan køres igen efter
en opdateret CSV.
"""

import csv
import os
from pathlib import Path

import psycopg2

CSV_PATH = Path(__file__).parent / "data" / "e_numre.csv"

# Prisma's DATABASE_URL carries a `?schema=public` query param that
# psycopg2/libpq does not understand.
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]

UPSERT_SQL = """
INSERT INTO additives
    (e_number, international_name, danish_name, function, risks, research, link, source, updated_at)
VALUES
    (%s, %s, %s, %s, %s, %s, %s, %s, now())
ON CONFLICT (e_number) DO UPDATE SET
    international_name = EXCLUDED.international_name,
    danish_name = EXCLUDED.danish_name,
    function = EXCLUDED.function,
    risks = EXCLUDED.risks,
    research = EXCLUDED.research,
    link = EXCLUDED.link,
    source = EXCLUDED.source,
    updated_at = now()
"""


def main() -> None:
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            for row in rows:
                cur.execute(
                    UPSERT_SQL,
                    (
                        row["E-nummer"].strip(),
                        row["Internationalt navn"].strip(),
                        row["Dansk kaldenavn"].strip(),
                        row["Funktion"].strip(),
                        row["Risici"].strip(),
                        row["Forskningsafsnit"].strip(),
                        row["Link"].strip(),
                        row["Kilde"].strip(),
                    ),
                )
        conn.commit()

    print(f"Importerede/opdaterede {len(rows)} E-numre i additives-tabellen.")


if __name__ == "__main__":
    main()
