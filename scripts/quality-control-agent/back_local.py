"""
Lokal læsning af de ubeskårne bagsidebilleder (docs/DECISIONS.md 2026-10-15,
brugerens regel: OCR først, intern AI før OpenAI).

Før nattens analyse ("back-photo-scan", src/lib/product-back-photos.ts) læses
hvert bagsidebillede her — 100% lokalt, CPU-only:

- mærker og certifikater med samme logo- og tekstsøgning som forsiden
  (label_local.scan_photo);
- al tekst med tesseract (dansk/tysk/engelsk) i fuld opløsning, med
  sikkerheden pr. ord, så nattens stavekontrol ved, hvilke ord der er usikre.

Resultatet gemmes i product_back_photos.localResult. Nattens analyse bruger
det og spørger kun OpenAI om billedet, når intet mærke blev fundet lokalt;
ordbogen afgør stavningen, og kun ord, den er i tvivl om, går til AI.
"""

import logging

import psycopg2.extras
import pytesseract

import label_local

log = logging.getLogger("back-local")

BATCH_SIZE = 10
OCR_MAX_SIDE = 3000
# Ord læst med mindre sikkerhed end dette (tesseract 0-100) er usikre.
DOUBT_CONFIDENCE = 70


def fetch_pending(conn, limit):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, "imageUrl" FROM product_back_photos
            WHERE "localScannedAt" IS NULL AND "analyzedAt" IS NULL
            ORDER BY "createdAt" ASC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def read_text(image):
    """Teksten linje for linje + middelsikkerhed + usikre ord."""
    gray = label_local._to_gray(image, OCR_MAX_SIDE)
    data = pytesseract.image_to_data(gray, lang="dan+deu+eng", output_type=pytesseract.Output.DICT)
    lines = {}
    confidences = []
    doubtful = []
    for i, word in enumerate(data["text"]):
        word = word.strip()
        if not word:
            continue
        confidence = float(data["conf"][i])
        if confidence < 0:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        lines.setdefault(key, []).append(word)
        confidences.append(confidence)
        if confidence < DOUBT_CONFIDENCE and any(ch.isalpha() for ch in word):
            doubtful.append({"word": word, "confidence": round(confidence, 1)})
    text = "\n".join(" ".join(words) for _, words in sorted(lines.items()))
    mean = round(sum(confidences) / len(confidences), 1) if confidences else 0.0
    return text, mean, doubtful[:200]


def save(conn, photo_id, result):
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE product_back_photos SET "localResult" = %s, "localScannedAt" = now() WHERE id = %s',
            (psycopg2.extras.Json(result), photo_id),
        )
    conn.commit()


def run_once(conn):
    photos = fetch_pending(conn, BATCH_SIZE)
    if not photos:
        return "Ingen bagsidebilleder at læse", 0
    templates = label_local.get_templates(conn)
    done = 0
    for photo_id, image_url in photos:
        try:
            image = label_local.load_image(image_url)
            labels = label_local.scan_photo(image, templates)
            text, confidence, doubtful = read_text(image)
            save(conn, photo_id, {"labels": labels, "text": text, "confidence": confidence, "doubtfulWords": doubtful})
            done += 1
        except Exception as exc:  # noqa: BLE001 - et dårligt billede må ikke stoppe resten
            conn.rollback()
            log.exception("bagsidebillede %s kunne ikke læses", photo_id)
            # Markeres som læst uden resultat, så nattens analyse bruger OpenAI.
            save(conn, photo_id, {"labels": [], "text": "", "confidence": 0, "doubtfulWords": [], "error": str(exc)[:300]})
    return f"{done} bagsidebilleder læst lokalt", done
