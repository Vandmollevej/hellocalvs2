"""
Lokal mærkesøgning (docs/DECISIONS.md 2026-10-15, brugerens regel: intern AI
først, OpenAI kun hvis intet findes).

Forsidefotoet af hver vare, der venter på det natlige mærkat-job ("label-scan",
src/lib/product-label-scan.ts), søges igennem her — 100% lokalt, CPU-only:

1. Logoer: OpenCV SIFT + RANSAC-homografi mod kendte mærker — logofilerne i
   public/certifications (hentes fra app-containeren) og mærker, som tidligere
   er fritskrabet fra rigtige emballager (product_labels.imageUrl).
2. Mærketekster: tesseract (dansk/tysk/engelsk) for faste tekster, der står i
   selve mærket (fx "Statskontrolleret økologisk" i Ø-mærket, "Laktosefri").

Fundene gemmes i label_photo_scans (samme form som AI'ens fund). Mærkat-jobbet
bruger dem og spørger kun OpenAI om fotos uden lokale fund. Kun sikre fund
gemmes, så et mærke aldrig vises på en vare, hvor det ikke står.
"""

import io
import json
import logging
import os
import time

import cv2
import numpy as np
import psycopg2.extras
import pytesseract
import requests
from PIL import Image

log = logging.getLogger("label-local")

IMAGES_DIR = os.environ.get("PRODUCT_IMAGES_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/product-images")
# Logofilerne i public/certifications serveres af app-containeren (backend-netværket).
APP_INTERNAL_URL = os.environ.get("APP_INTERNAL_URL", "http://app:3000").rstrip("/")
LABEL_BATCH_SIZE = int(os.environ.get("LABEL_BATCH_SIZE", "20"))

PHOTO_MAX_SIDE = 2048
TEMPLATE_MAX_SIDE = 320
MIN_TEMPLATE_KEYPOINTS = 15
RATIO = 0.75
MIN_INLIERS = 15
CUTOUTS_PER_KEY = 3
OCR_CONFIDENCE = 0.85
# Farve-søgningen (flade logoer): nuance-tolerance, mindste område i pixels og
# mindste lighed (NCC) mellem forslaget og logoet.
HUE_TOLERANCE = 10
MIN_COLOR_AREA = 400
MIN_COLOR_NCC = 0.8

# public/certifications → kendt nøgle (samme nøgler/navne som KNOWN_LABEL_KEYS
# i src/lib/product-label-ai.ts). Mærker, der kun er en del af en skala eller
# en bestemt vare (Haltungsform, Grana Padano), er udeladt.
LOGO_FILES = {
    "oekologimaerket.png": ("organic-dk", "Ø-mærket", "ORGANIC"),
    "eu-oekologi.png": ("organic-eu", "EU-økologi", "ORGANIC"),
    "bio-tyskland.png": ("organic-de", "Bio-Siegel", "ORGANIC"),
    "krav.png": ("organic-krav", "KRAV", "ORGANIC"),
    "bioland.png": ("bioland", "Bioland", "ORGANIC"),
    "naturland.png": ("naturland", "Naturland", "ORGANIC"),
    "oekologischer-landbau.png": ("oekologischer-landbau", "Ökologischer Landbau", "ORGANIC"),
    "noeglehul.png": ("keyhole", "Nøglehulsmærket", "HEALTH"),
    "fuldkorn.png": ("whole-grain", "Fuldkornsmærket", "HEALTH"),
    "bedre-dyrevelfaerd-1.png": ("bedre-dyrevelfaerd-1", "Bedre Dyrevelfærd 1 hjerte", "ANIMAL_WELFARE"),
    "bedre-dyrevelfaerd-2.png": ("bedre-dyrevelfaerd-2", "Bedre Dyrevelfærd 2 hjerter", "ANIMAL_WELFARE"),
    "bedre-dyrevelfaerd-3.png": ("bedre-dyrevelfaerd-3", "Bedre Dyrevelfærd 3 hjerter", "ANIMAL_WELFARE"),
    "dyrenes-beskyttelse.png": ("dyrenes-beskyttelse", "Anbefalet af Dyrenes Beskyttelse", "ANIMAL_WELFARE"),
    "tierwohl.png": ("tierwohl", "Initiative Tierwohl", "ANIMAL_WELFARE"),
    "eier-ohne-kuekentoeten.png": ("ohne-kuekentoeten", "Ohne Kükentöten", "ANIMAL_WELFARE"),
    "msc.png": ("msc", "MSC", "SUSTAINABILITY"),
    "asc.png": ("asc", "ASC", "SUSTAINABILITY"),
    "fairtrade.png": ("fairtrade", "Fairtrade", "SUSTAINABILITY"),
    "rainforest-alliance.png": ("rainforest-alliance", "Rainforest Alliance", "SUSTAINABILITY"),
    "utz.png": ("utz", "UTZ", "SUSTAINABILITY"),
    "naturskaansom.png": ("naturskaansom", "NaturSkånsom", "SUSTAINABILITY"),
    "glutenfri.png": ("gluten-free", "Glutenfri", "DIET"),
    "vegan.png": ("vegan", "Vegansk", "DIET"),
    "vegansk.png": ("vegan", "Vegansk", "DIET"),
    "v-label.png": ("v-label", "V-Label", "DIET"),
    "dlg.png": ("dlg", "DLG-prämiert", "QUALITY"),
    "pgi.png": ("pgi", "Beskyttet geografisk betegnelse", "QUALITY"),
    "dansk-maelk.png": ("dansk-maelk", "Dansk Mælk", "ORIGIN"),
    "heimischer-anbau.png": ("heimischer-anbau", "Heimischer Anbau", "ORIGIN"),
}

# Mærker i samme skala ligner hinanden (1/2/3 hjerter): kun det bedste fund tæller.
EXCLUSIVE_GROUPS = ("bedre-dyrevelfaerd-",)

# Faste tekster, der står i selve mærket — ikke ord, der også optræder i en
# ingrediensliste (fx "økologisk" eller "fuldkorn" alene).
TEXT_MARKS = [
    ("statskontrolleret økologisk", ("organic-dk", "Ø-mærket", "ORGANIC")),
    ("laktosefri", ("lactose-free", "Laktosefri", "DIET")),
    ("laktosefrei", ("lactose-free", "Laktosefri", "DIET")),
    ("lactose free", ("lactose-free", "Laktosefri", "DIET")),
    ("lactose-free", ("lactose-free", "Laktosefri", "DIET")),
    ("glutenfri", ("gluten-free", "Glutenfri", "DIET")),
    ("glutenfrei", ("gluten-free", "Glutenfri", "DIET")),
    ("gluten free", ("gluten-free", "Glutenfri", "DIET")),
    ("ohne gentechnik", ("ohne-gentechnik", "Ohne Gentechnik", "QUALITY")),
    ("anbefalet af dyrenes beskyttelse", ("dyrenes-beskyttelse", "Anbefalet af Dyrenes Beskyttelse", "ANIMAL_WELFARE")),
]

_sift = cv2.SIFT_create(nfeatures=4000)
_matcher = cv2.BFMatcher(cv2.NORM_L2)
_templates = None
_templates_loaded_at = 0.0
# Nye fritskrabede mærker tages med, når skabelonerne indlæses igen.
TEMPLATE_RELOAD_SECONDS = 6 * 60 * 60


def _to_gray(image, max_side):
    """PIL → gråtone-array; transparente pixels (fritskrabede mærker) bliver hvide."""
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        image = Image.alpha_composite(background, rgba)
    image = image.convert("L")
    scale = min(1.0, max_side / max(image.size))
    if scale < 1.0:
        image = image.resize((max(1, int(image.width * scale)), max(1, int(image.height * scale))), Image.LANCZOS)
    return np.array(image)


def load_image(public_url):
    if public_url.startswith(PUBLIC_PATH_PREFIX):
        local_path = os.path.join(IMAGES_DIR, public_url[len(PUBLIC_PATH_PREFIX) :].lstrip("/"))
        with open(local_path, "rb") as handle:
            return Image.open(io.BytesIO(handle.read()))
    if public_url.startswith("/"):
        response = requests.get(APP_INTERNAL_URL + public_url, timeout=15)
    else:
        response = requests.get(public_url, timeout=15)
    response.raise_for_status()
    return Image.open(io.BytesIO(response.content))


def _to_bgr(image, max_side):
    """PIL → BGR-array; transparente pixels bliver hvide."""
    rgba = image.convert("RGBA")
    background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    rgb = Image.alpha_composite(background, rgba).convert("RGB")
    scale = min(1.0, max_side / max(rgb.size))
    if scale < 1.0:
        rgb = rgb.resize((max(1, int(rgb.width * scale)), max(1, int(rgb.height * scale))), Image.LANCZOS)
    return cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)


def _color_profile(bgr):
    """Logoets dominerende, mættede farve og det område, den dækker — til
    farve-søgningen efter flade logoer (EU-bladet, nøglehullet), som har for
    få SIFT-punkter. None, hvis logoet ikke har én tydelig farve."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    ink = (hsv[:, :, 1] > 70) & (hsv[:, :, 2] > 60)
    if ink.mean() < 0.15:
        return None
    hues = hsv[:, :, 0][ink].astype(np.int32)
    histogram = np.bincount(hues, minlength=180)
    # Cirkulær udglatning: rød ligger både ved 0 og 179.
    smooth = sum(np.roll(histogram, shift) for shift in range(-6, 7))
    hue = int(np.argmax(smooth))
    mask = _hue_mask(hsv, hue)
    if mask.mean() < 0.12:
        return None
    ys, xs = np.nonzero(mask)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    return {"hue": hue, "box": box, "fill": float(mask[box[1] : box[3], box[0] : box[2]].mean())}


def _hue_mask(hsv, hue):
    diff = np.abs(hsv[:, :, 0].astype(np.int32) - hue)
    diff = np.minimum(diff, 180 - diff)
    return (diff <= HUE_TOLERANCE) & (hsv[:, :, 1] > 60) & (hsv[:, :, 2] > 45)


def _template(key, name, category, image):
    gray = _to_gray(image, TEMPLATE_MAX_SIDE)
    bgr = _to_bgr(image, TEMPLATE_MAX_SIDE)
    keypoints, descriptors = _sift.detectAndCompute(gray, None)
    color = _color_profile(bgr)
    if (descriptors is None or len(keypoints) < MIN_TEMPLATE_KEYPOINTS) and color is None:
        return None
    return {
        "key": key,
        "name": name,
        "category": category,
        "shape": gray.shape,
        "kp": keypoints,
        "des": descriptors if descriptors is not None and len(keypoints) >= MIN_TEMPLATE_KEYPOINTS else None,
        "gray": gray,
        "color": color,
    }


def load_templates(conn):
    templates = []
    for filename, (key, name, category) in LOGO_FILES.items():
        try:
            template = _template(key, name, category, load_image(f"/certifications/{filename}"))
        except Exception:  # noqa: BLE001 - et manglende logo må ikke stoppe resten
            log.warning("logo %s kunne ikke hentes", filename)
            continue
        if template:
            templates.append(template)
    # Mærker fritskrabet fra rigtige emballager (sikre AI-fund) — højst
    # CUTOUTS_PER_KEY pr. mærke, nyeste først.
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT key, name, category::text, "imageUrl"
            FROM product_labels
            WHERE "imageUrl" IS NOT NULL AND confidence >= 0.8
            ORDER BY "createdAt" DESC
            LIMIT 500
            """
        )
        rows = cur.fetchall()
    per_key = {}
    for key, name, category, image_url in rows:
        if per_key.get(key, 0) >= CUTOUTS_PER_KEY:
            continue
        try:
            template = _template(key, name, category, load_image(image_url))
        except Exception:  # noqa: BLE001
            continue
        if template:
            templates.append(template)
            per_key[key] = per_key.get(key, 0) + 1
    log.info("%d mærke-skabeloner indlæst", len(templates))
    return templates


def _match_template(template, photo_kp, photo_des, photo_shape):
    if template["des"] is None:
        return None
    pairs = _matcher.knnMatch(template["des"], photo_des, k=2)
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < RATIO * n.distance]
    if len(good) < MIN_INLIERS:
        return None
    src = np.float32([template["kp"][m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst = np.float32([photo_kp[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    homography, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
    if homography is None or mask is None:
        return None
    inliers = int(mask.sum())
    if inliers < MIN_INLIERS:
        return None
    th, tw = template["shape"]
    corners = cv2.perspectiveTransform(np.float32([[0, 0], [tw, 0], [tw, th], [0, th]]).reshape(-1, 1, 2), homography).reshape(-1, 2)
    if not cv2.isContourConvex(corners.astype(np.float32)):
        return None
    ph, pw = photo_shape
    x0, y0 = corners.min(axis=0)
    x1, y1 = corners.max(axis=0)
    x0, y0, x1, y1 = max(0.0, x0), max(0.0, y0), min(float(pw), x1), min(float(ph), y1)
    width, height = x1 - x0, y1 - y0
    if width <= 0 or height <= 0:
        return None
    area = (width * height) / (pw * ph)
    if area < 0.0005 or area > 0.5:
        return None
    # Et logo bliver ikke strakt mere end 3x i én retning af et skævt foto.
    aspect = (width / height) / (tw / th)
    if aspect > 3 or aspect < 1 / 3:
        return None
    confidence = round(min(0.95, 0.8 + (inliers - MIN_INLIERS) / 200), 3)
    return {
        "key": template["key"],
        "name": template["name"],
        "text": None,
        "category": template["category"],
        "box": {"x": x0 / pw, "y": y0 / ph, "width": width / pw, "height": height / ph},
        "confidence": confidence,
        "inliers": inliers,
    }


def find_logos(gray, templates):
    keypoints, descriptors = _sift.detectAndCompute(gray, None)
    if descriptors is None or len(keypoints) < MIN_INLIERS:
        return []
    found = {}
    for template in templates:
        hit = _match_template(template, keypoints, descriptors, gray.shape)
        if hit and (hit["key"] not in found or hit["inliers"] > found[hit["key"]]["inliers"]):
            found[hit["key"]] = hit
    for prefix in EXCLUSIVE_GROUPS:
        group = [hit for key, hit in found.items() if key.startswith(prefix)]
        if len(group) > 1:
            best = max(group, key=lambda hit: hit["inliers"])
            for hit in group:
                if hit is not best:
                    found.pop(hit["key"], None)
    return list(found.values())


def _ncc(a, b):
    a = a.astype(np.float32) - a.mean()
    b = b.astype(np.float32) - b.mean()
    denominator = float(np.sqrt((a * a).sum() * (b * b).sum()))
    return float((a * b).sum() / denominator) if denominator else 0.0


def find_color_logos(bgr, gray, templates):
    """Flade logoer: områder i logoets farve og form (forhold mellem bredde og
    højde) foreslås, og hvert forslag sammenlignes med logoet (NCC)."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    ph, pw = gray.shape
    masks = {}
    found = {}
    for template in templates:
        color = template["color"]
        if color is None:
            continue
        hue = color["hue"]
        if hue not in masks:
            mask = _hue_mask(hsv, hue).astype(np.uint8) * 255
            masks[hue] = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        bx0, by0, bx1, by1 = color["box"]
        bw, bh = bx1 - bx0, by1 - by0
        th, tw = template["shape"]
        contours, _ = cv2.findContours(masks[hue], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w * h < MIN_COLOR_AREA:
                continue
            ratio = (w / h) / (bw / bh)
            if ratio > 1.3 or ratio < 1 / 1.3:
                continue
            # Farveområdet → hele logoets boks.
            scale_x, scale_y = w / bw, h / bh
            x0 = int(round(x - bx0 * scale_x))
            y0 = int(round(y - by0 * scale_y))
            x1 = int(round(x0 + tw * scale_x))
            y1 = int(round(y0 + th * scale_y))
            if x0 < 0 or y0 < 0 or x1 > pw or y1 > ph:
                continue
            crop = cv2.resize(gray[y0:y1, x0:x1], (tw, th), interpolation=cv2.INTER_AREA)
            blur = max(0.8, tw / max(8.0, float(x1 - x0)))
            score = _ncc(cv2.GaussianBlur(crop, (0, 0), 1.0), cv2.GaussianBlur(template["gray"], (0, 0), blur))
            if score < MIN_COLOR_NCC:
                continue
            hit = found.get(template["key"])
            if hit and hit["score"] >= score:
                continue
            found[template["key"]] = {
                "key": template["key"],
                "name": template["name"],
                "text": None,
                "category": template["category"],
                "box": {"x": x0 / pw, "y": y0 / ph, "width": (x1 - x0) / pw, "height": (y1 - y0) / ph},
                "confidence": round(min(0.95, 0.8 + (score - MIN_COLOR_NCC)), 3),
                "score": score,
            }
    return list(found.values())


def find_text_marks(gray):
    data = pytesseract.image_to_data(gray, lang="dan+deu+eng", output_type=pytesseract.Output.DICT)
    words = []
    for i, text in enumerate(data["text"]):
        word = "".join(ch for ch in text.lower() if ch.isalnum() or ch in "-æøåäöü")
        if word:
            words.append((word, data["left"][i], data["top"][i], data["width"][i], data["height"][i]))
    height, width = gray.shape
    found = {}
    for phrase, (key, name, category) in TEXT_MARKS:
        parts = phrase.split(" ")
        for start in range(len(words) - len(parts) + 1):
            window = words[start : start + len(parts)]
            if [w[0] for w in window] != parts or key in found:
                continue
            x0 = min(w[1] for w in window)
            y0 = min(w[2] for w in window)
            x1 = max(w[1] + w[3] for w in window)
            y1 = max(w[2] + w[4] for w in window)
            found[key] = {
                "key": key,
                "name": name,
                "text": " ".join(parts),
                "category": category,
                "box": {"x": x0 / width, "y": y0 / height, "width": (x1 - x0) / width, "height": (y1 - y0) / height},
                "confidence": OCR_CONFIDENCE,
            }
    return list(found.values())


def scan_photo(image, templates):
    gray = _to_gray(image, PHOTO_MAX_SIDE)
    labels = {hit["key"]: hit for hit in find_logos(gray, templates)}
    for hit in find_color_logos(_to_bgr(image, PHOTO_MAX_SIDE), gray, templates):
        labels.setdefault(hit["key"], hit)
    for hit in find_text_marks(gray):
        labels.setdefault(hit["key"], hit)
    for hit in labels.values():
        hit.pop("inliers", None)
        hit.pop("score", None)
    return list(labels.values())


def fetch_pending_photos(conn, limit):
    """Forsidefotoet af varer, der venter på mærkat-jobbet (nyeste varer
    først, som jobbet), og som ikke er søgt igennem lokalt endnu. Samme valg
    af foto som jobbet (pickSource i src/lib/product-label-scan.ts): det
    nyeste forsidefoto fra kamera-flowet, ellers varens billede."""
    with conn.cursor() as cur:
        cur.execute(
            """
            WITH candidates AS (
                SELECT p.id,
                       COALESCE(
                           (SELECT a.image_url FROM ai_product_analyses a
                            WHERE a.product_id = p.id AND a.kind = 'FRONT' AND a.image_url IS NOT NULL
                            ORDER BY a.created_at DESC LIMIT 1),
                           p."imageUrl",
                           p."pendingImageUrl"
                       ) AS url,
                       p."createdAt"
                FROM products p
                WHERE p."labelsScannedAt" IS NULL AND p."privateOwnerId" IS NULL
                ORDER BY p."createdAt" DESC
                LIMIT 300
            )
            SELECT c.id, c.url
            FROM candidates c
            LEFT JOIN label_photo_scans s ON s.product_id = c.id AND s.url = c.url
            WHERE c.url IS NOT NULL AND s.id IS NULL
            ORDER BY c."createdAt" DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def save_scan(conn, product_id, url, labels, failed):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO label_photo_scans (id, product_id, url, labels, failed)
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s)
            ON CONFLICT (product_id, url) DO NOTHING
            """,
            (product_id, url, psycopg2.extras.Json(labels), failed),
        )
    conn.commit()


def run_once(conn):
    global _templates, _templates_loaded_at
    photos = fetch_pending_photos(conn, LABEL_BATCH_SIZE)
    if not photos:
        return "Ingen fotos at søge igennem", 0
    if _templates is None or time.time() - _templates_loaded_at > TEMPLATE_RELOAD_SECONDS:
        _templates = load_templates(conn)
        _templates_loaded_at = time.time()
    done = 0
    found = 0
    for product_id, url in photos:
        try:
            labels = scan_photo(load_image(url), _templates)
            save_scan(conn, product_id, url, labels, False)
            found += len(labels)
            done += 1
            if labels:
                log.info("product %s: %s", product_id, ", ".join(sorted(label["key"] for label in labels)))
        except Exception:  # noqa: BLE001 - et dårligt foto må ikke stoppe resten
            conn.rollback()
            log.exception("photo %s (product %s) could not be scanned", url, product_id)
            save_scan(conn, product_id, url, [], True)
    return f"{done} fotos søgt igennem lokalt, {found} mærker fundet", done


if __name__ == "__main__":
    # Hurtig manuel test: python label_local.py foto.jpg
    import sys

    logging.basicConfig(level=logging.INFO)
    templates = []
    for filename, (key, name, category) in LOGO_FILES.items():
        path = os.path.join(os.environ.get("LOGO_DIR", "logos"), filename)
        if os.path.exists(path):
            template = _template(key, name, category, Image.open(path))
            if template:
                templates.append(template)
    print(json.dumps(scan_photo(Image.open(sys.argv[1]), templates), ensure_ascii=False, indent=2))
