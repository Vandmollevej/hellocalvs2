// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { combineAmounts, personalAmount, roundSuggestedAmount } from "./amount-suggestion-math.ts";

test("egen vane er medianen, ikke gennemsnittet", () => {
  assert.equal(personalAmount([50, 50, 400]), 50);
});

test("nyeste valg vejer mest", () => {
  assert.equal(personalAmount([150, 50]), 150);
});

test("uden data er der intet forslag", () => {
  assert.equal(combineAmounts([], null, 1.5), null);
});

test("kun robotten: robottens tal", () => {
  const result = combineAmounts([], { grams: 150, confidence: 0.8 }, 1.5);
  assert.equal(result.source, "global");
  assert.equal(result.grams, 150);
});

test("egen vane trækker forslaget mod brugerens mængde", () => {
  const one = combineAmounts([50], { grams: 150, confidence: 0.8 }, 1.5);
  const five = combineAmounts([50, 50, 50, 50, 50], { grams: 150, confidence: 0.8 }, 1.5);
  assert.ok(one.grams < 150 && one.grams > 50);
  assert.ok(five.grams < one.grams);
});

test("usikker robot giver brugeren mere vægt", () => {
  const sure = combineAmounts([50], { grams: 150, confidence: 0.9 }, 1.5);
  const unsure = combineAmounts([50], { grams: 150, confidence: 0.1 }, 1.5);
  assert.ok(unsure.grams < sure.grams);
});

test("afrunding til pæne tal", () => {
  assert.equal(roundSuggestedAmount(12.4), 12);
  assert.equal(roundSuggestedAmount(73), 75);
  assert.equal(roundSuggestedAmount(147), 150);
  assert.equal(roundSuggestedAmount(1180), 1200);
});

test("portionsvarer rundes til hele portioner", () => {
  assert.equal(roundSuggestedAmount(700, 450), 900);
  assert.equal(roundSuggestedAmount(100, 450), 450);
});
