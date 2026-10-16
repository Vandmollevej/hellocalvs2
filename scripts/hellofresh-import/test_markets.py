"""Kør: cd scripts/hellofresh-import && python -m unittest test_markets"""

import unittest

from markets import MARKETS, external_id, ingredient_ids, product_id, read_nutrition, recipe_id_from_external

DK = MARKETS[0]
DE = next(m for m in MARKETS if m["country"] == "DE")


class IdsTest(unittest.TestCase):
    def test_denmark_keeps_old_ids(self):
        self.assertEqual(product_id(DK, "abc"), "hf_abc")
        self.assertEqual(external_id(DK, "abc"), "abc")
        self.assertEqual(ingredient_ids(DK, "i1"), ("hf_ing_i1", "i1"))
        self.assertEqual(recipe_id_from_external(DK, "abc"), "abc")
        self.assertIsNone(recipe_id_from_external(DK, "DE:abc"))

    def test_other_markets_are_separate(self):
        self.assertEqual(product_id(DE, "abc"), "hf_de_abc")
        self.assertEqual(external_id(DE, "abc"), "DE:abc")
        self.assertEqual(ingredient_ids(DE, "i1"), ("hf_ing_de_i1", "DE:i1"))
        self.assertEqual(recipe_id_from_external(DE, "DE:abc"), "abc")
        self.assertIsNone(recipe_id_from_external(DE, "abc"))

    def test_all_seventeen_markets(self):
        self.assertEqual(len({m["country"] for m in MARKETS}), 17)


class NutritionTest(unittest.TestCase):
    def test_danish(self):
        items = [
            {"name": "Energi (kJ)", "amount": 2700, "unit": "kJ"},
            {"name": "Kalorier (kcal)", "amount": 650, "unit": "kcal"},
            {"name": "Fedt", "amount": 30, "unit": "g"},
            {"name": "Mættet fedt", "amount": 10, "unit": "g"},
            {"name": "Kulhydrat", "amount": 60, "unit": "g"},
            {"name": "Sukker", "amount": 8, "unit": "g"},
            {"name": "Protein", "amount": 35, "unit": "g"},
            {"name": "Salt", "amount": 2.1, "unit": "g"},
        ]
        kcal, protein, carbs, fat, extra = read_nutrition(items)
        self.assertEqual((kcal, protein, carbs, fat), (650, 35, 60, 30))
        self.assertEqual(extra, {"saturatedFatG": 10, "sugarG": 8, "saltG": 2.1})

    def test_german(self):
        items = [
            {"name": "Brennwert", "amount": 2900, "unit": "kJ"},
            {"name": "Brennwert", "amount": 690, "unit": "kcal"},
            {"name": "Fett", "amount": 28, "unit": "g"},
            {"name": "davon gesättigte Fettsäuren", "amount": 9, "unit": "g"},
            {"name": "Kohlenhydrate", "amount": 70, "unit": "g"},
            {"name": "Eiweiß", "amount": 32, "unit": "g"},
        ]
        self.assertEqual(read_nutrition(items)[:4], (690, 32, 70, 28))

    def test_english_us(self):
        items = [
            {"name": "Calories", "amount": 710, "unit": "kcal"},
            {"name": "Fat", "amount": 33, "unit": "g"},
            {"name": "Carbohydrate", "amount": 64, "unit": "g"},
            {"name": "Protein", "amount": 38, "unit": "g"},
            {"name": "Sodium", "amount": 1200, "unit": "mg"},
        ]
        result = read_nutrition(items)
        self.assertEqual(result[:4], (710, 38, 64, 33))
        self.assertNotIn("saltG", result[4])

    def test_unknown_labels_skip_recipe(self):
        self.assertIsNone(read_nutrition([{"name": "Grasso", "amount": 1, "unit": "g"}]))


if __name__ == "__main__":
    unittest.main()
