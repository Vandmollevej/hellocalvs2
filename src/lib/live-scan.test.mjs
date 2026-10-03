// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { countsAsAttempt, labelDone, mergeLabelAttempts, sharpest } from "./live-scan.ts";

const empty = { nutrition: null, ingredients: null };
const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
const read = (overrides) => ({ text: "", confidence: 0, regions: empty, nutrition: null, ingredientsText: null, ...overrides });

test("trinnet er klaret, når feltet er læst lokalt med god sikkerhed", () => {
  assert.equal(labelDone(read({ text: "x", confidence: 80, nutrition: { kcal: 47 } }), "nutrition"), true);
  assert.equal(labelDone(read({ text: "x", confidence: 60, nutrition: { kcal: 47 } }), "nutrition"), false);
  assert.equal(labelDone(read({ text: "x", confidence: 90, regions: { nutrition: box, ingredients: null } }), "nutrition"), false);
  assert.equal(labelDone(read({ text: "x", confidence: 75, ingredientsText: "mælk, laktase" }), "ingredients"), true);
});

test("den bedste aflæsning vinder og låner manglende felter", () => {
  const first = { frame: "a", read: read({ text: "abc", confidence: 65, ingredientsText: "mælk", regions: { nutrition: null, ingredients: box } }) };
  const second = { frame: "b", read: read({ text: "abcd", confidence: 80, nutrition: { kcal: 47 }, regions: { nutrition: box, ingredients: null } }) };
  const merged = mergeLabelAttempts(mergeLabelAttempts(null, first, "nutrition"), second, "nutrition");
  assert.equal(merged.frame, "b");
  assert.deepEqual(merged.read.nutrition, { kcal: 47 });
  assert.equal(merged.read.ingredientsText, "mælk");
  assert.deepEqual(merged.read.regions, { nutrition: box, ingredients: box });
});

test("en sikrere aflæsning uden feltet taber til en med feltet", () => {
  const withField = { frame: "a", read: read({ text: "abc", confidence: 72, nutrition: { kcal: 47 } }) };
  const without = { frame: "b", read: read({ text: "abcdef", confidence: 90 }) };
  assert.equal(mergeLabelAttempts(withField, without, "nutrition").frame, "a");
});

test("tomme billeder tæller ikke som forsøg, og det skarpeste billede vælges", () => {
  assert.equal(countsAsAttempt(read({})), false);
  assert.equal(countsAsAttempt(read({ text: "a" })), true);
  assert.equal(sharpest([{ sharpness: 10 }, { sharpness: 30 }, { sharpness: 20 }]).sharpness, 30);
  assert.equal(sharpest([]), null);
});
