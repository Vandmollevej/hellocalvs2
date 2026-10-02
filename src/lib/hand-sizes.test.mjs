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
    assert.ok(s.diameterCm <= m.diameterCm && m.diameterCm <= l.diameterCm, item.id);
    assert.deepEqual(item.sizes.map((size) => size.key), ["small", "medium", "large"], item.id);
  }
});

test("billedskala følger gram lineært, Stor = 1", () => {
  const apple = findHandSizeItem("Æble");
  assert.equal(handSizeImageScale(apple.sizes[2], apple), 1);
  assert.equal(handSizeImageScale(apple.sizes[0], apple), 120 / 230);
  assert.equal(mediumHandSizeGrams("Æble"), 165);
});

test("mål vises som Ø for runde og længde × Ø for aflange", () => {
  assert.equal(formatHandSizeDimensions(findHandSizeItem("Æble").sizes[1]), "Ø7,5 cm");
  assert.equal(formatHandSizeDimensions(findHandSizeItem("Banan").sizes[1]), "19 × Ø3,5 cm");
});
