"""
Importér håndlavede brand-logoer (docs/LOGO-AGENT.md, "Manuel import").

Brugeren lægger logofiler (<brandnavn>.png/.webp/.jpg) i
<IMAGES_DIR>/brand-logos/_import. Scriptet:

1. matcher filnavnet mod `brands.name` (æ/ø/å, store/små bogstaver og tegnsætning
   ignoreres),
2. skalerer ned til højst 640 px på den lange led, gør en ensfarvet/skakbræt-
   baggrund transparent (kun hvis billedet ikke allerede er gennemsigtigt) og
   beskærer gennemsigtig luft væk,
3. gemmer resultatet som brand-logos/<brandId>.png og sætter Brand.logoUrl,
4. flytter den behandlede fil til _import/done.

Filer med suffiks _2, _3 … ("Choco Bella_2.png") er alternative udgaver af det
samme brand; kun den uden suffiks bruges, resten ligger uberørt som alternativer.
Filer uden match ændres ikke — scriptet skriver de nærmeste brandnavne, så
filen kan omdøbes og scriptet køres igen (idempotent).

Kør i containeren:  python import_logos.py [--dry-run]
"""

import difflib
import logging
import os
import re
import shutil
import sys
import time
import unicodedata

from PIL import Image, ImageDraw

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("import-logos")

IMAGES_DIR = os.environ.get("IMAGE_OUTPUT_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/product-images")
LOGO_DIR = os.path.join(IMAGES_DIR, "brand-logos")
LOGO_PREFIX = f"{PUBLIC_PATH_PREFIX}/brand-logos"
IMPORT_DIR = os.path.join(LOGO_DIR, "_import")
DONE_DIR = os.path.join(IMPORT_DIR, "done")
MAX_SIDE = 640
EXTENSIONS = {".png", ".webp", ".jpg", ".jpeg"}

# Filnavne, der ikke er brandnavnet (hentet fra billedsøgning).
ALIASES = {
    "png-transparent-meica-edewecht-bockwurst-sausage-german-cuisine-sausage-love-food-text": "Meica",
}


def normalize(text):
    text = (text or "").lower().replace("æ", "ae").replace("ø", "oe").replace("å", "aa")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", text)


# Samme som agent.py — kopieret, så scriptet kan køres uden agentens afhængigheder.
def has_alpha(image):
    return image.mode == "RGBA" and image.getextrema()[3][0] < 250


def trim_transparent(image):
    if image.mode != "RGBA":
        return image
    bbox = image.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    return image.crop(bbox) if bbox and bbox != (0, 0, *image.size) else image


def color_diff(a, b):
    return sum(abs(a[i] - b[i]) for i in range(3))


def clear_edge_background(image, thresh=100):
    """Uigennemsigtigt billede med ensfarvet (eller bagt-ind skakbrætmønster)
    baggrund: baggrunden gøres transparent ved at fylde ind fra kanten, så hvide
    flader inde i selve logoet beholdes."""
    rgb = image.convert("RGB")
    w, h = rgb.size
    corners = [rgb.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    ref = corners[0]
    if any(color_diff(c, ref) > thresh for c in corners):
        return image
    marker = (254, 0, 254)
    seeds = (
        [(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)]
        + [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)]
    )
    for seed in seeds:
        pixel = rgb.getpixel(seed)
        if pixel != marker and color_diff(pixel, ref) <= thresh:
            ImageDraw.floodfill(rgb, seed, marker, thresh=thresh)
    # Bagt-ind skakbræt (hvid + lysegrå): rester inde i bogstavernes huller
    # hænger ikke sammen med kanten. Den lysegrå firkantfarve findes ellers ikke
    # i logoet, så alle pixels med den farve bruges også som startpunkt.
    grey = next((c for c in corners if 8 < color_diff(c, ref) <= thresh), None)
    if grey:
        for index, pixel in enumerate(list(rgb.getdata())):
            if color_diff(pixel, grey) <= 4 and rgb.getpixel((index % w, index // w)) != marker:
                ImageDraw.floodfill(rgb, (index % w, index // w), marker, thresh=thresh)
    mask = Image.new("L", image.size)
    mask.putdata([0 if pixel == marker else 255 for pixel in rgb.getdata()])
    image = image.copy()
    image.putalpha(mask)
    return image


def process_image(path):
    with Image.open(path) as source:
        source.load()
        image = source.convert("RGBA")
    if max(image.size) > MAX_SIDE:
        scale = MAX_SIDE / max(image.size)
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    if not has_alpha(image):
        image = clear_edge_background(image)
    return trim_transparent(image)


def brand_name_for(filename):
    """(brandnavn, er_alternativ) ud fra filnavnet."""
    stem = os.path.splitext(filename)[0]
    if stem in ALIASES:
        return ALIASES[stem], False
    alternative = re.search(r"_\d+$", stem) is not None
    return re.sub(r"_\d+$", "", stem).strip(), alternative


def main(dry_run):
    import psycopg2

    if not os.path.isdir(IMPORT_DIR):
        log.info("ingen importmappe (%s) — intet at gøre", IMPORT_DIR)
        return 0
    files = sorted(f for f in os.listdir(IMPORT_DIR) if os.path.splitext(f)[1].lower() in EXTENSIONS)
    if not files:
        return 0
    conn = psycopg2.connect(os.environ["DATABASE_URL"].split("?")[0])
    with conn.cursor() as cur:
        cur.execute('SELECT id, name, "logoUrl" FROM brands')
        brands = cur.fetchall()
    by_key = {}
    for brand_id, name, logo_url in brands:
        by_key.setdefault(normalize(name), []).append((brand_id, name, logo_url))

    applied, replaced, alternatives, unmatched = 0, 0, [], []
    os.makedirs(DONE_DIR, exist_ok=True)
    for filename in files:
        name, is_alternative = brand_name_for(filename)
        if is_alternative:
            alternatives.append(filename)
            continue
        matches = by_key.get(normalize(name))
        if not matches:
            near = difflib.get_close_matches(normalize(name), list(by_key), n=3, cutoff=0.6)
            unmatched.append((filename, [by_key[key][0][1] for key in near]))
            continue
        path = os.path.join(IMPORT_DIR, filename)
        try:
            image = process_image(path)
        except Exception as error:  # et enkelt dårligt billede må ikke stoppe importen
            log.warning("kunne ikke læse %s: %s", filename, error)
            unmatched.append((filename, ["(ulæseligt billede)"]))
            continue
        for brand_id, brand_name, old_url in matches:
            had_logo = bool(old_url)
            log.info("%s -> %s%s", filename, brand_name, " (erstatter eksisterende logo)" if had_logo else "")
            if dry_run:
                continue
            image.save(os.path.join(LOGO_DIR, f"{brand_id}.png"), format="PNG", optimize=True)
            # Ny forespørgselsstreng ved udskiftning, så telefoner ikke viser det gamle logo.
            logo_url = f"{LOGO_PREFIX}/{brand_id}.png" + (f"?v={int(time.time())}" if had_logo else "")
            with conn.cursor() as cur:
                cur.execute('UPDATE brands SET "logoUrl" = %s WHERE id = %s', (logo_url, brand_id))
            conn.commit()
            applied += 1
            replaced += 1 if had_logo else 0
        if not dry_run:
            shutil.move(path, os.path.join(DONE_DIR, filename))

    log.info("%d logoer sat (%d erstattede et eksisterende), %d alternative udgaver sprunget over, %d uden match%s",
             applied, replaced, len(alternatives), len(unmatched), " [DRY RUN]" if dry_run else "")
    for filename in alternatives:
        log.info("alternativ (ikke brugt): %s", filename)
    for filename, near in unmatched:
        log.warning("INGEN MATCH: %s — nærmeste brands: %s", filename, ", ".join(near) or "ingen")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main("--dry-run" in sys.argv))
