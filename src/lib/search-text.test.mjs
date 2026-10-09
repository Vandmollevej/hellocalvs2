import { test } from "node:test";
import assert from "node:assert/strict";
import { foldSearchText, searchTokens } from "./search-text.ts";

test("accenter ignoreres, æøå bevares", () => {
  assert.equal(foldSearchText("Nescafé"), "nescafe");
  assert.equal(foldSearchText("Blåbær Øl"), "blåbær øl");
});

test("søgeteksten deles i ord og lange ord mister sidste bogstav", () => {
  assert.deepEqual(searchTokens("Nescafé instant"), ["nescaf", "instan"]);
  assert.deepEqual(searchTokens("gold creme"), ["gold", "crem"]);
});
