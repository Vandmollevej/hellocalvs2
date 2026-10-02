// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPARE_FALLBACK_RATIO,
  COMPARE_START_PERCENT,
  afterCandidates,
  clampPercent,
  compareRatio,
  percentFromKey,
  percentFromPointer,
} from "./photo-compare.ts";

test("clampPercent holder sig inden for 0–100", () => {
  assert.equal(clampPercent(-10), 0);
  assert.equal(clampPercent(140), 100);
  assert.equal(clampPercent(42), 42);
  assert.equal(clampPercent(Number.NaN), COMPARE_START_PERCENT);
});

test("percentFromPointer regner fingerens plads om til procent", () => {
  assert.equal(percentFromPointer(150, 100, 200), 25);
  assert.equal(percentFromPointer(50, 100, 200), 0);
  assert.equal(percentFromPointer(400, 100, 200), 100);
  assert.equal(percentFromPointer(150, 100, 0), COMPARE_START_PERCENT);
});

test("percentFromKey flytter skyderen med piletaster, Page og Home/End", () => {
  assert.equal(percentFromKey(50, "ArrowLeft"), 45);
  assert.equal(percentFromKey(50, "ArrowRight"), 55);
  assert.equal(percentFromKey(2, "ArrowLeft"), 0);
  assert.equal(percentFromKey(50, "PageUp"), 75);
  assert.equal(percentFromKey(50, "Home"), 0);
  assert.equal(percentFromKey(50, "End"), 100);
  assert.equal(percentFromKey(50, "Enter"), null);
});

test("compareRatio bruger billedets mål og falder tilbage uden dem", () => {
  assert.equal(compareRatio(300, 400), 0.75);
  assert.equal(compareRatio(0, 400), COMPARE_FALLBACK_RATIO);
});

test("afterCandidates udelader før-billedet", () => {
  const photos = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    afterCandidates(photos, "b").map((photo) => photo.id),
    ["a", "c"]
  );
});
