// Kør: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { brandProductName, isPlaceholderProductName } from "./product-placeholder-name.ts";

test("det gamle reservenavn genkendes", () => {
  assert.equal(isPlaceholderProductName("Vare 40157818"), true);
  assert.equal(isPlaceholderProductName("Vare 5701234567890"), true);
});

test("rigtige varenavne er ikke reservenavne", () => {
  assert.equal(isPlaceholderProductName("Verpoorten"), false);
  assert.equal(isPlaceholderProductName("Vare 12"), false);
  assert.equal(isPlaceholderProductName(null), false);
});

test("vare uden varenavn hedder brand + subbrand, aldrig varianten", () => {
  assert.equal(brandProductName("Verpoorten", null), "Verpoorten");
  assert.equal(brandProductName("Arla", "LactoFREE"), "Arla LactoFREE");
  assert.equal(brandProductName("Arla", "Arla Lærkevang"), "Arla Lærkevang");
  assert.equal(brandProductName(null, "Herzstücke"), "Herzstücke");
  assert.equal(brandProductName(null, null), "");
});
