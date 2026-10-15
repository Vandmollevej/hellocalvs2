// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchBrand, matchBrandInTexts, newBrandAllowed } from "./brand-match.ts";

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
