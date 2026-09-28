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

import requests
import cv2  # følger med rembg (opencv-python-headless)
import numpy as np
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


# Varer hentet fra Open Food Facts/USDA har et eksternt billede (https). Det
# fritskrabes ligesom kamerafotos, så datakilden ikke ændrer varens design
# (docs/DECISIONS.md 2026-09-28).
REMOTE_MAX_BYTES = 15 * 1024 * 1024


def open_source(source_url):
    if source_url.startswith("https://"):
        response = requests.get(source_url, timeout=20, headers={"User-Agent": "HelloCal image-agent"})
        response.raise_for_status()
        if len(response.content) > REMOTE_MAX_BYTES:
            raise ValueError(f"remote image too large: {source_url}")
        return io.BytesIO(response.content)
    return local_path(source_url)


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


def drop_edge_fragments(cutout):
    """Fjerner forgrundsstumper, som beskæringskanten har skåret over.

    Logo-boksen får luft om sig, og så kommer der tit et stykke af teksten
    under/ved siden af logoet med (test 2026-09-27: "Herzstücke" under
    EDEKA-logoet). Fjernes: stumper, der rører kanten, og bittesmå stumper
    (under 1 % af den største del) uden for den største dels område, fx
    prikkerne over et afskåret "ü". Den største del fjernes aldrig, så et
    logo, der selv rører kanten, bevares. Ordlogoer med separate bogstaver
    rører ikke kanten, og deres bogstaver er ikke bittesmå, så de bevares.
    """
    alpha = np.array(cutout.getchannel("A"))
    mask = (alpha > 16).astype(np.uint8)
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count <= 2:
        return cutout
    height, width = mask.shape
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    lx, ly, lw, lh, larea = (int(v) for v in stats[largest])
    drop = np.zeros(mask.shape, dtype=bool)
    for index in range(1, count):
        if index == largest:
            continue
        x, y, w, h, area = (int(v) for v in stats[index])
        touches_edge = x == 0 or y == 0 or x + w >= width or y + h >= height
        cx, cy = centroids[index]
        outside_largest = not (lx <= cx <= lx + lw and ly <= cy <= ly + lh)
        if touches_edge or (area < larea * 0.01 and outside_largest):
            drop |= labels == index
    if not drop.any():
        return cutout
    # Næsten usynlig "tåge" (alpha <= 16) omkring de fjernede stumper ville
    # ellers holde den efterfølgende beskæring (getbbox) lige så stor.
    alpha[drop | (mask == 0)] = 0
    cleaned = cutout.copy()
    cleaned.putalpha(Image.fromarray(alpha))
    return cleaned


def level_lighting(cutout, strength=0.35, max_gain=1.6):
    """Udjævner ujævnt lys på varen: skyggesider løftes op mod de bedst
    belyste dele (brugerens ønske 2026-09-27: EDEKA-kartonen var lys foroven
    og mørk på resten af fladen).

    Belysningen skønnes som varens lysstyrke udglattet over ca. 1/8 af
    billedet — kun varens egne pixels tæller, så den gennemsigtige baggrund
    ikke trækker ned. Hver pixel løftes med (bedste lys / eget lys) ^ strength,
    højst max_gain gange og aldrig mørkere. strength 0.35 = et moderat trin
    (brugeren bad om "lidt lysere"), så mørkt tryk (fx et mørkt logo) stadig
    er mørkt, bare ikke i skygge. Køres efter auto_exposure.
    """
    rgba = np.array(cutout).astype(np.float32)
    visible = rgba[..., 3] > 128
    if visible.sum() < 100:
        return cutout
    rgb = rgba[..., :3]
    luminance = (rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722) / 255.0
    height, width = luminance.shape
    sigma = max(height, width) / 8.0
    weight = visible.astype(np.float32)
    lit = cv2.GaussianBlur(luminance * weight, (0, 0), sigma) / np.maximum(cv2.GaussianBlur(weight, (0, 0), sigma), 1e-3)
    best = float(np.percentile(lit[visible], 90))
    gain = np.clip(np.power(best / np.maximum(lit, 1e-3), strength), 1.0, max_gain)
    rgba[..., :3] = np.clip(rgb * gain[..., None], 0, 255)
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def auto_exposure(cutout, lift_midtones):
    """Gør et for mørkt fritskrabet billede lysere uden at ændre størrelsen.

    Mobilfotos i køkkenlys er typisk undereksponerede (test 2026-09-27:
    EDEKA-logoet blev næsten sort). Kun varens egne pixels (alpha > 128)
    måles. Lyseste del (99. percentil) løftes til næsten hvid, så farverne
    bevares; for produktfotos løftes mellemtonerne også lidt (gamma), for
    logoer ikke — et sort logo må ikke blive gråt. Gør aldrig billedet
    mørkere.
    """
    rgba = np.array(cutout).astype(np.float32)
    alpha = rgba[..., 3]
    visible = alpha > 128
    if visible.sum() < 100:
        return cutout
    rgb = rgba[..., :3]
    luminance = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
    high = float(np.percentile(luminance[visible], 99))
    gain = min(2.0, max(1.0, 245.0 / max(high, 1.0)))
    rgb = np.clip(rgb * gain, 0, 255)
    if lift_midtones:
        luminance = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722
        median = float(np.median(luminance[visible])) / 255.0
        # Mellemtonerne løftes mod 50 % (brugerens ønske 2026-09-27: "de
        # mørke toner lidt lysere"). Gamma under 1 løfter mørke toner mest.
        if 0.02 < median < 0.5:
            gamma = min(1.0, max(0.6, np.log(0.5) / np.log(median)))
            rgb = 255.0 * np.power(rgb / 255.0, gamma)
    rgba[..., :3] = rgb
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def _bottom_line(alpha, left_fit, right_fit, bottom_row):
    """Bundkanten som ret linje y = s*x + c, målt mellem siderne.

    Laveste synlige pixel pr. kolonne i de midterste 70 % af bunden. None,
    hvis bunden ikke er en ret linje (fx en rund flaskebund eller en pose) —
    så bruges en vandret bund, og kun siderne rettes.
    """
    height, width = alpha.shape
    left, right = np.polyval(left_fit, bottom_row), np.polyval(right_fit, bottom_row)
    span = right - left
    xs, ys = [], []
    for x in range(max(0, int(left + span * 0.15)), min(width, int(right - span * 0.15))):
        column = np.flatnonzero(alpha[:, x] > 128)
        if column.size:
            xs.append(x)
            ys.append(column[-1])
    if len(xs) < max(10, span * 0.3):
        return None
    xs, ys = np.array(xs, dtype=np.float64), np.array(ys, dtype=np.float64)
    fit = np.polyfit(xs, ys, 1)
    if np.percentile(np.abs(np.polyval(fit, xs) - ys), 90) > width * 0.015 or abs(fit[0]) > 0.2:
        return None
    return fit


def _meet(side_fit, slope, offset):
    """Skæring mellem en side (x = a*y + b) og en linje (y = slope*x + offset)."""
    a, b = side_fit
    x = (a * offset + b) / (1 - a * slope)
    return x, slope * x + offset


def straighten(cutout):
    """Retter varen op, når den har lige sider (karton, kasse, dåse).

    Et foto taget lidt oppefra gør varen bredere foroven end forneden, og en
    let skæv telefon gør bunden skrå (perspektiv). Venstre og højre kant måles
    på kroppen (30-95 % af højden, så låg/top og skygge ikke tæller), og
    bundkanten måles mellem siderne. En perspektivrettelse gør siderne
    lodrette og bunden vandret. Bredden bliver gennemsnittet af top og bund
    og højden bevares, så proportionerne holdes.

    Formen afgør, om der rettes: siderne skal være rette linjer (højst 2 % af
    bredden i afvigelse). En flaske med buet krop, en pose, frugt eller et
    kyllingelår har ikke rette sider og røres derfor ikke. Test 2026-09-27:
    EDEKA-kartonen + kunstige former.
    """
    alpha = np.array(cutout.getchannel("A"))
    height, width = alpha.shape
    ys, lefts, rights = [], [], []
    for y in range(int(height * 0.30), int(height * 0.95)):
        xs = np.flatnonzero(alpha[y] > 128)
        if xs.size >= width * 0.2:
            ys.append(y)
            lefts.append(xs[0])
            rights.append(xs[-1])
    if len(ys) < height * 0.3:
        return cutout
    ys = np.array(ys, dtype=np.float64)
    left_fit = np.polyfit(ys, lefts, 1)
    right_fit = np.polyfit(ys, rights, 1)
    tolerance = width * 0.02
    if (
        np.percentile(np.abs(np.polyval(left_fit, ys) - lefts), 90) > tolerance
        or np.percentile(np.abs(np.polyval(right_fit, ys) - rights), 90) > tolerance
    ):
        return cutout  # siderne er ikke rette linjer
    top = ys[0]
    bottom_fit = _bottom_line(alpha, left_fit, right_fit, ys[-1])
    slope, offset = (bottom_fit[0], bottom_fit[1]) if bottom_fit is not None else (0.0, ys[-1])
    bl, br = _meet(left_fit, slope, offset), _meet(right_fit, slope, offset)
    center = (bl[0] + br[0]) / 2
    # Toppen af firkanten: parallel med bunden gennem kroppens øverste række.
    top_offset = top - slope * center
    tl, tr = _meet(left_fit, slope, top_offset), _meet(right_fit, slope, top_offset)
    top_width = np.hypot(tr[0] - tl[0], tr[1] - tl[1])
    bottom_width = np.hypot(br[0] - bl[0], br[1] - bl[1])
    if (
        abs(top_width - bottom_width) < width * 0.01
        and abs(tl[0] - bl[0]) < width * 0.01
        and abs(slope) < 0.005
    ):
        return cutout  # allerede lige
    target = (top_width + bottom_width) / 2
    top_y, bottom_y = top, slope * center + offset
    src = np.float32([tl, tr, br, bl])
    dst = np.float32(
        [
            [center - target / 2, top_y],
            [center + target / 2, top_y],
            [center + target / 2, bottom_y],
            [center - target / 2, bottom_y],
        ]
    )
    matrix = cv2.getPerspectiveTransform(src, dst)
    corners = cv2.perspectiveTransform(np.float32([[[0, 0]], [[width, 0]], [[width, height]], [[0, height]]]), matrix)
    min_x, min_y = corners[:, 0, 0].min(), corners[:, 0, 1].min()
    shift = np.array([[1, 0, -min_x], [0, 1, -min_y], [0, 0, 1]], dtype=np.float64)
    out_w = int(np.ceil(corners[:, 0, 0].max() - min_x))
    out_h = int(np.ceil(corners[:, 0, 1].max() - min_y))
    if out_w <= 0 or out_h <= 0 or out_w > width * 3 or out_h > height * 3:
        return cutout
    warped = cv2.warpPerspective(
        np.array(cutout), shift @ matrix, (out_w, out_h), flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0, 0)
    )
    result = Image.fromarray(warped, "RGBA")
    bbox = result.getbbox()
    return result.crop(bbox) if bbox else cutout


def make_cutout(source_path, box, kind="PRODUCT_FRONT"):
    """Beskær -> fjern baggrund -> ryd op -> ret ud (produkt) -> lys op.

    Alt sker lokalt på originalfotoet, så størrelse, proportioner og logo
    aldrig ændres af en AI (OpenAI's billedmodeller returnerede andre
    formater end fotoet i testen 2026-09-18).
    """
    with Image.open(source_path) as source:
        cropped = crop(source.convert("RGB"), box)
    buffer = io.BytesIO()
    cropped.save(buffer, format="PNG")
    cutout = Image.open(io.BytesIO(remove(buffer.getvalue()))).convert("RGBA")
    if kind == "BRAND_LOGO":
        cutout = drop_edge_fragments(cutout)
    bbox = cutout.getbbox()
    if not bbox:
        raise ValueError("background removal left nothing")
    cutout = cutout.crop(bbox)
    if kind == "PRODUCT_FRONT":
        # Ret op -> lys op -> udjævn skygger (i den rækkefølge: udjævning
        # først ville svække den samlede lysning, test 2026-09-27).
        return level_lighting(auto_exposure(straighten(cutout), lift_midtones=True))
    return auto_exposure(cutout, lift_midtones=False)


def fetch_pending_jobs(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, "sourceUrl", "cropBox", kind
            FROM image_cutout_jobs
            WHERE status = 'PENDING'
            ORDER BY "createdAt" ASC
            LIMIT %s
            """,
            (CUTOUT_BATCH_SIZE,),
        )
        return cur.fetchall()


def process_job(conn, job_id, source_url, crop_box, kind):
    try:
        cutout = make_cutout(open_source(source_url), crop_box, kind)
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
    for job_id, source_url, crop_box, kind in fetch_pending_jobs(conn):
        process_job(conn, job_id, source_url, crop_box, kind)
    apply_finished_jobs(conn)
