"""Tests uden netværk: python -m unittest test_enrich (i denne mappe)."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import enrich


class EnrichTest(unittest.TestCase):
    def product(self, **ours):
        base = {"title": "Bio Havregryn", "brand": "Lidl", "ingredients": "", "kcal": ""}
        base.update(ours)
        return {"store": "lidl", "title": base["title"], "barcode": "4056489000011", "language": "da", "brand": "Lidl",
                "image": "", "ours": base, "key": "4056489000011", "file": "lidl.xlsx"}

    def test_barcode_hit_never_calls_title_or_vision(self):
        off = {"code": "4056489000011", "product_name": "Bio Havregryn", "ingredients_text": "Havre 100 %"}
        with mock.patch.object(enrich, "off_by_barcode", return_value=off), \
             mock.patch.object(enrich, "off_by_title") as title, mock.patch.object(enrich, "vision_facts") as vision:
            row = enrich.lookup(self.product(), {"delaySeconds": 0})
        title.assert_not_called()
        vision.assert_not_called()
        self.assertEqual(row["source"], "Open Food Facts: stregkode")
        self.assertEqual(row["facts"], {"Ingredienser": "Havre 100 %"})

    def test_title_search_when_barcode_gives_nothing(self):
        with mock.patch.object(enrich, "off_by_barcode", return_value=None), \
             mock.patch.object(enrich, "off_by_title", return_value={"code": "1", "quantity": "500 g"}) as title, \
             mock.patch.object(enrich, "vision_facts") as vision:
            row = enrich.lookup(self.product(), {"delaySeconds": 0})
        title.assert_called_once()
        vision.assert_not_called()
        self.assertEqual(row["facts"], {"Mængde": "500 g"})

    def test_vision_only_when_off_gives_zero(self):
        with mock.patch.object(enrich, "off_by_barcode", return_value=None), \
             mock.patch.object(enrich, "off_by_title", return_value=None), \
             mock.patch.object(enrich, "vision_facts", return_value={"Google Vision: bedste gæt": "havregryn"}) as vision:
            row = enrich.lookup(self.product(), {"delaySeconds": 0})
        vision.assert_called_once()
        self.assertEqual(row["source"], "Google Vision")

    def test_nothing_found_is_reported(self):
        with mock.patch.object(enrich, "off_by_barcode", return_value=None), \
             mock.patch.object(enrich, "off_by_title", return_value=None), \
             mock.patch.object(enrich, "vision_facts", return_value={}):
            row = enrich.lookup(self.product(), {"delaySeconds": 0})
        self.assertEqual(row["source"], "Intet fundet")
        self.assertEqual(row["facts"], {})

    def test_only_more_detail_counts_as_new(self):
        product = self.product(ingredients="Havre", kcal="370")
        facts = {"Ingredienser": "Havreflager (100 %), emulgator", "Energi (kcal/100 g)": "372", "Produktnavn": "Anden titel"}
        self.assertEqual(enrich.new_facts(product, facts), {"Ingredienser": "Havreflager (100 %), emulgator"})

    def test_off_facts_nutrients_and_tags(self):
        facts = enrich.off_facts({"nutriments": {"energy-kcal_100g": 372.4, "salt_100g": 0.01}, "allergens_tags": ["en:gluten"],
                                  "nutriscore_grade": "unknown"}, "da")
        self.assertEqual(facts["Energi (kcal/100 g)"], "372.4")
        self.assertEqual(facts["Allergener"], "gluten")
        self.assertNotIn("Nutri-Score", facts)

    def test_title_search_requires_brand_and_60_percent(self):
        product = {"title": "Bio Havregryn fuldkorn", "brand": "Lidl"}
        hit = {"code": "1", "brands": "Lidl", "product_name": "Havregryn fuldkorn bio"}
        wrong_brand = {"code": "2", "brands": "Quaker", "product_name": "Havregryn fuldkorn bio"}
        weak = {"code": "3", "brands": "Lidl", "product_name": "Chokolade"}
        with mock.patch.object(enrich, "off_get", return_value={"products": [weak, wrong_brand, hit]}):
            self.assertEqual(enrich.off_by_title(product)["code"], "1")

    def test_load_products_filters_store_and_language_and_writes_sheet(self):
        import openpyxl

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name, rows in (("Lidl dansk.xlsx", [["Titel", "EAN"], ["Mælk", "5700000000001"]]),
                               ("Aldi tysk.xlsx", [["Name", "GTIN", "Sprache"], ["Milch", "4000000000002", "de"],
                                                  ["Lait", "3000000000003", "fr"]]),
                               ("Rema 1000.xlsx", [["Titel"], ["Skal ikke med"]])):
                workbook = openpyxl.Workbook()
                for row in rows:
                    workbook.active.append(row)
                workbook.save(root / name)
            config = dict(enrich.DEFAULTS, inputDir=str(root), outputDir=str(root / "ud"))
            products, skipped = enrich.load_products(config)
            self.assertEqual(sorted(p["title"] for p in products), ["Milch", "Mælk"])
            self.assertEqual(skipped, 1)
            cache = {products[0]["key"]: {"key": "k", "source": "Open Food Facts: stregkode", "link": "x",
                                          "facts": {"Mængde": "1 l"}, "note": ""}}
            (root / "ud").mkdir()
            self.assertEqual(enrich.write_sheet(root / "ud" / "a.xlsx", products, cache), (1, 0))
            sheet = openpyxl.load_workbook(root / "ud" / "a.xlsx")["Nye fakta"]
            self.assertEqual([c.value for c in sheet[1]][-1], "Mængde")


if __name__ == "__main__":
    unittest.main()
