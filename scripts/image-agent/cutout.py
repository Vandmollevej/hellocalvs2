"""
Fritskrabning af forsidefotos fra det guidede kamera-flow (docs/DECISIONS.md
2026-09-26).

Next.js lægger jobs i image_cutout_jobs (BRAND_LOGO + PRODUCT_FRONT). Her
beskæres fotoet efter AI'ens boks, baggrunden fjernes med rembg, og et
transparent PNG gemmes under /product-images/cutouts. Derefter skrives
resultatet videre:

- PRODUCT_FRONT -> products.pendingImageUrl (imageStatus=PENDING), så den
  eksisterende admin-godkendelse afgør om det bliver det officielle billede.
- BRAND_LOGO -> brands.logoUrl, men kun når brandet intet logo har, og både
  AI'ens sikkerhed på logonavnet og matchet mod brandet er høje. Ellers bliver
  jobbet liggende som logo-kandidat for brandet.
"""

import io
import logging
import os

from PIL import Image
from rembg import remove

log = logging.getLogger("image-agent.cutout")

OUTPUT_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/product-images")
CUTOUT_DIR = "cutouts"
CUTOUT_BATCH_SIZE = int(os.environ.get("CUTOUT_BATCH_SIZE", "10"))
LOGO_AUTO_APPLY_MIN_CONFIDENCE = float(os.environ.get("LOGO_AUTO_APPLY_MIN_CONFIDENCE", "0.9"))
LOGO_AUTO_APPLY_MIN_MATCH = float(os.environ.get("LOGO_AUTO_APPLY_MIN_MATCH", "0.9"))


def local_path(public_url):
    if not public_url.startswith(PUBLIC_PATH_PREFIX + "/"):
        raise ValueError(f"source outside {PUBLIC_PATH_PREFIX}: {public_url}")
    relative = public_url[len(PUBLIC_PATH_PREFIX) + 1 :]
    path = os.path.normpath(os.path.join(OUTPUT_DIR, relative))
    if not path.startswith(os.path.normpath(OUTPUT_DIR) + os.sep):
        raise ValueError(f"invalid source path: {public_url}")
    return path


def crop(image, box):
    if not box:
        return image
    width, height = image.size
    left = int(max(0.0, float(box["x"])) * width)
    top = int(max(0.0, float(box["y"])) * height)
    right = int(min(1.0, float(box["x"]) + float(box["width"])) * width)
    bottom = int(min(1.0, float(box["y"]) + float(box["height"])) * height)
    if right - left < 8 or bottom - top < 8:
        raise ValueError(f"crop box too small: {box}")
    return image.crop((left, top, right, bottom))


def make_cutout(source_path, box):
    with Image.open(source_path) as source:
        cropped = crop(source.convert("RGB"), box)
    buffer = io.BytesIO()
    cropped.save(buffer, format="PNG")
    cutout = Image.open(io.BytesIO(remove(buffer.getvalue()))).convert("RGBA")
    bbox = cutout.getbbox()
    if not bbox:
        raise ValueError("background removal left nothing")
    return cutout.crop(bbox)


def fetch_pending_jobs(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, "sourceUrl", "cropBox"
            FROM image_cutout_jobs
            WHERE status = 'PENDING'
            ORDER BY "createdAt" ASC
            LIMIT %s
            """,
            (CUTOUT_BATCH_SIZE,),
        )
        return cur.fetchall()


def process_job(conn, job_id, source_url, crop_box):
    try:
        cutout = make_cutout(local_path(source_url), crop_box)
        os.makedirs(os.path.join(OUTPUT_DIR, CUTOUT_DIR), exist_ok=True)
        cutout.save(os.path.join(OUTPUT_DIR, CUTOUT_DIR, f"{job_id}.png"), format="PNG")
        result_url = f"{PUBLIC_PATH_PREFIX}/{CUTOUT_DIR}/{job_id}.png"
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE image_cutout_jobs
                SET status = 'DONE', "resultUrl" = %s, "processedAt" = now(), error = NULL
                WHERE id = %s
                """,
                (result_url, job_id),
            )
        conn.commit()
        log.info("cutout done %s -> %s", job_id, result_url)
    except Exception as exc:  # noqa: BLE001 - one bad job must not stop the batch
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE image_cutout_jobs
                SET status = 'FAILED', error = %s, "processedAt" = now()
                WHERE id = %s
                """,
                (str(exc)[:500], job_id),
            )
        conn.commit()
        log.warning("cutout failed %s: %s", job_id, exc)


# Jobbet kan blive færdigt før produktet er oprettet (productId/brandId
# sættes først ved oprettelsen), så resultatet skrives videre i et separat
# trin, der kører hver runde.
def apply_finished_jobs(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE products p
            SET "pendingImageUrl" = j."resultUrl", "imageStatus" = 'PENDING'
            FROM image_cutout_jobs j
            WHERE j.kind = 'PRODUCT_FRONT' AND j.status = 'DONE' AND j."appliedAt" IS NULL
              AND j."productId" = p.id AND p."pendingImageUrl" IS NULL
            """
        )
        cur.execute(
            """
            UPDATE image_cutout_jobs
            SET "appliedAt" = now()
            WHERE kind = 'PRODUCT_FRONT' AND status = 'DONE' AND "appliedAt" IS NULL
              AND "productId" IS NOT NULL
            """
        )
        cur.execute(
            """
            UPDATE brands b
            SET "logoUrl" = j."resultUrl"
            FROM (
              SELECT DISTINCT ON ("brandId") "brandId", "resultUrl"
              FROM image_cutout_jobs
              WHERE kind = 'BRAND_LOGO' AND status = 'DONE' AND "appliedAt" IS NULL
                AND "brandId" IS NOT NULL
                AND confidence >= %s AND "matchScore" >= %s
              ORDER BY "brandId", confidence DESC
            ) j
            WHERE j."brandId" = b.id AND b."logoUrl" IS NULL
            RETURNING b.id
            """,
            (LOGO_AUTO_APPLY_MIN_CONFIDENCE, LOGO_AUTO_APPLY_MIN_MATCH),
        )
        applied_brands = [row[0] for row in cur.fetchall()]
        if applied_brands:
            cur.execute(
                """
                UPDATE image_cutout_jobs
                SET "appliedAt" = now()
                WHERE kind = 'BRAND_LOGO' AND status = 'DONE' AND "appliedAt" IS NULL
                  AND "brandId" = ANY(%s) AND "resultUrl" IN (
                    SELECT "logoUrl" FROM brands WHERE id = ANY(%s)
                  )
                """,
                (applied_brands, applied_brands),
            )
    conn.commit()


def run_cutouts(conn):
    for job_id, source_url, crop_box in fetch_pending_jobs(conn):
        process_job(conn, job_id, source_url, crop_box)
    apply_finished_jobs(conn)
