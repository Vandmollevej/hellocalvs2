"""
Lægger en Bria-udgave ({job}_bria.png) ved siden af de seneste kamerabilleders
normale fritlægning ({job}.png). Usikkerheder (admin → varegodkendelse) viser
dem to og to på rød baggrund. Intet billede sendes til Bria to gange: gemte svar
(bria-cache) genbruges, og eksisterende _bria-filer springes over.

Jobbet "bria-compare" kører af sig selv én gang efter deploy, så længe der er
færre end 20 _bria-filer; ellers manuelt:
docker compose exec image-agent python compare_engines.py 20
"""

import os
import sys

import psycopg2

import cutout

COMPARE_LIMIT = int(os.environ.get("BRIA_COMPARE_LIMIT", "20"))
CUTOUT_PATH = os.path.join(cutout.OUTPUT_DIR, cutout.CUTOUT_DIR)


def bria_count():
    try:
        return len([name for name in os.listdir(CUTOUT_PATH) if name.endswith("_bria.png")])
    except FileNotFoundError:
        return 0


def camera_jobs(conn, limit):
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "sourceUrl", "cropBox", kind FROM image_cutout_jobs '
            "WHERE status = 'DONE' AND kind = 'PRODUCT_FRONT' AND \"sourceUrl\" LIKE '/product-images/%%' "
            'ORDER BY "processedAt" DESC LIMIT %s',
            (limit,),
        )
        return cur.fetchall()


def run_compare(conn, limit=COMPARE_LIMIT):
    os.makedirs(CUTOUT_PATH, exist_ok=True)
    made = failed = existing = 0
    last_error = ""
    for job_id, source, box, kind in camera_jobs(conn, limit):
        target = os.path.join(CUTOUT_PATH, f"{job_id}_bria.png")
        if os.path.exists(target):
            existing += 1
            continue
        try:
            result = cutout.make_cutout(cutout.open_source(source), box, kind, engine="bria", allow_fallback=False)
            result.save(target, format="PNG")
            made += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            last_error = str(exc)[:160]
            if failed >= 3 and made == 0:
                break  # nøgle eller API virker ikke: spar credits
    message = f"{made} Bria-udgaver lavet, {existing} fandtes, {failed} fejlede"
    if failed:
        message += f" · sidste fejl: {last_error}"
    return message, made


if __name__ == "__main__":
    connection = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
    print(run_compare(connection, int(sys.argv[1]) if len(sys.argv) > 1 else COMPARE_LIMIT)[0])
