// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { allWordsMatch, compactText, foldText, productDetailsText } from "./search-text-match.ts";

test("accenter og store bogstaver ignoreres", () => {
  assert.equal(foldText("Nescafé GOLD"), "nescafe gold");
});

test("sammensatte ord matcher, skrevet i ét eller flere ord", () => {
  assert.equal(compactText("Instant Kaffe, Gold"), "instantkaffegold");
  assert.ok(allWordsMatch("instantkaffe", "Nescafe Instant Kaffe, Gold Crema"));
  assert.ok(allWordsMatch("instant kaffe", "Instantkaffe koffeinfri"));
});

test("varetypen tæller med: Nescafé instant kaffe finder Gold", () => {
  const details = productDetailsText({ productType: "Instant kaffe", variant: null, subbrand: null, flavor: null });
  assert.ok(allWordsMatch("Nescafé instant kaffe", `Gold Nescafé ${details}`));
  assert.ok(!allWordsMatch("Nescafé instant kaffe", "Gold Nescafé"));
});

test("alle ord skal stå i teksten", () => {
  assert.ok(!allWordsMatch("nescafe te", "Nescafe Instant Kaffe"));
  assert.ok(!allWordsMatch("", "Nescafe"));
});
