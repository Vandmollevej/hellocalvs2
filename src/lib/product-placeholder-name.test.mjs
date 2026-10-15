// Kør: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderProductName, placeholderProductName } from "./product-placeholder-name.ts";

test("reservenavnet genkendes", () => {
  assert.equal(isPlaceholderProductName(placeholderProductName("40157818")), true);
  assert.equal(isPlaceholderProductName("Vare 5701234567890"), true);
});

test("rigtige varenavne er ikke reservenavne", () => {
  assert.equal(isPlaceholderProductName("Æggelikør"), false);
  assert.equal(isPlaceholderProductName("Vare 12"), false);
  assert.equal(isPlaceholderProductName(null), false);
});
