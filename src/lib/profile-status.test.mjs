import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMeasurementHistory,
  buildWeightHistory,
  currentWeightKg,
  remainingToGoalKg,
} from "./profile-status.ts";

const weights = [
  { id: "b", weightKg: 81.2, weighedAt: "2026-09-20T07:00:00Z" },
  { id: "a", weightKg: 82, weighedAt: "2026-09-10T07:00:00Z" },
  { id: "c", weightKg: 80.4, weighedAt: "2026-09-30T07:00:00Z" },
];

test("vægthistorik sorteres ældst først", () => {
  assert.deepEqual(buildWeightHistory(weights).map((p) => p.id), ["a", "b", "c"]);
});

test("nuværende vægt er seneste vejning, ellers start-vægten", () => {
  assert.equal(currentWeightKg(buildWeightHistory(weights), 90), 80.4);
  assert.equal(currentWeightKg([], 90), 90);
  assert.equal(currentWeightKg([], null), null);
});

test("kropsmål tager alle målinger med (ingen 10-punkts-grænse)", () => {
  const entries = Array.from({ length: 14 }, (_, i) => ({
    measuredAt: new Date(Date.UTC(2026, 8, i + 1)).toISOString(),
    waistCm: 90 - i * 0.1,
  }));
  assert.equal(buildMeasurementHistory(entries, "waistCm").length, 14);
  assert.equal(buildMeasurementHistory(entries, "hipCm").length, 0);
});

test("kg til målet rundes til én decimal", () => {
  assert.equal(remainingToGoalKg(80.44, 75), 5.4);
  assert.equal(remainingToGoalKg(70, 75), -5);
  assert.equal(remainingToGoalKg(70, null), null);
});
