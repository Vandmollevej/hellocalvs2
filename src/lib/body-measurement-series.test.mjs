import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBodyMeasurementSeries } from "./body-measurement-series.ts";

const entries = [
  { measuredAt: "2026-09-20T08:00:00Z", waistCm: 90, hipCm: null },
  { measuredAt: "2026-09-10T08:00:00Z", waistCm: 92, hipCm: 100 },
  { measuredAt: "2026-09-27T08:00:00Z", waistCm: 89.4, hipCm: 99 },
];

test("sorterer ældst først og springer tomme mål over", () => {
  const series = buildBodyMeasurementSeries(entries, "hipCm");
  assert.deepEqual(series.points.map((p) => p.value), [100, 99]);
  assert.equal(series.latest, 99);
  assert.equal(series.change, -1);
});

test("ændring rundes til én decimal", () => {
  const series = buildBodyMeasurementSeries(entries, "waistCm");
  assert.deepEqual(series.points.map((p) => p.value), [92, 90, 89.4]);
  assert.equal(series.change, -0.6);
});

test("højst maxPoints seneste målinger", () => {
  const series = buildBodyMeasurementSeries(entries, "waistCm", 2);
  assert.deepEqual(series.points.map((p) => p.value), [90, 89.4]);
});

test("ingen målinger giver tom serie", () => {
  const series = buildBodyMeasurementSeries(entries, "chestCm");
  assert.equal(series.points.length, 0);
  assert.equal(series.latest, null);
  assert.equal(series.change, null);
});
