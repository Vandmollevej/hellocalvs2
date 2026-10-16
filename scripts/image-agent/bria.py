"""
Bria RMBG som alternativ motor til fritlægning (rembg er standard).

Vælges med CUTOUT_ENGINE=bria og BRIA_API_TOKEN. Bria's hostede API
(https://docs.bria.ai, "Remove Background") får billedet som base64 og
svarer med en adresse til et transparent PNG, som hentes her.
"""

import base64
import os

import requests

BRIA_API_URL = os.environ.get("BRIA_API_URL", "https://engine.prod.bria-api.com/v2/image/edit/remove_background")
BRIA_TIMEOUT = int(os.environ.get("BRIA_TIMEOUT_SECONDS", "60"))


def available():
    return bool(os.environ.get("BRIA_API_TOKEN"))


def remove_background_bria(image_bytes):
    token = os.environ.get("BRIA_API_TOKEN")
    if not token:
        raise RuntimeError("BRIA_API_TOKEN is not set")
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
