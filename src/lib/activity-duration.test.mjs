// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { durationMinutes, endClock, minutesUntil, setStartClock, splitDuration, stepDuration } from "./activity-duration.ts";

test("varighed fra timer + minutter", () => {
  assert.equal(durationMinutes("1", "30"), 90);
  assert.equal(durationMinutes("", "45"), 45);
  assert.equal(durationMinutes("2", ""), 120);
  assert.equal(durationMinutes("1.5", "0"), 90);
  assert.equal(durationMinutes("-1", "10"), 0);
  assert.equal(durationMinutes("x", "10"), 0);
  assert.deepEqual(splitDuration(95), { hours: "1", minutes: "35" });
  assert.deepEqual(splitDuration(0), { hours: "0", minutes: "0" });
});

test("sluttidspunkt følger start + varighed, også over midnat", () => {
  assert.equal(endClock("2026-10-02T17:15", 90), "18:45");
  assert.equal(endClock("2026-10-02T23:30", 60), "00:30");
  assert.equal(endClock("2026-10-02", 60), "");
});

test("nyt sluttidspunkt giver varighed; før start = over midnat", () => {
  assert.equal(minutesUntil("2026-10-02T17:15", "18:00"), 45);
  assert.equal(minutesUntil("2026-10-02T23:30", "00:15"), 45);
  assert.equal(minutesUntil("2026-10-02T17:15", "17:15"), 24 * 60);
  assert.equal(minutesUntil("2026-10-02T17:15", ""), null);
});

test("plus/minus går i hele femminutters trin", () => {
  assert.equal(stepDuration(30, 1), 35);
  assert.equal(stepDuration(33, 1), 35);
  assert.equal(stepDuration(33, -1), 30);
  assert.equal(stepDuration(30, -1), 25);
  assert.equal(stepDuration(5, -1), 5);
  assert.equal(stepDuration(24 * 60, 1), 24 * 60);
});

test("nyt starttidspunkt beholder dagen", () => {
  assert.equal(setStartClock("2026-10-09T09:22", "10:15"), "2026-10-09T10:15");
});
