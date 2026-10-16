"""
Sammenligner rembg og Bria på de samme billeder.

Kørsel (i image-agent-containeren, så rembg-modellen findes):
  docker compose exec image-agent python compare_engines.py 20

Henter de seneste N afsluttede fritlægningsjobs, kører hele make_cutout med
begge motorer og lægger side-om-side-billeder i /images/compare/ (original |
rembg | bria på skakternet baggrund) plus en tabel over dækning og tid.
"""

import io
import os
import sys
import time

import psycopg2
from PIL import Image

import cutout

DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
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
    original = cutout.CUTOUT_ENGINE
    cutout.CUTOUT_ENGINE = engine
    try:
        start = time.time()
        result = cutout.make_cutout(cutout.open_source(source), box, kind)
        return result, time.time() - start
    except Exception as exc:  # noqa: BLE001
        return exc, time.time() - start
    finally:
        cutout.CUTOUT_ENGINE = original


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    os.makedirs(OUT, exist_ok=True)
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "sourceUrl", "cropBox", kind FROM image_cutout_jobs '
            "WHERE status = 'DONE' ORDER BY \"processedAt\" DESC LIMIT %s",
            (limit,),
        )
        jobs = cur.fetchall()
    print(f"{'job':<28}{'kind':<15}{'rembg s':>8}{'bria s':>8}  resultat")
    for job_id, source, box, kind in jobs:
        panels, times, notes = [], [], []
        with Image.open(cutout.open_source(source)) as src:
            panels.append(cutout.crop(src.convert("RGB"), box))
        for engine in ("rembg", "bria"):
            result, seconds = run(engine, source, box, kind)
            times.append(seconds)
            if isinstance(result, Exception):
                notes.append(f"{engine}: FEJL {str(result)[:50]}")
                panels.append(Image.new("RGB", panels[0].size, (255, 200, 200)))
            else:
                bg = checker(result.size).convert("RGBA")
                bg.alpha_composite(result)
                panels.append(bg.convert("RGB"))
        height = max(p.height for p in panels)
        sheet = Image.new("RGB", (sum(p.width for p in panels) + 20, height), (40, 40, 40))
        x = 0
        for p in panels:
            sheet.paste(p, (x, 0))
            x += p.width + 10
        sheet.save(os.path.join(OUT, f"{job_id}.jpg"), quality=88)
        print(f"{job_id:<28}{kind:<15}{times[0]:>8.1f}{times[1]:>8.1f}  {'; '.join(notes) or 'ok'}")
    print(f"\nSide-om-side-billeder: {OUT}/ (original | rembg | bria)")


if __name__ == "__main__":
    main()
