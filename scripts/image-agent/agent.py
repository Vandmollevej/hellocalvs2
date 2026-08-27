"""
HELLO CAL billede-agent.

Lytter efter produkter uden billede (kun generiske råvarer uden brand, jf.
docs/AI.md), finder det bedste kandidatbillede via Google Custom Search,
fjerner baggrunden og gemmer det som et transparent PNG. Resultatet skrives
som "pendingImageUrl" med imageStatus=PENDING og venter på admin-godkendelse
(docs/ADMIN.md) — det bliver aldrig automatisk det officielle imageUrl.
"""

import io
import logging
import os
import time

import psycopg2
import requests
from PIL import Image
from rembg import remove

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("image-agent")

# Prisma's DATABASE_URL carries a `?schema=public` query param that
# psycopg2/libpq doesn't recognize; Postgres already defaults to "public".
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]
GOOGLE_CSE_ID = os.environ["GOOGLE_CSE_ID"]
OUTPUT_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/product-images")
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "300"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "5"))
MIN_SIDE_PX = int(os.environ.get("MIN_SIDE_PX", "600"))

SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


def fetch_candidate_products(conn, limit):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name FROM products
            WHERE "brandId" IS NULL
              AND status = 'APPROVED'
              AND discontinued = false
              AND "imageUrl" IS NULL
              AND "pendingImageUrl" IS NULL
              AND "imageStatus" = 'NONE'
            ORDER BY "createdAt" ASC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def search_image_candidates(query):
    params = {
        "key": GOOGLE_API_KEY,
        "cx": GOOGLE_CSE_ID,
        "q": query,
        "searchType": "image",
        "imgSize": "xxlarge",
        "safe": "active",
        "num": 8,
    }
    response = requests.get(SEARCH_URL, params=params, timeout=15)
    response.raise_for_status()
    items = response.json().get("items", [])

    def area(item):
        image = item.get("image", {})
        return int(image.get("width", 0)) * int(image.get("height", 0))

    return sorted(items, key=area, reverse=True)


def download_image(url):
    response = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
    response.raise_for_status()
    return response.content


def remove_background(image_bytes):
    source = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    if min(source.size) < MIN_SIDE_PX:
        raise ValueError(f"image too small: {source.size}")

    cutout_bytes = remove(image_bytes)
    cutout = Image.open(io.BytesIO(cutout_bytes)).convert("RGBA")

    bbox = cutout.getbbox()
    if bbox:
        cutout = cutout.crop(bbox)

    return cutout


def process_product(conn, product_id, name):
    log.info("searching image for %s (%s)", name, product_id)
    candidates = search_image_candidates(name)

    for candidate in candidates:
        link = candidate.get("link")
        try:
            raw = download_image(link)
            cutout = remove_background(raw)
        except Exception as exc:  # noqa: BLE001 - one bad candidate must not stop the batch
            log.warning("candidate rejected for %s: %s (%s)", product_id, link, exc)
            continue

        output_path = os.path.join(OUTPUT_DIR, f"{product_id}.png")
        cutout.save(output_path, format="PNG")

        public_path = f"{PUBLIC_PATH_PREFIX}/{product_id}.png"
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE products
                SET "pendingImageUrl" = %s, "imageStatus" = 'PENDING'
                WHERE id = %s
                """,
                (public_path, product_id),
            )
        conn.commit()
        log.info("saved candidate image for %s -> %s", product_id, public_path)
        return

    log.warning("no usable image found for %s (%s)", name, product_id)


def run_once(conn):
    products = fetch_candidate_products(conn, BATCH_SIZE)
    if not products:
        log.info("no products waiting for an image")
        return

    for product_id, name in products:
        try:
            process_product(conn, product_id, name)
        except Exception:  # noqa: BLE001 - keep the loop alive across products
            conn.rollback()
            log.exception("failed to process %s (%s)", name, product_id)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    log.info("image agent started, polling every %ss", POLL_INTERVAL_SECONDS)

    while True:
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                run_once(conn)
        except Exception:  # noqa: BLE001 - a broken cycle must not kill the service
            log.exception("cycle failed")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
