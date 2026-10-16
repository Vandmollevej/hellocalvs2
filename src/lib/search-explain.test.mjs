import { test } from "node:test";
import assert from "node:assert/strict";
import { matchWord, rankingPoints, reasonList } from "./search-explain.ts";

test("pointene er signal × vægt, tekstmatch × 100", () => {
  const points = rankingPoints(
    { similarity: 0.92, regionalPopularity: 0.5, timeOfDay: 0, brandInQuery: 100 },
    { regionalPopularity: 18, timeOfDay: 4, brandInQuery: 100 },
  );
  assert.deepEqual(points, { similarity: 92, regionalPopularity: 9, brandInQuery: 10000 });
});

test("begrundelsen sorteres efter størst betydning", () => {
  const list = reasonList({ similarity: 92, regionalPopularity: 9, genericVsProduct: -12 });
  assert.deepEqual(list.map((reason) => reason.key), ["similarity", "genericVsProduct", "regionalPopularity"]);
  assert.equal(list[0].label, "Tekstmatch");
});

test("tekstmatch i ord", () => {
  assert.equal(matchWord(100), "præcist navn");
  assert.equal(matchWord(85), "ord i navnet");
  assert.equal(matchWord(60), "ligner (stavetolerance)");
  assert.equal(matchWord(undefined), "svagt match");
});
