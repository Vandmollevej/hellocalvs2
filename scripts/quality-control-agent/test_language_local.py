"""Kør: python -m pytest scripts/quality-control-agent/test_language_local.py (eller python -m unittest)."""

import unittest

from language_local import decide


class DecideTest(unittest.TestCase):
    def test_changes_when_sure(self):
        self.assertEqual(decide("da", "de", 0.95, 60), "de")

    def test_keeps_same(self):
        self.assertIsNone(decide("de", "de", 0.99, 60))

    def test_keeps_on_short_or_unsure_text(self):
        self.assertIsNone(decide("da", "de", 0.95, 10))
        self.assertIsNone(decide("da", "de", 0.6, 80))

    def test_scandinavian_never_swapped(self):
        self.assertIsNone(decide("da", "no", 0.99, 80))
        self.assertIsNone(decide("da", "sv", 0.99, 80))

    def test_script_language_is_final(self):
        self.assertIsNone(decide("zh", "en", 0.99, 80))

    def test_empty_detection(self):
        self.assertIsNone(decide("da", None, 0.0, 80))


if __name__ == "__main__":
    unittest.main()
