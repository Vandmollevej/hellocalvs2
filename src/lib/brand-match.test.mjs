// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { brandNameConfirmed, matchBrand, matchBrandInTexts, newBrandAllowed } from "./brand-match.ts";

const brands = [
  { id: "1", name: "ØGO" },
  { id: "2", name: "Dr. Oetker" },
  { id: "3", name: "EDEKA" },
  { id: "4", name: "Ost" },
];

test("ØGO matches its own spelling, DAGO does not", () => {
  assert.equal(matchBrand("øgo", brands)?.name, "ØGO");
  assert.equal(matchBrand("DAGO", brands), null);
});

test("short brands match in front text only when allowed", () => {
  const texts = ["ØGO Økologisk basismelblanding", "Ost og kiks"];
  assert.equal(matchBrandInTexts(texts, brands), null);
  assert.equal(matchBrandInTexts(texts, brands, ["ØGO"])?.name, "ØGO");
});

test("longest known brand in the text wins", () => {
  assert.equal(matchBrandInTexts(["EDEKA Herzstücke"], brands)?.name, "EDEKA");
});

test("an unknown brand needs a sure, fully visible logo", () => {
  // DAGO: logoet skåret af ved venstre kant.
  assert.equal(newBrandAllowed(0.95, { x: 0, y: 0.3, width: 0.4, height: 0.2 }), false);
  assert.equal(newBrandAllowed(0.6, { x: 0.3, y: 0.3, width: 0.4, height: 0.2 }), false);
  assert.equal(newBrandAllowed(0.9, { x: 0.3, y: 0.3, width: 0.4, height: 0.2 }), true);
  assert.equal(newBrandAllowed(0.9, null), true);
  assert.equal(newBrandAllowed(undefined), false);
});

test("a cut-off logo counts when the back label or barcode names the same brand", () => {
  assert.equal(brandNameConfirmed("albi", ["Hersteller: albi GmbH & Co. KG, D-88486 Kirchberg"]), true);
  assert.equal(brandNameConfirmed("Albi", ["Albi"]), true);
  assert.equal(brandNameConfirmed("DAGO", ["Økologisk basismelblanding, Netto ØGO"]), false);
  assert.equal(brandNameConfirmed("albi", ["Albani Pilsner"]), false);
  assert.equal(brandNameConfirmed("Dr. Oetker", ["Dr. Oetker GmbH, Bielefeld"]), true);
});
