// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { displayIngredientsText, looksDanish, reviewIngredientsText } from "./ingredient-text-quality.ts";

test("visning af gamle lister: £/€ → E og dansk soja, intet skæres fra", () => {
  assert.equal(displayIngredientsText("Vand, sukker, SOYA, citronsyre £202"), "Vand, sukker, SOJA, citronsyre E202");
  assert.equal(displayIngredientsText("Water, soya, €330"), "Water, soya, E330");
});

test("brugerens chilisauce: £202 → E202, SOYA → SOJA, Fnergi skæres fra", () => {
  const review = reviewIngredientsText(
    "Ingredienser: rapsolie, chili, SOYABØNNER, sukker, salt, citronsyre £202. Fnergi 690 kJ / 167 kcal",
  );
  assert.equal(review.text, "Ingredienser: rapsolie, chili, SOJABØNNER, sukker, salt, citronsyre E202.");
  assert.equal(review.fixes.length, 3);
  assert.deepEqual(review.doubts, []);
});

test("dansk stavning bevarer store/små bogstaver og sammensatte ord", () => {
  assert.equal(reviewIngredientsText("Vand, sukker, soyasauce, Soya, SOYA", "da").text, "Vand, sukker, sojasauce, Soja, SOJA");
});

test("engelsk liste beholder 'soya'", () => {
  const review = reviewIngredientsText("Water, sugar, soya beans, salt", "en");
  assert.equal(review.text, "Water, sugar, soya beans, salt");
  assert.deepEqual(review.fixes, []);
});

test("sprog uden oplysning: dansk afgøres af ordene", () => {
  assert.equal(looksDanish("vand, sukker, salt, soya"), true);
  assert.equal(looksDanish("water, sugar, salt, soya"), false);
});

test("tvivl: usædvanlige tegn og parenteser, der ikke går op", () => {
  assert.ok(reviewIngredientsText("Vand, sukker (12%, salt @ 3").doubts.length >= 2);
});

test("ren liste giver hverken rettelser eller tvivl", () => {
  const review = reviewIngredientsText("Hvedemel, vand, gær, salt, rapsolie, surhedsregulerende middel (E330).", "da");
  assert.deepEqual(review.fixes, []);
  assert.deepEqual(review.doubts, []);
});

test("energidrik i listen er ikke næringstabellen", () => {
  const review = reviewIngredientsText("Vand, sukker, energidrik-aroma, koffein", "da");
  assert.equal(review.text, "Vand, sukker, energidrik-aroma, koffein");
});

test("brugerens skærmbillede: OCR-ord, £202 og næringsstøj rettes", () => {
  const review = reviewIngredientsText(
    "Chili, vand, vegetabilsk olie, bordsalt, SOIASAUCE, mononatriumglutamat (MSG), brygget sauce, SFSAMFRØ, krydderler, acetyleret diastarkfosfat, E635, cltronsyre, £202. ee .06 kcal | ; :699k1 167 ; Fnergi / kulhydrat:",
  );
  assert.equal(
    review.text,
    "Chili, vand, vegetabilsk olie, bordsalt, SOJASAUCE, mononatriumglutamat (MSG), brygget sauce, SESAMFRØ, krydderier, acetyleret diastarkfosfat, E635, citronsyre, E202.",
  );
  assert.deepEqual(review.doubts, []);
});

test("kendte og ukendte ord uden sikker rettelse røres ikke", () => {
  assert.equal(reviewIngredientsText("Vand, sukker, lime, kardemomme, salt", "da").text, "Vand, sukker, lime, kardemomme, salt");
});

test("STORE bogstaver er allergener: FSAMFRØ, SOIASAUCE, MEIK, HVFDEMEL", () => {
  const review = reviewIngredientsText("Vand, sukker, FSAMFRØ, SOIASAUCE, MÆIK, HVFDEMEL, salt", "da");
  assert.equal(review.text, "Vand, sukker, SESAMFRØ, SOJASAUCE, MÆLK, HVEDEMEL, salt");
});

test("ukendte rigtige ord med små bogstaver røres ikke (salat ≠ salt)", () => {
  assert.equal(reviewIngredientsText("Vand, salat, sukker, olie", "da").text, "Vand, salat, sukker, olie");
});

test("listen stopper ved næringstabellen, også uden overskrift", async () => {
  const { findIngredientsSection } = await import("./product-ocr.ts");
  assert.equal(
    findIngredientsSection("Ingredienser: chili, vand, salt, citronsyre £202. ee .06 kcal | ; :699k1 167 ; Fnergi / kulhydrat:"),
    "chili, vand, salt, citronsyre £202.",
  );
});

test("volapyk giver tvivl: ':699k1', 'ee', men ikke E-numre, B12 eller 12%", async () => {
  const { junkTokens } = await import("./ingredient-text-quality.ts");
  assert.deepEqual(junkTokens("citronsyre E202. ee .06 kcal | ; :699k1 167"), ["ee", "699k1"]);
  assert.deepEqual(junkTokens("Vand, sukker (12%), E330, vitamin B12, D3, omega-3, 2,5 g salt"), []);
  assert.ok(reviewIngredientsText("Vand, sukker, salt, xq7z, olie", "da").doubts.some((d) => d.startsWith("Volapyk")));
});

test("E-numre står frit og tegnsætning ryddes (bruger 2026-10-17)", () => {
  assert.equal(
    displayIngredientsText(
      "Vand, sukker, kuldioxid, farvestof (karamelE150d), surhedsregulerende middel (E338), , naturlige aromaer(inkl. koffein).",
    ),
    "Vand, sukker, kuldioxid, farvestof (karamel E150d), surhedsregulerende middel (E338), naturlige aromaer (inkl. koffein).",
  );
  assert.equal(displayIngredientsText("Water, colour E-150D ,acid e338"), "Water, colour E150d, acid E338");
  assert.equal(displayIngredientsText("emulgator E471(ii), E160a(ii), 1,5% salt"), "emulgator E471(ii), E160a(ii), 1,5% salt");
});
