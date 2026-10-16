"""
Natlig screening af produktbilleder for ufuldstændige billeder
(docs/DECISIONS.md 2026-10-16). Gælder danske og tyske Open Food Facts-varer fra
Lidl og Aldi og finder billeder, hvor produktet er

  A) skåret af i billedkanten (fx toppen),
  B) dækket af hænder/fingre, eller
  C) åbent/halvt fyldt (smørbakke uden låg set ovenfra, halv sodavand osv.).

100% lokalt, CPU-only. Ændrer aldrig varen eller billedet: resultatet gemmes i
product_image_screenings (delscorer + flag), så admin kan gennemgå flagene og
tærsklerne kan justeres uden at screene forfra. Heuristikkerne er de samme som
i scripts/image-screen/screen.py (pc-udgaven) — hold dem ens.
"""

import logging
import os
import re

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

import agent_images

log = logging.getLogger("image-screen-local")

BATCH_SIZE = int(os.environ.get("IMAGE_SCREEN_BATCH", "300"))
CLIP_MODEL = os.environ.get("IMAGE_SCREEN_CLIP_MODEL", "openai/clip-vit-base-patch32")
LANGUAGES = ["da", "de"]
# Butiksnavne og Lidl/Aldi-egenmærker (mærke- eller butiksnavnet matches).
CHAIN_PATTERN = (
    "lidl|aldi|milbona|pilos|kania|vemondo|favorina|sondey|bellarom|freeway|"
    "chef select|deluxe|milsani|mamia|gutbio|gut bio|nur nur natur|meine metzgerei|"
    "choceur|moser roth|ocean sea|tandil|bio-sonne"
)

CROP_BORDER_FRACTION = 0.35
SKIN_BORDER_FRACTION = 0.04
SKIN_TOTAL_FRACTION = 0.03
OPEN_THRESHOLD = 0.55

PROMPTS_CLOSED = [
    "a photo of a sealed, closed food package",
    "a photo of a closed bottle or can of a drink",
    "a product shot of an unopened packaged food product",
]
PROMPTS_OPEN = [
    "a photo of an open food container with the lid removed, seen from above",
    "a photo of a half empty bottle or glass of a drink",
    "a photo of an opened package with the content visible",
]

_clip = None


def crop_score(rgb):
    small = cv2.resize(rgb, (200, max(1, int(200 * rgb.shape[0] / rgb.shape[1]))))
    ring = np.concatenate([small[0], small[-1], small[:, 0], small[:, -1]])
    background = np.median(ring, axis=0)
    diff = np.linalg.norm(small.astype(np.float32) - background, axis=2) > 40
    diff = cv2.morphologyEx(diff.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    edges = {
        "top": diff[0:2].any(axis=0).mean(),
        "bottom": diff[-2:].any(axis=0).mean(),
        "left": diff[:, 0:2].any(axis=1).mean(),
        "right": diff[:, -2:].any(axis=1).mean(),
    }
    side = max(edges, key=edges.get)
    return float(edges[side]), side


def skin_score(rgb):
    ycrcb = cv2.cvtColor(cv2.resize(rgb, (200, 200)), cv2.COLOR_RGB2YCrCb)
    mask = cv2.inRange(ycrcb, (0, 135, 85), (255, 175, 130)) > 0
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    margin = 20
    border = np.ones_like(mask)
    border[margin:-margin, margin:-margin] = False
    return float(mask[border].mean()), float(mask.mean())


def open_score(image):
    global _clip
    if _clip is None:
        _clip = (CLIPModel.from_pretrained(CLIP_MODEL).eval(), CLIPProcessor.from_pretrained(CLIP_MODEL))
    model, processor = _clip
    inputs = processor(text=PROMPTS_CLOSED + PROMPTS_OPEN, images=image, return_tensors="pt", padding=True)
    with torch.no_grad():
        probs = model(**inputs).logits_per_image.softmax(dim=1)[0]
    return float(probs[len(PROMPTS_CLOSED):].sum())


def screen_image(image: Image.Image):
    rgb = np.array(image)
    crop, side = crop_score(rgb)
    skin_border, skin_total = skin_score(rgb)
    opened = open_score(image)
    flags = []
    if crop >= CROP_BORDER_FRACTION:
        flags.append("CROPPED")
    if skin_border >= SKIN_BORDER_FRACTION and skin_total >= SKIN_TOTAL_FRACTION:
        flags.append("HAND")
    if opened >= OPEN_THRESHOLD:
        flags.append("OPEN")
    return crop, side, skin_border, skin_total, opened, flags


def run_once(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT p.id, p."imageUrl"
            FROM products p
            LEFT JOIN brands b ON b.id = p."brandId"
            LEFT JOIN product_stores ps ON ps."productId" = p.id
            LEFT JOIN stores s ON s.id = ps."storeId"
            WHERE p."externalSource" = 'OPEN_FOOD_FACTS'
              AND p."imageUrl" IS NOT NULL
              AND p.language = ANY(%s)
              AND (lower(coalesce(b.name, '')) ~ %s OR lower(coalesce(s.name, '')) ~ %s)
              AND NOT EXISTS (SELECT 1 FROM product_image_screenings x
                              WHERE x."productId" = p.id AND x."imageUrl" = p."imageUrl")
            ORDER BY p.id
            LIMIT %s
            """,
            (LANGUAGES, CHAIN_PATTERN, CHAIN_PATTERN, BATCH_SIZE),
        )
        rows = cur.fetchall()
    if not rows:
        return "Alle Lidl/Aldi-billeder er screenet", 0
    done = flagged = 0
    for product_id, image_url in rows:
        try:
            crop, side, skin_border, skin_total, opened, flags = screen_image(agent_images.load_on_white(image_url))
            error = None
        except Exception as exc:  # ét dårligt billede må ikke vælte natten
            crop = skin_border = skin_total = opened = 0.0
            side, flags, error = None, [], str(exc)[:200]
            log.warning("%s: %s", product_id, exc)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO product_image_screenings
                  ("productId", "imageUrl", flags, "cropScore", "cropSide", "skinBorderScore",
                   "skinTotalScore", "openScore", error, "screenedAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT ("productId") DO UPDATE SET
                  "imageUrl" = EXCLUDED."imageUrl", flags = EXCLUDED.flags, "cropScore" = EXCLUDED."cropScore",
                  "cropSide" = EXCLUDED."cropSide", "skinBorderScore" = EXCLUDED."skinBorderScore",
                  "skinTotalScore" = EXCLUDED."skinTotalScore", "openScore" = EXCLUDED."openScore",
                  error = EXCLUDED.error, "screenedAt" = now(), "reviewedAt" = NULL
                """,
                (product_id, image_url, flags, crop, side, skin_border, skin_total, opened, error),
            )
        conn.commit()
        done += 1
        flagged += 1 if flags else 0
    return f"{done} billeder screenet, {flagged} markeret", done
