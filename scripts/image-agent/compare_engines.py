"""
Sammenligner den eksisterende fritlægning med Bria på de samme billeder.

Billederne vises to og to på /product-images/compare/index.html (eksisterende
til venstre, Bria til højre) på rød baggrund, så kanterne er lette at se.
Kilde: mappen "Mangler" i billedmappen (/images/Mangler, dvs.
data/product-images/Mangler), ellers de seneste kamerabilleder, brugerne har
taget (afsluttede PRODUCT_FRONT-jobs). Jobbet "bria-compare" kører af sig selv én
gang efter deploy, så længe siden ikke findes; ellers manuelt:
docker compose exec image-agent python compare_engines.py 20
"""

import html
import os
import sys
import time

import psycopg2
from PIL import Image

import cutout

COMPARE_LIMIT = int(os.environ.get("BRIA_COMPARE_LIMIT", "20"))
OUT = os.path.join(cutout.OUTPUT_DIR, "compare")
SOURCE_DIR = os.environ.get("BRIA_COMPARE_DIR", os.path.join(cutout.OUTPUT_DIR, "Mangler"))
INDEX = os.path.join(OUT, "index.html")
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
RED = (220, 30, 30, 255)


def on_red(cutout_image):
    background = Image.new("RGBA", cutout_image.size, RED)
    background.alpha_composite(cutout_image.convert("RGBA"))
    return background.convert("RGB")


def run(engine, source, box, kind):
    start = time.time()
    try:
        result = cutout.make_cutout(source, box, kind, engine=engine, allow_fallback=False)
        return result, time.time() - start
    except Exception as exc:  # noqa: BLE001
        return exc, time.time() - start


def folder_sources(limit):
    if not os.path.isdir(SOURCE_DIR):
        return []
    names = sorted(name for name in os.listdir(SOURCE_DIR) if name.lower().endswith(IMAGE_EXTENSIONS))
    return [(os.path.splitext(name)[0], os.path.join(SOURCE_DIR, name), None, "PRODUCT_FRONT") for name in names[:limit]]


def camera_sources(conn, limit):
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "sourceUrl", "cropBox", kind FROM image_cutout_jobs '
            "WHERE status = 'DONE' AND kind = 'PRODUCT_FRONT' AND \"sourceUrl\" LIKE '/product-images/%%' "
            'ORDER BY "processedAt" DESC LIMIT %s',
            (limit,),
        )
        rows = cur.fetchall()
    return [(job_id, cutout.open_source(source), box, kind) for job_id, source, box, kind in rows]


def run_compare(conn, limit=COMPARE_LIMIT):
    os.makedirs(OUT, exist_ok=True)
    jobs = folder_sources(limit) or camera_sources(conn, limit)
    rows, bria_ok, bria_failed = [], 0, 0
    for name, source, box, kind in jobs:
        names, notes = {}, []
        for engine, label in (("rembg", "normal"), ("bria", "bria")):
            result, seconds = run(engine, source, box, kind)
            if isinstance(result, Exception):
                notes.append(f"{label}: FEJL {str(result)[:120]}")
                if engine == "bria":
                    bria_failed += 1
                continue
            filename = f"{name}_{label}.jpg" if label == "bria" else f"{name}.jpg"
            on_red(result).save(os.path.join(OUT, filename), quality=90)
            names[label] = filename
            if engine == "bria":
                bria_ok += 1
        rows.append((str(name), names.get("normal"), names.get("bria"), "; ".join(notes)))
        if bria_failed >= 3 and bria_ok == 0:
            break  # nøgle eller API virker ikke: spar de gratis opslag
    write_index(rows)
    message = f"{bria_ok} billeder sammenlignet, {bria_failed} fejlede hos Bria · åbn /product-images/compare/index.html"
    if bria_failed and not bria_ok:
        message = f"Bria svarede ikke korrekt: {rows[-1][3] if rows else 'ingen billeder fundet'}"
    return message, bria_ok


def write_index(rows):
    def cell(filename, label):
        if not filename:
            return f"<div class=empty>{label}: intet billede</div>"
        return f"<figure><img src=\"{html.escape(filename)}\"><figcaption>{label}</figcaption></figure>"

    items = "".join(
        f"<section><h3>{html.escape(name)}</h3>"
        f"<div class=pair>{cell(normal, 'Normal')}{cell(bria, 'Bria')}</div>"
        f"{f'<p class=err>{html.escape(note)}</p>' if note else ''}</section>"
        for name, normal, bria, note in rows
    )
    page = (
        "<!doctype html><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\">"
        "<title>Normal mod Bria</title>"
        "<style>body{font-family:sans-serif;background:#222;color:#eee;margin:0;padding:16px}"
        "h1{margin:0 0 4px}h3{margin:16px 0 6px;font-size:14px;color:#aaa}"
        ".pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}figure{margin:0}"
        "img{width:100%;height:auto;display:block}figcaption{font-size:13px;margin-top:2px}"
        ".empty{background:#333;padding:24px;text-align:center}.err{color:#ff9a9a;font-size:13px}</style>"
        "<h1>Normal | Bria</h1><p>To og to: venstre normal fritlægning, højre Bria. Rød baggrund viser kanterne.</p>"
        + items
    )
    with open(INDEX, "w", encoding="utf-8") as handle:
        handle.write(page)


if __name__ == "__main__":
    connection = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
    print(run_compare(connection, int(sys.argv[1]) if len(sys.argv) > 1 else COMPARE_LIMIT)[0])
