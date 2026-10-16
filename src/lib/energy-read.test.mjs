// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { energyReadOk, isAiQuotaError } from "./energy-read.ts";

test("energy counts as read only with all four values per 100 g/ml", () => {
  const milk = { basis: "100ml", kcalPer100g: 35, proteinPer100g: 3.5, carbsPer100g: 4.7, fatPer100g: 0.5 };
  assert.equal(energyReadOk(milk), true);
  assert.equal(energyReadOk({ ...milk, fatPer100g: null }), false);
  assert.equal(energyReadOk({ ...milk, basis: "portion" }), false);
  assert.equal(energyReadOk(null), false);
  // 0 kcal er en gyldig aflæsning (fx vand).
  assert.equal(energyReadOk({ basis: "100ml", kcalPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 }), true);
});

test("an alcoholic drink over 1.2 % vol needs no nutrition table", () => {
  assert.equal(energyReadOk({ basis: "unknown", alcoholPercent: 20 }), true);
  assert.equal(energyReadOk({ basis: "unknown", alcoholPercent: 0.5 }), false);
});

test("OpenAI's out-of-credit error is recognised", () => {
  assert.equal(isAiQuotaError('OpenAI-kald fejlede (429): {"error":{"type":"insufficient_quota"}}'), true);
  assert.equal(isAiQuotaError("OpenAI-kald fejlede (500): server error"), false);
});
