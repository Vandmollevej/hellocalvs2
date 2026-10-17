// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareTrending, fictiveScore, readSourcePopularity, sourceScore } from "./trending-score.ts";

test("kildens popularitet læses fra recipeDetails", () => {
  assert.deepEqual(readSourcePopularity({ sourcePopularity: { rating: 4.5, ratingCount: 120 } }), {
    rating: 4.5,
    ratingCount: 120,
    favoriteCount: null,
  });
  assert.equal(readSourcePopularity({}), null);
  assert.equal(readSourcePopularity(null), null);
  assert.equal(readSourcePopularity({ sourcePopularity: { rating: "x" } }), null);
});

test("flere bedømmelser og højere karakter giver højere trender-tal", () => {
  assert.equal(sourceScore(null), null);
  const few = sourceScore({ rating: 4, ratingCount: 5 });
  const many = sourceScore({ rating: 4, ratingCount: 5000 });
  const better = sourceScore({ rating: 5, ratingCount: 5000 });
  assert.ok(many > few);
  assert.ok(better > many);
  assert.ok(better <= 50);
});

test("fiktivt tal er stabilt hele dagen og ligger i 0-19", () => {
  assert.equal(fictiveScore("hf:a", "2026-10-17"), fictiveScore("hf:a", "2026-10-17"));
  for (const key of ["a", "b", "c", "d"]) {
    const score = fictiveScore(key, "2026-10-17");
    assert.ok(score >= 0 && score < 20);
  }
});

test("klik først, så strenge før opfyldning, så energi, så trender-tal", () => {
  const base = { clicks: 0, relaxed: false, hasEnergy: true, trendScore: 0 };
  const list = [
    { ...base, key: "relaxed", relaxed: true, trendScore: 50 },
    { ...base, key: "noEnergy", hasEnergy: false, trendScore: 50 },
    { ...base, key: "low", trendScore: 1 },
    { ...base, key: "high", trendScore: 30 },
    { ...base, key: "clicked", clicks: 2, relaxed: true },
  ].sort(compareTrending);
  assert.deepEqual(list.map((c) => c.key), ["clicked", "high", "low", "noEnergy", "relaxed"]);
});
