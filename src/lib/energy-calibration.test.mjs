// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { calibrateMaintenance, calibrationDayKey, calibrationWeight } from "./energy-calibration.ts";

const END = new Date(2026, 8, 29);
function day(offsetFromStart, windowDays = 56) {
  const start = new Date(END.getFullYear(), END.getMonth(), END.getDate() - windowDays);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + offsetFromStart);
}
function intake(days, kcal) {
  const map = new Map();
  for (const d of days) map.set(calibrationDayKey(day(d)), kcal);
  return map;
}
function trend(offsets, startKg, slopePerDay) {
  return offsets.map((d) => ({ dateKey: calibrationDayKey(day(d)), trendKg: startKg + slopePerDay * d }));
}
const ALL = Array.from({ length: 56 }, (_, i) => i);

test("vægten på det lærte vokser fra 14 til 42 loggede dage, højst 0,7", () => {
  assert.equal(calibrationWeight(10), 0);
  assert.equal(calibrationWeight(14), 0);
  assert.equal(calibrationWeight(28), 0.35);
  assert.equal(calibrationWeight(42), 0.7);
  assert.equal(calibrationWeight(56), 0.7);
});

test("for få registreringer eller vejninger → formlen bruges uændret", () => {
  const few = calibrateMaintenance({ formulaKcal: 2500, intakeByDay: intake(ALL.slice(0, 10), 2400), trend: trend(ALL, 90, 0), endExclusive: END, minimumKcal: 1500 });
  assert.equal(few.reason, "NOT_ENOUGH_INTAKE");
  assert.equal(few.usedKcal, 2500);
  const noWeight = calibrateMaintenance({ formulaKcal: 2500, intakeByDay: intake(ALL, 2400), trend: trend([0, 1, 2], 90, 0), endExclusive: END, minimumKcal: 1500 });
  assert.equal(noWeight.reason, "NOT_ENOUGH_WEIGHT");
});

test("stabil vægt og 2.300 kcal/dag lærer 2.300 og blander 70/30 med formlen", () => {
  const c = calibrateMaintenance({ formulaKcal: 2600, intakeByDay: intake(ALL, 2300), trend: trend(ALL, 90, 0), endExclusive: END, minimumKcal: 1500 });
  assert.equal(c.reason, "OK");
  assert.equal(c.learnedKcal, 2300);
  assert.equal(c.weight, 0.7);
  assert.equal(c.usedKcal, Math.round(2600 * 0.3 + 2300 * 0.7));
  assert.equal(c.slopeKgPerWeek, 0);
});

test("vægttab hæver det lærte: −0,5 kg/uge ved 2.000 kcal ≈ 2.550", () => {
  const c = calibrateMaintenance({ formulaKcal: 2600, intakeByDay: intake(ALL, 2000), trend: trend(ALL, 90, -0.5 / 7), endExclusive: END, minimumKcal: 1500 });
  assert.equal(c.reason, "OK");
  assert.ok(Math.abs(c.learnedKcal - 2550) <= 1);
  assert.equal(c.slopeKgPerWeek, -0.5);
});

test("dage under det sunde minimum tælles ikke, og urimelige resultater afvises", () => {
  const map = intake(ALL, 2300);
  for (const d of ALL.slice(0, 20)) map.set(calibrationDayKey(day(d)), 600);
  const c = calibrateMaintenance({ formulaKcal: 2600, intakeByDay: map, trend: trend(ALL, 90, 0), endExclusive: END, minimumKcal: 1500 });
  assert.equal(c.loggedDays, 36);
  const implausible = calibrateMaintenance({ formulaKcal: 2600, intakeByDay: intake(ALL, 1200), trend: trend(ALL, 90, 0), endExclusive: END, minimumKcal: 1000 });
  assert.equal(implausible.reason, "IMPLAUSIBLE");
  assert.equal(implausible.usedKcal, 2600);
});
