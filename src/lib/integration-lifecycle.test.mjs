// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeOverTime, keptForLabel, median, uninstallDurations } from "./integration-lifecycle.ts";

const day = (n) => new Date(Date.UTC(2026, 9, 1) + n * 86_400_000);

test("frakobling parres med brugerens seneste tilkobling", () => {
  const events = [
    { userId: "a", type: "CONNECTED", createdAt: day(0) },
    { userId: "b", type: "CONNECTED", createdAt: day(1) },
    { userId: "a", type: "DISCONNECTED", createdAt: day(3) },
    { userId: "a", type: "CONNECTED", createdAt: day(10) },
    { userId: "a", type: "DISCONNECTED", createdAt: day(11) },
    { userId: "c", type: "DISCONNECTED", createdAt: day(12) },
  ];
  assert.deepEqual(uninstallDurations(events), [3, 1]);
  assert.equal(keptForLabel(events, "a", day(11)), "1 dag");
  assert.equal(keptForLabel(events, "a", day(3)), "3 dage");
  assert.equal(keptForLabel(events, "c", day(12)), undefined);
});

test("median", () => {
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 10]), 2.5);
});

test("aktive over tid regnes baglæns fra antallet nu", () => {
  const result = activeOverTime(5, [
    { connected: 2, disconnected: 0 },
    { connected: 0, disconnected: 1 },
    { connected: 1, disconnected: 0 },
  ]);
  assert.equal(result.atStart, 3);
  assert.deepEqual(result.series, [5, 4, 5]);
});
