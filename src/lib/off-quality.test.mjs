// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessOffProduct, isValidGtin, ratingForScore } from "./off-quality.ts";

const good = {
  name: "Skyr naturel",
  brandName: "Arla",
  imageUrl: "/product-images/skyr.png",
  hasCutout: true,
  kcalPer100g: 63,
  proteinPer100g: 11,
  carbsPer100g: 4,
  fatPer100g: 0.2,
  saturatedFatPer100g: 0.1,
  sugarPer100g: 3.8,
  saltPer100g: 0.1,
  ingredientsText: "Skummetmælk, mælkeprotein, syrnings­kultur",
  allergens: ["milk"],
  packageSizeText: "1000 g",
  productType: "Skyr",
  productCategory: "PROCESSED",
  barcodes: ["4006381333931"],
  nameOriginal: null,
  translationSourceLang: null,
  translationStatus: null,
};

const codes = (assessment) => assessment.findings.map((f) => f.code);

test("a complete product is rated GOOD with no findings", () => {
  const result = assessOffProduct(good);
  assert.deepEqual(result.findings, []);
  assert.equal(result.score, 100);
  assert.equal(result.rating, "GOOD");
  assert.deepEqual(result.categories, []);
});

test("rating thresholds", () => {
  assert.equal(ratingForScore(49), "POOR");
  assert.equal(ratingForScore(50), "WEAK");
  assert.equal(ratingForScore(74), "WEAK");
  assert.equal(ratingForScore(75), "OK");
  assert.equal(ratingForScore(89), "OK");
  assert.equal(ratingForScore(90), "GOOD");
});

test("a thin product collects findings in several categories", () => {
  const result = assessOffProduct({
    ...good,
    name: "Ukendt vare",
    brandName: null,
    imageUrl: null,
    kcalPer100g: 0,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 0,
    sugarPer100g: null,
    saltPer100g: null,
    ingredientsText: null,
    allergens: [],
    packageSizeText: null,
    productType: null,
    productCategory: null,
    barcodes: [],
  });
  assert.equal(result.rating, "POOR");
  assert.equal(result.score, 0);
  for (const category of ["IMAGE", "NAME", "BRAND", "NUTRITION", "INGREDIENTS", "PACKAGE", "CLASSIFICATION", "BARCODE"]) {
    assert.ok(result.categories.includes(category), `mangler kategori ${category}`);
  }
});

test("kcal that does not match the macros is flagged with a comment", () => {
  const result = assessOffProduct({ ...good, kcalPer100g: 500, proteinPer100g: 5, carbsPer100g: 5, fatPer100g: 1 });
  assert.ok(codes(result).includes("KCAL_MISMATCH"));
  assert.match(result.findings.find((f) => f.code === "KCAL_MISMATCH").comment, /passer ikke til makroerne/);
});

test("macros above 100 g and sugar above carbs are flagged", () => {
  const result = assessOffProduct({ ...good, proteinPer100g: 60, carbsPer100g: 30, fatPer100g: 30, kcalPer100g: 560, sugarPer100g: 40 });
  assert.ok(codes(result).includes("MACROS_OVER_100"));
  assert.ok(codes(result).includes("SUGAR_OVER_CARBS"));
});

test("allergens are only suspected when the list is empty", () => {
  const empty = assessOffProduct({ ...good, allergens: [] });
  assert.ok(codes(empty).includes("ALLERGENS_MISSING"));
  const filled = assessOffProduct({ ...good, allergens: ["milk"] });
  assert.ok(!codes(filled).includes("ALLERGENS_MISSING"));
});

test("a pending machine translation is a finding", () => {
  const result = assessOffProduct({ ...good, translationStatus: "PENDING", translationSourceLang: "en", nameOriginal: "Plain skyr" });
  assert.ok(result.categories.includes("TRANSLATION"));
});

test("GTIN check digits", () => {
  assert.equal(isValidGtin("4006381333931"), true);
  assert.equal(isValidGtin("4006381333932"), false);
  assert.equal(isValidGtin("12345"), false);
  assert.equal(isValidGtin("abc"), false);
});

test("name rules: uppercase, brand prefix and quantity in the name", () => {
  const upper = assessOffProduct({ ...good, name: "SKYR NATUREL" });
  assert.ok(codes(upper).includes("NAME_UPPERCASE"));
  const brand = assessOffProduct({ ...good, name: "Arla skyr" });
  assert.ok(codes(brand).includes("NAME_STARTS_WITH_BRAND"));
  const quantity = assessOffProduct({ ...good, name: "Skyr 1000 g" });
  assert.ok(codes(quantity).includes("NAME_HAS_QUANTITY"));
});
