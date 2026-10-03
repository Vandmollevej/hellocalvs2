// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { triggerMatches } from "./ad-trigger.ts";

test("spot uden trigger passer altid", () => {
  assert.equal(triggerMatches({ triggerCategory: null, triggerProductType: null }, {}), true);
});
test("kategori og produkttype skal begge passe, uanset store/små bogstaver", () => {
  const spot = { triggerCategory: "PROCESSED", triggerProductType: "Skyr" };
  assert.equal(triggerMatches(spot, { category: "PROCESSED", productType: "skyr" }), true);
  assert.equal(triggerMatches(spot, { category: "DRINK", productType: "Skyr" }), false);
  assert.equal(triggerMatches(spot, { category: "PROCESSED" }), false);
  assert.equal(triggerMatches(spot, {}), false);
});
