"""
Bria RMBG som alternativ motor til fritlægning (rembg er standard).

Vælges med CUTOUT_ENGINE=bria og BRIA_API_TOKEN. Bria's hostede API
(https://docs.bria.ai, "Remove Background") får billedet som base64 og
svarer med en adresse til et transparent PNG, som hentes her.
"""

import base64
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


def remove_background_bria(image_bytes):
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
