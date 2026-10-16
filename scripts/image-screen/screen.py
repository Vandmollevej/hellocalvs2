"""
Natjob på pc'en: screener billederne på danske og tyske Open Food Facts-varer
fra Lidl og Aldi for ufuldstændige produktbilleder (docs/DECISIONS.md 2026-10-16):

  A) produktet er skåret af i billedkanten (fx toppen),
  B) hænder/fingre går ind over billedet,
  C) produktet er åbent eller halvt fyldt (smørbakke uden låg set ovenfra,
     halv sodavand og lignende).

100% lokalt og skrivebeskyttet: databasen læses kun, billeder hentes, intet
ændres. Resultatet er en CSV pr. kørsel (til manuel gennemgang) og en
checkpoint-fil, så jobbet kan stoppes og genoptages. A og B er billige
OpenCV-målinger; C bruger CLIP (zero-shot) på CPU. Alle delscorer gemmes, så
tærsklerne kan justeres uden at køre forfra.

Kørsel (PowerShell, fra scripts/image-screen):
  $env:DATABASE_URL = "postgresql://..."      # læse-adgang er nok
  $env:IMAGE_BASE_URL = "https://<app-host>"  # eller IMAGES_DIR = mappen med billeder
  python screen.py --max-hours 8
"""

import argparse
import csv
import io
import json
import logging
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import psycopg2
import requests
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("image-screen")

DATABASE_URL = os.environ.get("DATABASE_URL", "").split("?")[0]
IMAGES_DIR = os.environ.get("IMAGES_DIR", "")
IMAGE_BASE_URL = os.environ.get("IMAGE_BASE_URL", "").rstrip("/")
OUT_DIR = Path(os.environ.get("OUT_DIR", "out"))
CHAINS = ("lidl", "aldi")
LANGUAGES = ("da", "de")
CLIP_MODEL = os.environ.get("CLIP_MODEL", "openai/clip-vit-base-patch32")

# Tærskler (justér ud fra CSV'en; delscorerne gemmes altid).
CROP_BORDER_FRACTION = 0.35   # andel af en kant, hvor forgrund rører kanten
SKIN_BORDER_FRACTION = 0.04   # hudfarve-andel i kantzonen
SKIN_TOTAL_FRACTION = 0.03
CLIP_THRESHOLD = 0.55         # sandsynlighed for "åben/halv" mod "lukket"

QUERY = """
SELECT DISTINCT p.id, p.name, p."imageUrl", p.language, b.name AS brand
FROM products p
LEFT JOIN brands b ON b.id = p."brandId"
LEFT JOIN product_stores ps ON ps."productId" = p.id
LEFT JOIN stores s ON s.id = ps."storeId"
WHERE p."externalSource" = 'OPEN_FOOD_FACTS'
  AND p."imageUrl" IS NOT NULL
  AND p.language = ANY(%s)
  AND (lower(coalesce(b.name, '')) ~ %s OR lower(coalesce(s.name, '')) ~ %s)
ORDER BY p.id
"""


def load_image(url):
    if url.startswith("http"):
        data = requests.get(url, timeout=30).content
    elif IMAGES_DIR:
        name = url.split("/product-images/", 1)[-1]
        data = (Path(IMAGES_DIR) / name).read_bytes()
    elif IMAGE_BASE_URL:
        data = requests.get(IMAGE_BASE_URL + url, timeout=30).content
    else:
        raise RuntimeError("Sæt IMAGES_DIR eller IMAGE_BASE_URL")
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        bg.alpha_composite(img)
        img = bg
    return img.convert("RGB")


def crop_score(rgb):
    """A: forgrund (alt der ikke ligner baggrunden) rører billedkanten."""
    small = cv2.resize(rgb, (200, int(200 * rgb.shape[0] / rgb.shape[1]) or 1))
    h, w = small.shape[:2]
    ring = np.concatenate([small[0], small[-1], small[:, 0], small[:, -1]])
    bg = np.median(ring, axis=0)
    diff = np.linalg.norm(small.astype(np.float32) - bg, axis=2) > 40
    diff = cv2.morphologyEx(diff.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    edges = {
        "top": diff[0:2].any(axis=0).mean(),
        "bottom": diff[-2:].any(axis=0).mean(),
        "left": diff[:, 0:2].any(axis=1).mean(),
        "right": diff[:, -2:].any(axis=1).mean(),
    }
    side = max(edges, key=edges.get)
    return edges[side], side


def skin_score(rgb):
    """B: hudfarvede pixels, især i kantzonen (hånd der går ind i billedet)."""
    ycrcb = cv2.cvtColor(cv2.resize(rgb, (200, 200)), cv2.COLOR_RGB2YCrCb)
    mask = cv2.inRange(ycrcb, (0, 135, 85), (255, 175, 130)) > 0
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    m = 20
    border = np.ones_like(mask)
    border[m:-m, m:-m] = False
    return float(mask[border].mean()), float(mask.mean())


_clip = None
PROMPTS = {
    "closed": ["a photo of a sealed, closed food package",
               "a photo of a closed bottle or can of a drink",
               "a product shot of an unopened packaged food product"],
    "open": ["a photo of an open food container with the lid removed, seen from above",
             "a photo of a half empty bottle or glass of a drink",
             "a photo of an opened package with the content visible"],
}


def clip_open_score(img):
    """C: sandsynlighed for åbent/halvt fyldt produkt (CLIP zero-shot)."""
    global _clip
    import torch
    from transformers import CLIPModel, CLIPProcessor
    if _clip is None:
        _clip = (CLIPModel.from_pretrained(CLIP_MODEL).eval(), CLIPProcessor.from_pretrained(CLIP_MODEL))
    model, proc = _clip
    texts = PROMPTS["closed"] + PROMPTS["open"]
    inputs = proc(text=texts, images=img, return_tensors="pt", padding=True)
    with torch.no_grad():
        probs = model(**inputs).logits_per_image.softmax(dim=1)[0]
    return float(probs[len(PROMPTS["closed"]):].sum())


def screen(img, use_clip=True):
    rgb = np.array(img)
    crop, side = crop_score(rgb)
    skin_border, skin_total = skin_score(rgb)
    open_p = clip_open_score(img) if use_clip else 0.0
    flags = []
    if crop >= CROP_BORDER_FRACTION:
        flags.append("A_afskaaret:" + side)
    if skin_border >= SKIN_BORDER_FRACTION and skin_total >= SKIN_TOTAL_FRACTION:
        flags.append("B_haand")
    if open_p >= CLIP_THRESHOLD:
        flags.append("C_aaben")
    return crop, side, skin_border, skin_total, open_p, flags


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-hours", type=float, default=8)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--no-clip", action="store_true", help="kun A og B (hurtig)")
    args = ap.parse_args()
    if not DATABASE_URL:
        sys.exit("Sæt DATABASE_URL")

    OUT_DIR.mkdir(exist_ok=True)
    ckpt_path = OUT_DIR / "checkpoint.json"
    done = set(json.loads(ckpt_path.read_text())) if ckpt_path.exists() else set()
    report = OUT_DIR / "ufuldstaendige-billeder.csv"
    new_file = not report.exists()

    chain_re = "(" + "|".join(CHAINS) + ")"
    with psycopg2.connect(DATABASE_URL) as conn, conn.cursor() as cur:
        conn.set_session(readonly=True)
        cur.execute(QUERY, (list(LANGUAGES), chain_re, chain_re))
        rows = cur.fetchall()
    todo = [r for r in rows if r[0] not in done]
    if args.limit:
        todo = todo[: args.limit]
    log.info("%d varer i alt, %d mangler at blive screenet", len(rows), len(todo))

    deadline = time.time() + args.max_hours * 3600
    with report.open("a", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        if new_file:
            w.writerow(["produkt_id", "navn", "brand", "sprog", "billede", "flag",
                        "kant_forgrund", "kant", "hud_kant", "hud_total", "aaben_sandsynlighed"])
        for i, (pid, name, url, lang, brand) in enumerate(todo, 1):
            if time.time() > deadline:
                log.info("tidsgrænsen nået — genoptag senere")
                break
            try:
                crop, side, sb, st, op, flags = screen(load_image(url), not args.no_clip)
            except Exception as e:  # ét dårligt billede må ikke vælte natten
                log.warning("%s: %s", pid, e)
                w.writerow([pid, name, brand, lang, url, "FEJL:" + str(e)[:80], "", "", "", "", ""])
                done.add(pid)
                continue
            if flags:
                w.writerow([pid, name, brand, lang, url, ",".join(flags),
                            f"{crop:.2f}", side, f"{sb:.3f}", f"{st:.3f}", f"{op:.2f}"])
            done.add(pid)
            if i % 50 == 0:
                f.flush()
                ckpt_path.write_text(json.dumps(sorted(done)))
                log.info("%d/%d", i, len(todo))
    ckpt_path.write_text(json.dumps(sorted(done)))
    log.info("færdig — rapport: %s", report)


if __name__ == "__main__":
    main()
