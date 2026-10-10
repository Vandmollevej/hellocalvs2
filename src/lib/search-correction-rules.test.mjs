// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCorrections, correctableWord, escapeLike, maxEditDistance, splitQueryTokens } from "./search-correction-rules.ts";

test("tilladt afstand vokser med ordets længde", () => {
  assert.equal(maxEditDistance(2), 0);
  assert.equal(maxEditDistance(4), 1);
  assert.equal(maxEditDistance(7), 2);
});

test("kun ord på 3+ tegn uden tal kan rettes", () => {
  assert.equal(correctableWord("ab"), false);
  assert.equal(correctableWord("500g"), false);
  assert.equal(correctableWord("kaffe"), true);
});

test("rettelser erstatter kun de ord, der er rettet", () => {
  assert.equal(applyCorrections("nescfae med mælk", new Map([["nescfae", "nescafe"]])), "nescafe med mælk");
  assert.equal(applyCorrections("kaffe", new Map()), null);
  assert.equal(applyCorrections("kaffe", new Map([["kaffe", "kaffe"]])), null);
});

test("opdeler på mellemrum og escaper LIKE-tegn", () => {
  assert.deepEqual(splitQueryTokens("  kaffe   med mælk "), ["kaffe", "med", "mælk"]);
  assert.equal(escapeLike("100%_x"), "100\\%\\_x");
});
