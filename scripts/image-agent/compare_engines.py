"""
Sammenligner rembg og Bria på de samme billeder.

Køres fra admin → Robotter → "Bria: sammenlign med rembg" → Kør nu (job
"bria-compare"), eller manuelt: docker compose exec image-agent python compare_engines.py 20

Henter de seneste N afsluttede fritlægningsjobs, kører hele make_cutout med
begge motorer og lægger side-om-side-billeder (original | rembg | bria på
tern) i /images/compare/ samt en oversigtsside, der kan åbnes på
https://hellocal.io/product-images/compare/index.html
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


def checker(size, tile=16):
    img = Image.new("RGB", size, (255, 255, 255))
    px = img.load()
    for y in range(size[1]):
        for x in range(size[0]):
            if ((x // tile) + (y // tile)) % 2:
                px[x, y] = (205, 205, 205)
    return img


def run(engine, source, box, kind):
    start = time.time()
    try:
        result = cutout.make_cutout(cutout.open_source(source), box, kind, engine=engine, allow_fallback=False)
        return result, time.time() - start
    except Exception as exc:  # noqa: BLE001
        return exc, time.time() - start


def run_compare(conn, limit=COMPARE_LIMIT):
    os.makedirs(OUT, exist_ok=True)
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "sourceUrl", "cropBox", kind FROM image_cutout_jobs '
            "WHERE status = 'DONE' ORDER BY \"processedAt\" DESC LIMIT %s",
            (limit,),
        )
        jobs = cur.fetchall()
    rows, bria_ok, bria_failed = [], 0, 0
    for job_id, source, box, kind in jobs:
        panels, times, notes = [], [], []
        try:
            with Image.open(cutout.open_source(source)) as src:
                panels.append(cutout.crop(src.convert("RGB"), box))
        except Exception as exc:  # noqa: BLE001
            rows.append((job_id, kind, 0, 0, f"original: {exc}"))
            continue
        for engine in ("rembg", "bria"):
            result, seconds = run(engine, source, box, kind)
            times.append(seconds)
            if isinstance(result, Exception):
                notes.append(f"{engine}: FEJL {str(result)[:120]}")
                panels.append(Image.new("RGB", panels[0].size, (255, 200, 200)))
                if engine == "bria":
                    bria_failed += 1
            else:
                bg = checker(result.size).convert("RGBA")
                bg.alpha_composite(result)
                panels.append(bg.convert("RGB"))
                if engine == "bria":
                    bria_ok += 1
        height = max(p.height for p in panels)
        sheet = Image.new("RGB", (sum(p.width for p in panels) + 20, height), (40, 40, 40))
        x = 0
        for p in panels:
            sheet.paste(p, (x, 0))
            x += p.width + 10
        sheet.save(os.path.join(OUT, f"{job_id}.jpg"), quality=88)
        rows.append((job_id, kind, times[0], times[1], "; ".join(notes) or "ok"))
        if bria_failed >= 3 and bria_ok == 0:
            break  # nøgle eller API virker ikke: spar de gratis opslag
    write_index(rows)
    message = f"{bria_ok} billeder sammenlignet, {bria_failed} fejlede hos Bria · åbn /product-images/compare/index.html"
    if bria_failed and not bria_ok:
        message = f"Bria svarede ikke korrekt: {rows[-1][4] if rows else 'ukendt'}"
    return message, bria_ok


def write_index(rows):
    items = "".join(
        f'<section><h3>{html.escape(str(r[1]))} · rembg {r[2]:.1f}s · bria {r[3]:.1f}s · {html.escape(r[4])}</h3>'
        f'<img src="{html.escape(str(r[0]))}.jpg" style="max-width:100%"></section>'
        for r in rows
    )
    page = (
        '<!doctype html><meta charset="utf-8"><title>rembg mod Bria</title>'
        '<body style="font-family:sans-serif;background:#222;color:#eee;padding:16px">'
        "<h1>rembg | Bria</h1><p>Hver række: original | rembg | Bria.</p>" + items
    )
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as handle:
        handle.write(page)


if __name__ == "__main__":
    connection = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
    print(run_compare(connection, int(sys.argv[1]) if len(sys.argv) > 1 else COMPARE_LIMIT)[0])
