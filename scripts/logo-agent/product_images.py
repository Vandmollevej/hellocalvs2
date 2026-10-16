"""
Originale produktbilleder online (docs/DECISIONS.md 2026-10-15).

Brugerens regel: før noget AI-billedarbejde søges originalbilledet online. For
hver scannet vare søges kamerafotoets udsnit med Google Vision WEB_DETECTION
(samme teknik som Google Lens og som logo-robotten), før image-agent fritlægger
kamerafotoet (image_cutout_jobs.webSearchedAt; fritlægningen venter på det).

Fundene vurderes og gemmes i product_image_searches/-candidates. Admin →
Billedforslag viser kamerafotoet, udklippet og fundene side om side, og admin
vælger. Intet vælges automatisk. Hentede kandidater slettes 7 dage efter valget.
"""

import datetime as dt
import io
import logging
import os
import re
from urllib.parse import urlparse

from PIL import Image

import agent

log = logging.getLogger("logo-agent.products")

BATCH_SIZE = int(os.environ.get("PRODUCT_IMAGE_BATCH_SIZE", "10"))
MAX_CANDIDATES = int(os.environ.get("PRODUCT_IMAGE_MAX_CANDIDATES", "8"))
MIN_CONFIDENCE = float(os.environ.get("PRODUCT_IMAGE_MIN_CONFIDENCE", "0.45"))
MIN_SIDE = 200
RETENTION_DAYS = agent.RETENTION_DAYS
CANDIDATE_DIR = os.path.join(agent.IMAGES_DIR, "web-candidates")
CANDIDATE_PREFIX = f"{agent.PUBLIC_PATH_PREFIX}/web-candidates"

# Ord, der ikke siger noget om varen (fyld i titler og links).
STOP_WORDS = {"og", "med", "the", "and", "with", "fra", "til", "for", "der", "die", "und", "mit", "g", "kg", "ml", "l", "stk"}


def words(text):
    return {w for w in re.split(r"[^a-z0-9]+", agent.normalize_words(text)) if len(w) >= 3 and w not in STOP_WORDS}


def fetch_jobs(conn, limit):
    """Fritlægningsjobs for kamerafotos, der venter på søgningen online."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.id, j."productId", j."sourceUrl", j."cropBox", p.name, b.name
            FROM image_cutout_jobs j
            JOIN products p ON p.id = j."productId"
            LEFT JOIN brands b ON b.id = p."brandId"
            WHERE j.kind = 'PRODUCT_FRONT' AND j.status = 'PENDING' AND j."webSearchedAt" IS NULL
            ORDER BY j."createdAt" ASC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def crop_to_box(image, box):
    if not isinstance(box, dict):
        return image
    try:
        x, y, w, h = (float(box[k]) for k in ("x", "y", "width", "height"))
    except (KeyError, TypeError, ValueError):
        return image
    left, top = int(x * image.width), int(y * image.height)
    right, bottom = int((x + w) * image.width), int((y + h) * image.height)
    if right - left < 32 or bottom - top < 32:
        return image
    return image.crop((max(0, left), max(0, top), min(image.width, right), min(image.height, bottom)))


def text_score(product_name, brand_name, candidate):
    """Andel af varens navneord (og brandet) i linket/sidens titel."""
    wanted = words(product_name) | words(brand_name)
    if not wanted:
        return 0.0
    haystack = " ".join(filter(None, [candidate["url"], candidate.get("pageUrl"), candidate.get("pageTitle"), urlparse(candidate["url"]).netloc]))
    found = words(haystack)
    score = len(wanted & found) / len(wanted)
    if brand_name and agent.normalize(brand_name) and agent.normalize(brand_name) in agent.normalize(haystack):
        score = max(score, 0.5)
    return float(min(1.0, score))


def to_rgb_or_rgba(image):
    """RGBA, når billedet har gennemsigtighed — også palet-PNG'er ("P" med
    tRNS), som ingen "A"-kanal har. Ellers blev den gennemsigtige baggrund til
    paletfarven (oftest sort) i det gemte fund."""
    if "A" in image.getbands() or "transparency" in image.info:
        return image.convert("RGBA")
    return image.convert("RGB")


def score_candidates(product_name, brand_name, crop, candidates):
    scored = []
    for candidate in candidates:
        if len(scored) >= MAX_CANDIDATES:
            break
        try:
            image = agent.download(candidate["url"])
            if min(image.size) < MIN_SIDE:
                continue
            image = to_rgb_or_rgba(image)
        except Exception as exc:  # noqa: BLE001 - én dårlig kandidat må ikke stoppe resten
            log.info("kandidat afvist %s (%s)", candidate["url"], exc)
            continue
        visual = agent.visual_similarity(crop, image)
        text = text_score(product_name, brand_name, candidate)
        confidence = 0.4 * visual + 0.3 * candidate["match"] + 0.3 * text
        transparent = agent.has_alpha(image)
        if transparent:
            confidence += 0.03
        if min(image.size) >= 600:
            confidence += 0.02
        scored.append({**candidate, "image": image, "transparent": transparent, "confidence": float(min(1.0, confidence))})
    scored.sort(key=lambda c: (c["confidence"], c["image"].size[0] * c["image"].size[1]), reverse=True)
    return scored


def save_image(image, relative):
    path = os.path.join(CANDIDATE_DIR, relative)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, format="PNG")
    return f"{CANDIDATE_PREFIX}/{relative}"


def mark_searched(conn, job_id):
    with conn.cursor() as cur:
        cur.execute('UPDATE image_cutout_jobs SET "webSearchedAt" = now() WHERE id = %s', (job_id,))
    conn.commit()


def process_job(conn, job_id, product_id, source_url, crop_box, product_name, brand_name):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM product_image_searches WHERE \"productId\" = %s LIMIT 1", (product_id,))
        already = cur.fetchone() is not None
    if already:
        # Fx en genkørt fritlægning: varen er allerede søgt online.
        mark_searched(conn, job_id)
        return 0
    front = agent.load_product_image(source_url)
    if not front:
        mark_searched(conn, job_id)
        return 0
    crop = crop_to_box(Image.open(io.BytesIO(front)).convert("RGB"), crop_box)
    search_id = agent.new_id()
    now = dt.datetime.now(dt.timezone.utc)
    original_url = save_image(crop, f"{product_id}/{search_id}/original.png")
    scored = [c for c in score_candidates(product_name, brand_name, crop, agent.web_candidates(crop)) if c["confidence"] >= MIN_CONFIDENCE]
    best = scored[0] if scored else None
    status = "PENDING_REVIEW" if scored else "NO_CANDIDATES"
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO product_image_searches (id, "productId", "cutoutJobId", "originalUrl", status, "bestConfidence", "createdAt", "resolvedAt")
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (search_id, product_id, job_id, original_url, status, float(best["confidence"]) if best else None, now,
             None if scored else now),
        )
        for index, candidate in enumerate(scored):
            url = save_image(candidate["image"], f"{product_id}/{search_id}/{index:02d}.png")
            cur.execute(
                """INSERT INTO product_image_candidates
                   (id, "searchId", "imageUrl", "sourceUrl", "pageUrl", "pageTitle", confidence, transparent, width, height, "createdAt")
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (agent.new_id(), search_id, url, candidate["url"], candidate.get("pageUrl"), (candidate.get("pageTitle") or "")[:300] or None,
                 float(candidate["confidence"]), bool(candidate["transparent"]), int(candidate["image"].size[0]), int(candidate["image"].size[1]), now),
            )
        cur.execute('UPDATE image_cutout_jobs SET "webSearchedAt" = now() WHERE id = %s', (job_id,))
    conn.commit()
    log.info("%s: %s (%d fund, bedste %.0f %%)", product_name, status, len(scored), (best["confidence"] * 100) if best else 0)
    return 1


def cleanup(conn):
    """Sletter hentede kandidater (fil + række) 7 dage efter valget; det valgte
    billede er kopieret til varen."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT s.id, s."productId" FROM product_image_searches s
               WHERE s."resolvedAt" IS NOT NULL AND s."resolvedAt" < now() - (%s || ' days')::interval
                 AND EXISTS (SELECT 1 FROM product_image_candidates c WHERE c."searchId" = s.id)""",
            (str(RETENTION_DAYS),),
        )
        for search_id, product_id in cur.fetchall():
            folder = os.path.join(CANDIDATE_DIR, product_id, search_id)
            original = os.path.join(folder, "original.png")
            for name in os.listdir(folder) if os.path.isdir(folder) else []:
                path = os.path.join(folder, name)
                if path != original:
                    os.remove(path)
            cur.execute('DELETE FROM product_image_candidates WHERE "searchId" = %s', (search_id,))
    conn.commit()


def run_once(conn):
    if not agent.VISION_CREDENTIALS_FILE and not agent.VISION_API_KEY:
        raise RuntimeError("GOOGLE_VISION_CREDENTIALS (eller GOOGLE_VISION_API_KEY/GOOGLE_API_KEY) mangler")
    cleanup(conn)
    jobs = fetch_jobs(conn, BATCH_SIZE)
    if not jobs:
        return "Ingen nye kamerafotos", 0
    done = 0
    for job_id, product_id, source_url, crop_box, product_name, brand_name in jobs:
        try:
            done += process_job(conn, job_id, product_id, source_url, crop_box, product_name, brand_name or "")
        except Exception:  # noqa: BLE001 - én vare må ikke stoppe kørslen
            conn.rollback()
            log.exception("søgning fejlede for vare %s", product_id)
            # Fritlægningen må ikke vente for evigt på en vare, der fejler.
            mark_searched(conn, job_id)
    return f"{done} varer søgt online", done
