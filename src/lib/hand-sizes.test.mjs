// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HAND_SIZE_ITEMS,
  findHandSizeItem,
  formatHandSizeDimensions,
  handSizeImageScale,
  mediumHandSizeGrams,
} from "./hand-sizes.ts";

test("Frida- og butiksnavne kobles på første kommaled", () => {
  assert.equal(findHandSizeItem("Æble, med skræl, rå")?.id, "apple");
  assert.equal(findHandSizeItem("Banan, rå")?.id, "banana");
  assert.equal(findHandSizeItem("Økologiske bananer")?.id, "banana");
  assert.equal(findHandSizeItem("Gulerod, rå")?.id, "carrot");
  assert.equal(findHandSizeItem("Æg, høne, hel, rå")?.id, "egg");
  assert.equal(findHandSizeItem("Æg, høne, hel, kogt")?.id, "egg");
});

test("forarbejdede og andre varer får ingen størrelser", () => {
  assert.equal(findHandSizeItem("Æble, tørret"), null);
  assert.equal(findHandSizeItem("Fersken, i sirup, konserves"), null);
  assert.equal(findHandSizeItem("Gulerod, kogt"), null);
  assert.equal(findHandSizeItem("Æg, høne, æggehvide, rå"), null);
  assert.equal(findHandSizeItem("Æblemost"), null);
  assert.equal(findHandSizeItem("Rugbrød"), null);
  assert.equal(findHandSizeItem(null), null);
});

test("hver vare har stigende gram og mål fra Lille til Stor", () => {
  for (const item of HAND_SIZE_ITEMS) {
    const [s, m, l] = item.sizes;
    assert.ok(s.grams < m.grams && m.grams < l.grams, item.id);
    assert.ok(s.wholeGrams < m.wholeGrams && m.wholeGrams < l.wholeGrams, item.id);
    for (const size of item.sizes) assert.ok(size.grams <= size.wholeGrams, item.id);
    assert.ok(s.diameterCm <= m.diameterCm && m.diameterCm <= l.diameterCm, item.id);
    assert.deepEqual(item.sizes.map((size) => size.key), ["small", "medium", "large"], item.id);
  }
});

test("billedskala følger hel vægt lineært, Stor = 1", () => {
  const apple = findHandSizeItem("Æble");
  assert.equal(handSizeImageScale(apple.sizes[2], apple), 1);
  assert.equal(handSizeImageScale(apple.sizes[0], apple), 135 / 255);
});

test("spiselig vægt = hel vægt minus USDA-spild", () => {
  // Banan Normal: 185 g hel, 36 % skræl → 118 g (USDA's mellemstore banan)
  assert.equal(mediumHandSizeGrams("Banan"), 118);
  // Fersken Normal: 150 g hel, 4 % sten → 144 g
  assert.equal(mediumHandSizeGrams("Fersken"), 144);
  // Æg M: 58 g med skal, 12 % skal → 51 g
  assert.equal(mediumHandSizeGrams("Æg"), 51);
});

test("mål vises som Ø for runde og længde × Ø for aflange", () => {
  assert.equal(formatHandSizeDimensions(findHandSizeItem("Æble").sizes[1]), "Ø7,5 cm");
  assert.equal(formatHandSizeDimensions(findHandSizeItem("Banan").sizes[1]), "19 × Ø3,5 cm");
});
