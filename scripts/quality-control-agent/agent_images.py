"""Fælles billedindlæsning til agentens lokale robotter (samme volume som agent.py)."""

import io
import os

import requests
from PIL import Image

IMAGES_DIR = os.environ.get("PRODUCT_IMAGES_DIR", "/images")
PUBLIC_PATH_PREFIX = os.environ.get("PUBLIC_PATH_PREFIX", "/product-images")


def load_on_white(public_url: str) -> Image.Image:
    if public_url.startswith(PUBLIC_PATH_PREFIX):
        path = os.path.join(IMAGES_DIR, public_url[len(PUBLIC_PATH_PREFIX):].split("?")[0].lstrip("/"))
        with open(path, "rb") as handle:
            data = handle.read()
    else:
        response = requests.get(public_url, timeout=15)
        response.raise_for_status()
        data = response.content
    rgba = Image.open(io.BytesIO(data)).convert("RGBA")
    background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    return Image.alpha_composite(background, rgba).convert("RGB")
