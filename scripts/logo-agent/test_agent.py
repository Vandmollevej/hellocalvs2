"""
Regressionstest: ingen numpy-skalarer må nå cur.execute i logo-robotten.

Med numpy 2 sender psycopg2 np.float64(0.9) som teksten "np.float64(0.9)", og
INSERT i brand_logo_searches/brand_logo_candidates fejler med
'schema "np" does not exist'. imagehash regner med numpy, så visual_similarity()
og dermed confidence skal være ren float.

Kør fra denne mappe (kræver kun robottens egne afhængigheder, ingen database):
    python test_agent.py
"""

import os
import unittest
from unittest import mock

os.environ.setdefault("DATABASE_URL", "postgresql://test/test")

import numpy as np
from PIL import Image
from psycopg2.extensions import adapt

import agent


def solid(color, size=(128, 128)):
    return Image.new("RGBA", size, color)


def assert_plain(testcase, value, label):
    testcase.assertNotIsInstance(value, np.generic, f"{label} er en numpy-skalar: {type(value)!r}")
    # Det psycopg2 faktisk sender til Postgres.
    testcase.assertNotIn(b"np.", adapt(value).getquoted(), f"{label} adapteres som numpy-repr")


class FakeCursor:
    def __init__(self, calls):
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.calls.append((sql, params))


class FakeConnection:
    def __init__(self):
        self.calls = []

    def cursor(self):
        return FakeCursor(self.calls)

    def commit(self):
        pass


class NumpyScalarsTest(unittest.TestCase):
    def test_visual_similarity_is_plain_float(self):
        for a, b in (
            (solid((255, 0, 0, 255)), solid((250, 10, 0, 255))),
            (solid((255, 0, 0, 255)), solid((0, 0, 255, 255))),
        ):
            value = agent.visual_similarity(a, b)
            self.assertIs(type(value), float)
            assert_plain(self, value, "visual_similarity")

    def test_process_brand_sql_params_are_plain_python(self):
        crop = solid((10, 20, 30, 255))
        # Halv sort/hvid: visuelt anderledes end crop, så confidence ikke rammer
        # loftet på 1.0 (min(1.0, np.float64) giver kun np.float64 under loftet).
        halves = Image.new("RGBA", (500, 500), (255, 255, 255, 255))
        halves.paste((0, 0, 0, 255), (0, 0, 250, 500))
        scenarios = (
            # (kandidatbillede, side-titel, Vision-svar, MIN, AUTO, forventet status)
            (halves, None, [{}], 0.0, 2.0, "PENDING_REVIEW"),
            (solid((12, 22, 32, 255), size=(500, 500)), "Brand",
             [{"logoAnnotations": [{"description": "Brand", "score": 0.9}]}], 0.0, 0.0, "AUTO_ACCEPTED"),
        )

        for candidate_image, page_title, vision_responses, min_confidence, auto_accept, expected_status in scenarios:
            candidates = [{"url": "https://example.com/brand.png", "match": 0.6, "pageUrl": None, "pageTitle": page_title}]
            conn = FakeConnection()
            with mock.patch.multiple(
                agent,
                load_product_image=mock.Mock(return_value=b"front"),
                isolate_logo=mock.Mock(return_value=(crop, "Brand")),
                web_candidates=mock.Mock(return_value=candidates),
                download=mock.Mock(return_value=candidate_image),
                vision=mock.Mock(return_value=vision_responses),
                save_png=mock.Mock(side_effect=lambda image, relative: f"/product-images/brand-logos/{relative}"),
                MIN_CONFIDENCE=min_confidence,
                AUTO_ACCEPT=auto_accept,
            ):
                agent.process_brand(conn, "brand1", "Brand", "product1", "https://example.com/front.png")

            inserts = [(sql, params) for sql, params in conn.calls if sql.lstrip().startswith("INSERT")]
            self.assertEqual(len(inserts), 2, "forventede én søgning + én kandidat")
            self.assertEqual(inserts[0][1][4], expected_status)
            for sql, params in conn.calls:
                for position, value in enumerate(params or ()):
                    assert_plain(self, value, f"param {position} i {sql.split()[0]} {sql.split()[2]}")
            # Selve confidence-værdierne skal være rigtige tal, ikke None.
            self.assertIs(type(inserts[0][1][5]), float)
            self.assertIs(type(inserts[1][1][6]), float)


class AiRedrawTest(unittest.TestCase):
    """Brugerens regel 2026-10-15: kun uden fritlagt fund online rentegner AI
    originaludklippet; kandidaten markeres aiGenerated og vælges manuelt."""

    def run_brand(self, transparent_found):
        crop = solid((10, 20, 30, 255))
        candidate_image = solid((200, 200, 200, 255), size=(500, 500))
        candidates = [{"url": "https://example.com/brand.png", "match": 0.6, "pageUrl": None, "pageTitle": None}]
        conn = FakeConnection()
        redraw = mock.Mock(return_value=solid((10, 20, 30, 255), size=(300, 200)))
        with mock.patch.multiple(
            agent,
            load_product_image=mock.Mock(return_value=b"front"),
            isolate_logo=mock.Mock(return_value=(crop, "Brand")),
            web_candidates=mock.Mock(return_value=candidates),
            download=mock.Mock(return_value=candidate_image),
            make_background_transparent=mock.Mock(return_value=(candidate_image, transparent_found)),
            vision=mock.Mock(return_value=[{}]),
            save_png=mock.Mock(side_effect=lambda image, relative: f"/product-images/brand-logos/{relative}"),
            ai_redraw=redraw,
            MIN_CONFIDENCE=0.0,
            AUTO_ACCEPT=2.0,
        ):
            agent.process_brand(conn, "brand1", "Brand", "product1", "https://example.com/front.png")
        return conn, redraw

    def test_redraw_without_transparent_find(self):
        conn, redraw = self.run_brand(transparent_found=False)
        redraw.assert_called_once()
        ai_rows = [params for sql, params in conn.calls if '"aiGenerated"' in sql]
        self.assertEqual(len(ai_rows), 1)
        self.assertTrue(ai_rows[0][3].startswith("openai:"))

    def test_no_redraw_when_transparent_logo_found_online(self):
        conn, redraw = self.run_brand(transparent_found=True)
        redraw.assert_not_called()
        self.assertFalse(any('"aiGenerated"' in sql for sql, _ in conn.calls))


class ProductImagesTest(unittest.TestCase):
    def test_text_score_uses_product_and_brand_words(self):
        import product_images

        candidate = {"url": "https://shop.dk/img/salling-oeko-hakket-grisekoed.jpg", "pageUrl": None, "pageTitle": "Salling hakket grisekød"}
        self.assertGreaterEqual(product_images.text_score("Hakket grisekød", "Salling", candidate), 0.9)
        other = {"url": "https://example.com/a.jpg", "pageUrl": None, "pageTitle": "Chokolade"}
        self.assertEqual(product_images.text_score("Hakket grisekød", "Salling", other), 0.0)


if __name__ == "__main__":
    unittest.main()
