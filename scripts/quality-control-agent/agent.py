"""
HELLO CAL kvalitetskontrol-agent (docs/DECISIONS.md, 2026-09-19).

Sammenligner et produkts stregkode-/næring-/ingrediensfoto
(ai_product_analyses.image_url) mod dets forsidefoto (products.image_url) og
beregner en samlet match-confidence, gemt som delresultater (ikke kun ét
ukendt tal) i product_match_checks — se docs/DECISIONS.md for hvorfor.
Under 80% stilles til manuel admin-gennemgang (/admin/quality-control);
denne agent ændrer aldrig selv et produkts status eller billede.

100% lokal, CPU-only (ingen GPU på Synology-målet, se docs/DEPLOYMENT.md) —
ingen ChatGPT/OpenAI i denne del af pipelinen. DINOv2 giver et visuelt
lighedsmål; farve-histogram og SSIM er billige supplerende signaler, så en
fremtidig fejlanalyse kan se *hvorfor* motoren tog fejl, ikke kun at den gjorde.
"""

import io
import logging
import os
import time

import cv2
import numpy as np
import psycopg2

from job_control import run_forever
import requests
import torch
from PIL import Image
from skimage.metrics import structural_similarity
from transformers import AutoImageProcessor, AutoModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("quality-control-agent")

# Prisma's DATABASE_URL carries a `?schema=public` query param that
# psycopg2/libpq doesn't recognize; Postgres already defaults to "public".
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
# Samme volume/prefix-mønster som scripts/image-agent — billederne ligger i
# den allerede eksisterende /product-images-volume (compose.production.yaml).
IMAGES_DIR = os.environ.get("PRODUCT_IMAGES_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/product-images")
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "300"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "10"))
MODEL_NAME = os.environ.get("QC_MODEL_NAME", "facebook/dinov2-small")

# Vægtning af de tre delsignaler til den samlede confidence — se
# docs/DECISIONS.md for baggrunden for at gemme dem separat i stedet for kun
# ét tal: en fremtidig admin-fejlanalyse skal kunne se hvilket signal der
# faktisk fejlede, og vægtene justeres her, ikke ved at genberegne fra bunden.
VISUAL_WEIGHT = 0.5
COLOR_WEIGHT = 0.25
STRUCTURAL_WEIGHT = 0.25

_processor = None
_model = None


def load_model():
    global _processor, _model
    if _model is not None:
        return
    log.info("loading %s (first run downloads weights, then caches them)", MODEL_NAME)
    _processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
    _model = AutoModel.from_pretrained(MODEL_NAME)
    _model.eval()


def fetch_candidate_analyses(conn, limit):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a."productId", a.kind, a."imageUrl", p."imageUrl"
            FROM ai_product_analyses a
            JOIN products p ON p.id = a."productId"
            LEFT JOIN product_match_checks c ON c."analysisId" = a.id
            WHERE a.kind IN ('BARCODE', 'NUTRITION', 'INGREDIENTS')
              AND a."productId" IS NOT NULL
              AND a."imageUrl" IS NOT NULL
              AND p."imageUrl" IS NOT NULL
              AND c.id IS NULL
            ORDER BY a."createdAt" ASC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def load_image(public_url: str) -> Image.Image:
    if public_url.startswith(PUBLIC_PATH_PREFIX):
        local_path = os.path.join(IMAGES_DIR, public_url[len(PUBLIC_PATH_PREFIX) :].lstrip("/"))
        with open(local_path, "rb") as handle:
            return Image.open(io.BytesIO(handle.read())).convert("RGB")
    # A small number of images are hosted externally (e.g. Open Food Facts
    # imports) rather than in the local volume — fetched directly instead.
    response = requests.get(public_url, timeout=15)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content)).convert("RGB")


def visual_similarity(image_a: Image.Image, image_b: Image.Image) -> float:
    load_model()
    inputs = _processor(images=[image_a, image_b], return_tensors="pt")
    with torch.no_grad():
        outputs = _model(**inputs)
    # Mean-pool the patch tokens into one embedding per image (DINOv2 has no
    # dedicated pooler output on the base AutoModel).
    embeddings = outputs.last_hidden_state.mean(dim=1)
    cosine = torch.nn.functional.cosine_similarity(embeddings[0:1], embeddings[1:2]).item()
    return max(0.0, min(1.0, (cosine + 1) / 2))


def color_similarity(image_a: Image.Image, image_b: Image.Image) -> float:
    def histogram(image):
        array = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2HSV)
        hist = cv2.calcHist([array], [0, 1], None, [50, 60], [0, 180, 0, 256])
        cv2.normalize(hist, hist)
        return hist

    correlation = cv2.compareHist(histogram(image_a), histogram(image_b), cv2.HISTCMP_CORREL)
    return max(0.0, min(1.0, (correlation + 1) / 2))


def structural_similarity_score(image_a: Image.Image, image_b: Image.Image) -> float:
    size = (256, 256)
    gray_a = np.array(image_a.convert("L").resize(size))
    gray_b = np.array(image_b.convert("L").resize(size))
    score = structural_similarity(gray_a, gray_b)
    return max(0.0, min(1.0, score))


def process_analysis(conn, analysis_id, product_id, photo_type, analysis_image_url, product_image_url):
    log.info("comparing %s photo for product %s", photo_type, product_id)
    analysis_image = load_image(analysis_image_url)
    product_image = load_image(product_image_url)

    visual = visual_similarity(analysis_image, product_image)
    color = color_similarity(analysis_image, product_image)
    structural = structural_similarity_score(analysis_image, product_image)
    confidence = round(100 * (VISUAL_WEIGHT * visual + COLOR_WEIGHT * color + STRUCTURAL_WEIGHT * structural), 1)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO product_match_checks
                (id, "productId", "analysisId", "photoType", "visualScore", "colorScore", "structuralScore", "confidence")
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s)
            """,
            (product_id, analysis_id, photo_type, round(visual * 100, 1), round(color * 100, 1), round(structural * 100, 1), confidence),
        )
    conn.commit()
    log.info("product %s (%s): confidence %.1f%%", product_id, photo_type, confidence)


def run_once(conn):
    analyses = fetch_candidate_analyses(conn, BATCH_SIZE)
    if not analyses:
        log.info("no pending photo comparisons")
        return

    for analysis_id, product_id, kind, analysis_image_url, product_image_url in analyses:
        try:
            process_analysis(conn, analysis_id, product_id, kind, analysis_image_url, product_image_url)
        except Exception:  # noqa: BLE001 - keep the loop alive across products
            conn.rollback()
            log.exception("failed to process analysis %s (product %s)", analysis_id, product_id)


def main():
    log.info("quality-control agent started, polling every %ss", POLL_INTERVAL_SECONDS)
    # Planlægning/pause/"kør nu" styres fra admin "Cron-jobs" (job_control.py);
    # POLL_INTERVAL_SECONDS er kun standard-intervallet første gang.
    run_forever(DATABASE_URL, "quality-control-agent", run_once, interval_minutes=max(1, POLL_INTERVAL_SECONDS // 60))


if __name__ == "__main__":
    main()
