"""
HELLO CAL logo-robot (docs/LOGO-AGENT.md).

Kører hver nat. For brands uden logo:

1. Tag et produkts forsidefoto og isolér logoet med Google Vision
   LOGO_DETECTION — logoet beskæres (klippes ud som rektangel), det fritlægges
   ikke. Udsnittet gemmes som "originalen".
2. Send udsnittet til Vision WEB_DETECTION, som finder de samme og lignende
   billeder på nettet samt siderne de ligger på.
3. Hent op til 10 kandidater, konverter til PNG (ensfarvet baggrund gøres
   transparent) og vurder dem i procent: Visions egen logo-genkendelse af
   kandidaten, match-typen fra web-søgningen, visuel lighed med originalen og
   om brandnavnet står på siden/linket.
4. >= 90 % OG brandnavnet på siden/linket -> gemmes automatisk som brandets
   logo. Ellers vises kandidater >= 50 % i admin "Logoer" til manuelt valg.

Ikke-valgte kandidater (fil + række) slettes 7 dage efter afgørelsen.
Bruger Google Vision API — ikke Custom Search, som er lukket for nye kunder og
stopper 1. januar 2027 (brugerbeslutning 2026-09-24).
"""

import base64
import datetime as dt
import io
import logging
import os
import re
import secrets
import shutil
import time
import unicodedata
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import imagehash
import psycopg2
import requests
from PIL import Image

import import_logos
from job_control import run_forever

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("logo-agent")

DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
VISION_API_KEY = os.environ.get("GOOGLE_VISION_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
# Servicekontoens nøglefil (JSON) — foretrækkes frem for en API-nøgle. Brugerens
# Vision-adgang er en servicekonto (vision-api@hellocal), ikke en API-nøgle
# (test 2026-09-28: alle API-nøgler blev afvist af Vision, servicekontoen virker).
VISION_CREDENTIALS_FILE = os.environ.get("GOOGLE_VISION_CREDENTIALS", "").strip()
IMAGES_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/product-images")
RUN_HOUR = int(os.environ.get("LOGO_AGENT_RUN_HOUR", "3"))
TIMEZONE = ZoneInfo(os.environ.get("TZ", "Europe/Copenhagen"))
BATCH_SIZE = int(os.environ.get("LOGO_AGENT_BATCH_SIZE", "25"))
MAX_CANDIDATES = int(os.environ.get("LOGO_AGENT_MAX_CANDIDATES", "10"))
AUTO_ACCEPT = float(os.environ.get("LOGO_AGENT_AUTO_ACCEPT", "0.90"))
MIN_CONFIDENCE = float(os.environ.get("LOGO_AGENT_MIN_CONFIDENCE", "0.50"))
RETENTION_DAYS = int(os.environ.get("LOGO_AGENT_RETENTION_DAYS", "7"))
RUN_ON_START = os.environ.get("LOGO_AGENT_RUN_ON_START", "false").lower() == "true"

VISION_URL = "https://vision.googleapis.com/v1/images:annotate"
LOGO_DIR = os.path.join(IMAGES_DIR, "brand-logos")
LOGO_PREFIX = f"{PUBLIC_PATH_PREFIX}/brand-logos"
HEADERS = {"User-Agent": "Mozilla/5.0 (HelloCal logo-agent)"}


# --- hjælpere --------------------------------------------------------------

def new_id():
    # Prisma bruger cuid() som standard; et tilfældigt id i samme længde og
    # tegnsæt er fuldt kompatibelt med String-kolonnen.
    return "c" + secrets.token_hex(12)


def normalize(text):
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", text)


def public_to_path(public_url):
    return os.path.join(IMAGES_DIR, public_url[len(PUBLIC_PATH_PREFIX) + 1:])


def load_product_image(image_url):
    if not image_url:
        return None
    if image_url.startswith("data:image/"):
        return base64.b64decode(image_url.split(",", 1)[1])
    if image_url.startswith(PUBLIC_PATH_PREFIX + "/"):
        path = public_to_path(image_url)
        return open(path, "rb").read() if os.path.exists(path) else None
    if image_url.startswith("https://"):
        response = requests.get(image_url, timeout=15, headers=HEADERS)
        response.raise_for_status()
        return response.content
    return None


_vision_credentials = None


def vision_auth():
    """Headers og query-parametre til Vision: servicekonto, ellers API-nøgle."""
    global _vision_credentials
    if VISION_CREDENTIALS_FILE:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account

        if _vision_credentials is None:
            _vision_credentials = service_account.Credentials.from_service_account_file(
                VISION_CREDENTIALS_FILE, scopes=["https://www.googleapis.com/auth/cloud-vision"]
            )
        if not _vision_credentials.valid:
            _vision_credentials.refresh(Request())
        return {"Authorization": f"Bearer {_vision_credentials.token}"}, {}
    return {}, {"key": VISION_API_KEY}


def vision(requests_payload):
    headers, params = vision_auth()
    response = requests.post(
        VISION_URL, params=params, headers=headers, json={"requests": requests_payload}, timeout=60
    )
    response.raise_for_status()
    return response.json().get("responses", [])


def vision_image(image_bytes):
    return {"content": base64.b64encode(image_bytes).decode()}


def to_png_bytes(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def has_alpha(image):
    return image.mode == "RGBA" and image.getextrema()[3][0] < 250


def trim_transparent(image):
    """Skærer gennemsigtig luft væk, så logoets bund flugter med cirklens bund."""
    if image.mode != "RGBA":
        return image
    bbox = image.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    return image.crop(bbox) if bbox and bbox != (0, 0, *image.size) else image


def trim_existing_logos():
    """Engangsoprydning (idempotent): valgte logoer brand-logos/<id>.png uden luft."""
    if not os.path.isdir(LOGO_DIR):
        return
    for name in os.listdir(LOGO_DIR):
        path = os.path.join(LOGO_DIR, name)
        if not name.endswith(".png") or not os.path.isfile(path):
            continue
        try:
            with Image.open(path) as image:
                image.load()
                trimmed = trim_transparent(image.convert("RGBA")) if "A" in image.getbands() else image
            if trimmed.size != image.size:
                trimmed.save(path, format="PNG")
                log.info("beskar %s %s -> %s", name, image.size, trimmed.size)
        except Exception as error:  # et enkelt dårligt billede må ikke stoppe robotten
            log.warning("kunne ikke beskære %s: %s", name, error)


def make_background_transparent(image, tolerance=18):
    """Ensfarvet baggrund (alle fire hjørner ens) gøres transparent."""
    image = image.convert("RGBA")
    if has_alpha(image):
        return trim_transparent(image), True
    w, h = image.size
    corners = [image.getpixel((0, 0)), image.getpixel((w - 1, 0)), image.getpixel((0, h - 1)), image.getpixel((w - 1, h - 1))]
    ref = corners[0]
    if any(max(abs(c[i] - ref[i]) for i in range(3)) > tolerance for c in corners):
        return image, False
    pixels = [
        (r, g, b, 0) if max(abs(r - ref[0]), abs(g - ref[1]), abs(b - ref[2])) <= tolerance else (r, g, b, a)
        for (r, g, b, a) in image.getdata()
    ]
    image.putdata(pixels)
    bbox = image.getbbox()
    return (image.crop(bbox) if bbox else image), True


def visual_similarity(a, b):
    """0..1 ud fra perceptuelle hashes på gråtone mod hvid baggrund."""

    def prep(image):
        flat = Image.new("RGB", image.size, (255, 255, 255))
        rgba = image.convert("RGBA")
        flat.paste(rgba, mask=rgba.split()[3])
        return flat.convert("L")

    pa, pb = prep(a), prep(b)
    distance = (imagehash.phash(pa) - imagehash.phash(pb)) + (imagehash.dhash(pa) - imagehash.dhash(pb))
    return max(0.0, 1.0 - distance / 64.0)


# --- trin 1: isolér logoet ---------------------------------------------------

def fetch_brands_without_logo(conn, limit):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT b.id, b.name, p.id, p."imageUrl"
            FROM brands b
            JOIN LATERAL (
              SELECT id, "imageUrl" FROM products
              WHERE "brandId" = b.id AND "imageUrl" IS NOT NULL AND status <> 'REJECTED'
              ORDER BY "createdAt" DESC LIMIT 1
            ) p ON true
            WHERE b."logoUrl" IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM brand_logo_searches s
                WHERE s."brandId" = b.id
                  AND (s.status = 'PENDING_REVIEW' OR s."createdAt" > now() - interval '30 days')
              )
            ORDER BY b."createdAt" ASC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def isolate_logo(front_bytes, brand_name):
    """Returnerer (udsnit som PIL-billede, Visions logonavn) eller (None, None)."""
    result = vision([{"image": vision_image(front_bytes), "features": [{"type": "LOGO_DETECTION", "maxResults": 5}]}])
    logos = (result[0] if result else {}).get("logoAnnotations", [])
    if not logos:
        return None, None
    wanted = normalize(brand_name)
    logos.sort(key=lambda l: (wanted and wanted in normalize(l.get("description")), l.get("score", 0)), reverse=True)
    logo = logos[0]
    vertices = logo.get("boundingPoly", {}).get("vertices", [])
    xs = [v.get("x", 0) for v in vertices]
    ys = [v.get("y", 0) for v in vertices]
    if not xs or not ys:
        return None, None
    image = Image.open(io.BytesIO(front_bytes)).convert("RGB")
    pad = 6
    box = (max(0, min(xs) - pad), max(0, min(ys) - pad), min(image.width, max(xs) + pad), min(image.height, max(ys) + pad))
    if box[2] - box[0] < 16 or box[3] - box[1] < 16:
        return None, None
    return image.crop(box), logo.get("description")


# --- trin 2+3: søg og vurdér kandidater --------------------------------------

def web_candidates(crop):
    result = vision([
        {
            "image": vision_image(to_png_bytes(crop)),
            "features": [{"type": "WEB_DETECTION", "maxResults": 30}],
        }
    ])
    web = (result[0] if result else {}).get("webDetection", {})
    pages = {}
    for page in web.get("pagesWithMatchingImages", []):
        for image in page.get("fullMatchingImages", []) + page.get("partialMatchingImages", []):
            pages.setdefault(image.get("url"), page)
    seen, out = set(), []
    for kind, weight in (("fullMatchingImages", 1.0), ("partialMatchingImages", 0.85), ("visuallySimilarImages", 0.6)):
        for image in web.get(kind, []):
            url = image.get("url")
            if not url or url in seen or not url.startswith("http"):
                continue
            seen.add(url)
            page = pages.get(url, {})
            out.append({"url": url, "match": weight, "pageUrl": page.get("url"), "pageTitle": page.get("pageTitle")})
    return out


def download(url):
    response = requests.get(url, timeout=15, headers=HEADERS)
    response.raise_for_status()
    image = Image.open(io.BytesIO(response.content))
    image.load()
    return image


def brand_in_page(brand_name, candidate):
    wanted = normalize(brand_name)
    if not wanted:
        return False
    haystack = " ".join(filter(None, [candidate["url"], candidate.get("pageUrl"), candidate.get("pageTitle")]))
    host_path = " ".join(filter(None, [urlparse(candidate["url"]).netloc, urlparse(candidate["url"]).path]))
    return wanted in normalize(haystack) or wanted in normalize(host_path)


def score_candidates(brand_name, logo_name, crop, candidates):
    """Henter op til MAX_CANDIDATES og vurderer dem. Returnerer liste af dicts."""
    downloaded = []
    for candidate in candidates:
        if len(downloaded) >= MAX_CANDIDATES:
            break
        try:
            image = download(candidate["url"])
            if min(image.size) < 64:
                continue
            png, transparent = make_background_transparent(image)
            downloaded.append({**candidate, "image": png, "transparent": transparent})
        except Exception as exc:  # noqa: BLE001 - én dårlig kandidat må ikke stoppe resten
            log.info("kandidat afvist %s (%s)", candidate["url"], exc)

    if not downloaded:
        return []

    # Visions egen logo-genkendelse på alle kandidater i ét kald.
    responses = vision([
        {"image": vision_image(to_png_bytes(c["image"])), "features": [{"type": "LOGO_DETECTION", "maxResults": 3}]}
        for c in downloaded
    ])
    wanted = {normalize(brand_name), normalize(logo_name)} - {""}
    for candidate, response in zip(downloaded, responses):
        logo_score = 0.0
        for logo in response.get("logoAnnotations", []):
            if normalize(logo.get("description")) in wanted:
                logo_score = max(logo_score, float(logo.get("score", 0)))
        candidate["brandInPage"] = brand_in_page(brand_name, candidate)
        candidate["visual"] = visual_similarity(crop, candidate["image"])
        confidence = (
            0.35 * logo_score
            + 0.25 * candidate["match"]
            + 0.25 * candidate["visual"]
            + 0.15 * (1.0 if candidate["brandInPage"] else 0.0)
        )
        # "Uden baggrund, højeste opløsning": lille bonus, aldrig nok alene.
        if candidate["transparent"]:
            confidence += 0.03
        if min(candidate["image"].size) >= 400:
            confidence += 0.02
        candidate["confidence"] = min(1.0, confidence)
    downloaded.sort(key=lambda c: (c["confidence"], c["image"].size[0] * c["image"].size[1]), reverse=True)
    return downloaded


# --- gem -----------------------------------------------------------------------

def save_png(image, relative):
    image = trim_transparent(image)
    path = os.path.join(LOGO_DIR, relative)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    image.save(path, format="PNG")
    return f"{LOGO_PREFIX}/{relative}"


def process_brand(conn, brand_id, brand_name, product_id, image_url):
    front = load_product_image(image_url)
    if not front:
        log.info("intet forsidefoto for %s", brand_name)
        return
    crop, logo_name = isolate_logo(front, brand_name)
    search_id = new_id()
    now = dt.datetime.now(dt.timezone.utc)

    if crop is None:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO brand_logo_searches (id, "brandId", "sourceProductId", "originalUrl", status, "createdAt", "resolvedAt")
                   VALUES (%s, %s, %s, '', 'NO_CANDIDATES', %s, %s)""",
                (search_id, brand_id, product_id, now, now),
            )
        conn.commit()
        log.info("intet logo fundet på forsiden for %s", brand_name)
        return

    original_url = save_png(crop, f"{brand_id}/{search_id}/original.png")
    scored = [c for c in score_candidates(brand_name, logo_name, crop, web_candidates(crop)) if c["confidence"] >= MIN_CONFIDENCE]
    best = scored[0] if scored else None
    auto = bool(best and best["confidence"] >= AUTO_ACCEPT and best["brandInPage"])
    status = "AUTO_ACCEPTED" if auto else ("PENDING_REVIEW" if scored else "NO_CANDIDATES")

    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO brand_logo_searches (id, "brandId", "sourceProductId", "originalUrl", status, "bestConfidence", "createdAt", "resolvedAt")
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (search_id, brand_id, product_id, original_url, status, best["confidence"] if best else None, now,
             now if status != "PENDING_REVIEW" else None),
        )
        for index, candidate in enumerate(scored):
            candidate_id = new_id()
            candidate["id"] = candidate_id
            url = save_png(candidate["image"], f"{brand_id}/{search_id}/{index:02d}.png")
            cur.execute(
                """INSERT INTO brand_logo_candidates
                   (id, "searchId", "imageUrl", "sourceUrl", "pageUrl", "pageTitle", confidence, "brandInPage", transparent, width, height, "createdAt")
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (candidate_id, search_id, url, candidate["url"], candidate.get("pageUrl"), (candidate.get("pageTitle") or "")[:300] or None,
                 candidate["confidence"], candidate["brandInPage"], candidate["transparent"],
                 candidate["image"].size[0], candidate["image"].size[1], now),
            )
        if auto:
            logo_url = save_png(best["image"], f"{brand_id}.png")
            cur.execute('UPDATE brands SET "logoUrl" = %s WHERE id = %s AND "logoUrl" IS NULL', (logo_url, brand_id))
            cur.execute('UPDATE brand_logo_searches SET "chosenCandidateId" = %s WHERE id = %s', (best["id"], search_id))
    conn.commit()
    log.info("%s: %s (bedste %.0f %%)", brand_name, status, (best["confidence"] * 100) if best else 0)


# --- oprydning ------------------------------------------------------------------

def cleanup(conn):
    """Sletter hentede kandidater (fil + række) 7 dage efter afgørelsen.
    Det valgte logo er allerede kopieret til brand-logos/<brandId>.png."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT s.id, s."brandId" FROM brand_logo_searches s
               WHERE s."resolvedAt" IS NOT NULL AND s."resolvedAt" < now() - (%s || ' days')::interval
                 AND EXISTS (SELECT 1 FROM brand_logo_candidates c WHERE c."searchId" = s.id)""",
            (str(RETENTION_DAYS),),
        )
        for search_id, brand_id in cur.fetchall():
            folder = os.path.join(LOGO_DIR, brand_id, search_id)
            original = os.path.join(folder, "original.png")
            for name in os.listdir(folder) if os.path.isdir(folder) else []:
                path = os.path.join(folder, name)
                if path != original:
                    os.remove(path)
            cur.execute('DELETE FROM brand_logo_candidates WHERE "searchId" = %s', (search_id,))
            log.info("ryddet kandidater for søgning %s", search_id)
    conn.commit()


def run_once(conn):
    trim_existing_logos()
    # Logoer uden brand-match ved start venter i _import, til brandet findes.
    try:
        import_logos.main(dry_run=False)
    except Exception:  # noqa: BLE001 - importen må ikke stoppe natkørslen
        log.exception("import af egne logoer fejlede")
    # Fejlen skal kunne ses på admin "Robotter", så den kastes i stedet for
    # kun at blive logget.
    if not VISION_CREDENTIALS_FILE and not VISION_API_KEY:
        raise RuntimeError("GOOGLE_VISION_CREDENTIALS (eller GOOGLE_VISION_API_KEY/GOOGLE_API_KEY) mangler")
    if VISION_CREDENTIALS_FILE and not os.path.exists(VISION_CREDENTIALS_FILE):
        raise RuntimeError(f"GOOGLE_VISION_CREDENTIALS peger på en fil, der ikke findes ({VISION_CREDENTIALS_FILE})")
    cleanup(conn)
    brands = fetch_brands_without_logo(conn, BATCH_SIZE)
    if not brands:
        return "Ingen brands uden logo", 0
    done = 0
    for brand_id, brand_name, product_id, image_url in brands:
        try:
            process_brand(conn, brand_id, brand_name, product_id, image_url)
            done += 1
        except Exception:  # noqa: BLE001 - ét brand må ikke stoppe kørslen
            conn.rollback()
            log.exception("fejl for brand %s", brand_name)
    # (besked, antal udført) til admin "Robotter"/"Nattens kørsler".
    return f"{done} brands gennemgået", done


def main():
    os.makedirs(LOGO_DIR, exist_ok=True)
    # Egne logoer lagt i brand-logos/_import sættes på deres brands ved hver
    # start (import_logos.py, docs/LOGO-AGENT.md). Uden filer er det et no-op.
    try:
        import_logos.main(dry_run=False)
    except Exception:  # noqa: BLE001 - importen må ikke stoppe robotten
        log.exception("import af egne logoer fejlede")
    # Planen styres fra admin "Robotter"/"Cron-jobs" (job_control.py);
    # LOGO_AGENT_RUN_HOUR er kun standard-tidspunktet, når rækken oprettes.
    log.info("logo-robot startet; standard hver nat kl. %02d:00 (%s)", RUN_HOUR, TIMEZONE)
    run_forever(DATABASE_URL, "logo-agent", run_once, run_at_time=f"{RUN_HOUR:02d}:00", run_on_start=RUN_ON_START)


if __name__ == "__main__":
    main()
