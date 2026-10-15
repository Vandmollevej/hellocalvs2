"""
Sprogrobotten (docs/DECISIONS.md 2026-10-15, brugerens valg: "Sprogrobot").

Varens sprog (products.language) sættes ud fra kilden (src/lib/product-language.ts):
scanningsland, Open Food Facts' sprogfelt eller stregkodens land. For scannede
varer og Open Food Facts/USDA-varer er det et gæt — en tysk vare kan være
scannet i Danmark. Robotten læser teksten (navn, variant og ingredienser) med
lingua, lokalt og uden OpenAI, og retter sproget, når den er sikker.

Røres aldrig: ark, Frida, butiksimporter og opskriftssider (deres sprog er
kildens, fx dansk, også ved franske ostenavne), varer med ikke-latinske tegn
(skriften afgør sproget), korte tekster og dansk/norsk/svensk indbyrdes
(for tæt på hinanden). Hver vare tjekkes én gang (languageCheckedAt); ændres
varens tekst, sætter appen ikke tjekket tilbage — robotten er kun et værn.
"""

import logging

from lingua import Language, LanguageDetectorBuilder

log = logging.getLogger("language-local")

BATCH_SIZE = 200
MIN_TEXT_LENGTH = 25
MIN_CONFIDENCE = 0.85
SCRIPT_LANGUAGES = {"zh", "ja", "ko", "ru", "uk", "el", "he", "ar", "th", "hi", "und"}
SCANDINAVIAN = {"da", "no", "sv"}

LANGUAGES = [
    Language.DANISH, Language.SWEDISH, Language.BOKMAL, Language.NYNORSK, Language.GERMAN,
    Language.DUTCH, Language.FRENCH, Language.ITALIAN, Language.SPANISH, Language.ENGLISH,
    Language.POLISH, Language.PORTUGUESE, Language.TURKISH, Language.CZECH, Language.HUNGARIAN,
    Language.ROMANIAN, Language.FINNISH, Language.LITHUANIAN, Language.CROATIAN, Language.GREEK,
    Language.RUSSIAN, Language.UKRAINIAN, Language.CHINESE, Language.JAPANESE, Language.KOREAN,
    Language.THAI, Language.VIETNAMESE, Language.ARABIC, Language.HEBREW, Language.HINDI,
]

_detector = None


def detector():
    global _detector
    if _detector is None:
        # Lav-præcisionstilstand: ~100 MB; korte tekster springes alligevel over.
        _detector = LanguageDetectorBuilder.from_languages(*LANGUAGES).with_low_accuracy_mode().build()
    return _detector


def detect(text):
    """(sprogkode, sikkerhed) eller (None, 0)."""
    values = detector().compute_language_confidence_values(text)
    if not values:
        return None, 0.0
    best = values[0]
    code = best.language.iso_code_639_1.name.lower()
    if code in ("nb", "nn"):
        code = "no"
    return code, float(best.value)


def decide(current, detected, confidence, text_length):
    """Det nye sprog, eller None når varens sprog skal blive."""
    if not detected or detected == current:
        return None
    if current in SCRIPT_LANGUAGES:
        return None
    if text_length < MIN_TEXT_LENGTH or confidence < MIN_CONFIDENCE:
        return None
    if current in SCANDINAVIAN and detected in SCANDINAVIAN:
        return None
    return detected


def fetch_pending(conn, limit):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, language, concat_ws('. ', name, variant, "ingredientsText")
            FROM products
            WHERE "languageCheckedAt" IS NULL
              AND "deletedAt" IS NULL
              AND language IS NOT NULL
              AND NOT ('name' = ANY("pendingFields"))
              AND (("externalSource" IS NULL AND "createdByUserId" IS NOT NULL)
                   OR "externalSource"::text IN ('OPEN_FOOD_FACTS', 'USDA'))
            ORDER BY "createdAt" DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def run_once(conn):
    rows = fetch_pending(conn, BATCH_SIZE)
    if not rows:
        return "Ingen varer at tjekke", 0
    changed = 0
    for product_id, current, text in rows:
        text = (text or "").strip()
        new_language = None
        try:
            detected, confidence = detect(text) if len(text) >= MIN_TEXT_LENGTH else (None, 0.0)
            new_language = decide(current or None, detected, confidence, len(text))
        except Exception:  # noqa: BLE001 - én vare må ikke stoppe resten
            log.exception("sprog for %s kunne ikke afgøres", product_id)
        with conn.cursor() as cur:
            if new_language:
                cur.execute(
                    'UPDATE products SET language = %s, "languageCheckedAt" = now() WHERE id = %s',
                    (new_language, product_id),
                )
                changed += 1
                log.info("vare %s: sprog %s -> %s", product_id, current, new_language)
            else:
                cur.execute('UPDATE products SET "languageCheckedAt" = now() WHERE id = %s', (product_id,))
        conn.commit()
    return f"{len(rows)} varer tjekket, {changed} fik nyt sprog", changed
