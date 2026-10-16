"""
Bria RMBG som alternativ motor til fritlægning (rembg er standard).

Vælges med CUTOUT_ENGINE=bria og BRIA_API_TOKEN. Bria's hostede API
(https://docs.bria.ai, "Remove Background") får billedet som base64 og
svarer med en adresse til et transparent PNG, som hentes her.
"""

import base64
import hashlib
import logging
import os

import psycopg2
import requests
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

log = logging.getLogger("image-agent.bria")

BRIA_API_URL = os.environ.get("BRIA_API_URL", "https://engine.prod.bria-api.com/v2/image/edit/remove_background")
BRIA_TIMEOUT = int(os.environ.get("BRIA_TIMEOUT_SECONDS", "60"))
# Hvert Bria-svar gemmes på disken efter billedets indhold, så samme billede
# aldrig koster to credits. Antallet af gemte svar er også kreditregnskabet:
# ved BRIA_MAX_CREDITS stopper vi, så de sidste credits ikke brændes af.
CACHE_DIR = os.path.join(os.environ.get("IMAGE_OUTPUT_DIR", "/images"), "bria-cache")
MAX_CREDITS = int(os.environ.get("BRIA_MAX_CREDITS", "170"))


def credits_used():
    try:
        return len([name for name in os.listdir(CACHE_DIR) if name.endswith(".png")])
    except FileNotFoundError:
        return 0


def _admin_token():
    """Nøglen gemt i admin → API-nøgler (app_secrets, samme kryptering som appen)."""
    master = os.environ.get("ADMIN_SESSION_SECRET", "")
    database_url = os.environ.get("DATABASE_URL", "").split("?")[0]
    if len(master) < 16 or not database_url:
        return None
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=b"hellocal-app-secrets", info=b"api-keys-v1").derive(master.encode())
    try:
        with psycopg2.connect(database_url, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute('SELECT "cipherText" FROM app_secrets WHERE key = %s', ("BRIA_API_TOKEN",))
            row = cur.fetchone()
        if not row:
            return None
        raw = base64.b64decode(row[0][3:])
        return AESGCM(key).decrypt(raw[:12], raw[28:] + raw[12:28], None).decode("utf-8").strip()
    except Exception as exc:  # noqa: BLE001
        log.warning("Kunne ikke læse Bria-nøglen fra admin: %s", exc)
        return None


def get_token():
    """Admin-gemt værdi vinder over .env, som i appen."""
    return _admin_token() or os.environ.get("BRIA_API_TOKEN", "").strip() or None


def available():
    return bool(get_token())


def record_api_call(service_id, ok, error=None, count=1):
    """Tæller et kald til admin → API-forbrug (api_usage_months, som recordApiCall i appen)."""
    database_url = os.environ.get("DATABASE_URL", "").split("?")[0]
    if not database_url:
        return
    message = None if ok else (error or "Ukendt fejl")[:300]
    try:
        with psycopg2.connect(database_url, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO api_usage_months ("serviceId", month, calls, errors, "lastOkAt", "lastErrorAt", "lastError")
                VALUES (%s, to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM'), %s, %s,
                        CASE WHEN %s THEN now() END, CASE WHEN %s THEN NULL ELSE now() END, %s)
                ON CONFLICT ("serviceId", month) DO UPDATE SET
                  calls = api_usage_months.calls + EXCLUDED.calls,
                  errors = api_usage_months.errors + EXCLUDED.errors,
                  "lastOkAt" = COALESCE(EXCLUDED."lastOkAt", api_usage_months."lastOkAt"),
                  "lastErrorAt" = COALESCE(EXCLUDED."lastErrorAt", api_usage_months."lastErrorAt"),
                  "lastError" = COALESCE(EXCLUDED."lastError", api_usage_months."lastError")
                """,
                (service_id, count, 0 if ok else 1, ok, ok, message),
            )
    except Exception as exc:  # noqa: BLE001
        log.debug("Kunne ikke tælle %s-kaldet: %s", service_id, exc)


def remove_background_bria(image_bytes):
    path = os.path.join(CACHE_DIR, hashlib.sha256(image_bytes).hexdigest() + ".png")
    if os.path.exists(path):  # gemt svar: ingen credits, ingen kaldtælling
        with open(path, "rb") as handle:
            return handle.read()
    if credits_used() >= MAX_CREDITS:
        raise RuntimeError(f"Bria-kreditgrænsen er nået ({MAX_CREDITS} billeder) — hæv BRIA_MAX_CREDITS, når der er købt flere")
    try:
        result = _remove_background_bria(image_bytes)
    except Exception as exc:
        record_api_call("bria", False, str(exc))
        raise
    record_api_call("bria", True)
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(path + ".tmp", "wb") as handle:
        handle.write(result)
    os.replace(path + ".tmp", path)
    return result


def _remove_background_bria(image_bytes):
    token = get_token()
    if not token:
        raise RuntimeError("Bria-nøgle mangler (admin → API-nøgler → Bria)")
    response = requests.post(
        BRIA_API_URL,
        headers={"api_token": token, "Content-Type": "application/json"},
        json={"image": base64.b64encode(image_bytes).decode("ascii"), "sync": True},
        timeout=BRIA_TIMEOUT,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Bria {response.status_code}: {response.text[:200]}")
    result_url = (response.json().get("result") or {}).get("image_url")
    if not result_url:
        raise RuntimeError(f"Bria returned no image_url: {response.text[:200]}")
    image = requests.get(result_url, timeout=BRIA_TIMEOUT)
    image.raise_for_status()
    return image.content
