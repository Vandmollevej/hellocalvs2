// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayRef, partOfDay, pendingWeighIns } from "./weigh-in-prompt.ts";

// Torsdag 8. oktober 2026, 09:00 lokal tid.
const now = new Date(2026, 9, 8, 9, 0);
const at = (d, h) => new Date(2026, 9, d, h, 0).toISOString();

test("kun smartvægt-vejninger uden svar, højst tilbage til sidste uges mandag", () => {
  const items = pendingWeighIns(
    [
      { id: "a", weightKg: 80, weighedAt: at(8, 7), source: "WITHINGS", clothing: null },
      { id: "b", weightKg: 80, weighedAt: at(7, 7), source: "WITHINGS", clothing: "NAKED" },
      { id: "c", weightKg: 80, weighedAt: at(7, 8), source: "MANUAL", clothing: null },
      { id: "d", weightKg: 80, weighedAt: at(5, 20), source: "WITHINGS", clothing: null },
      { id: "e", weightKg: 80, weighedAt: at(1, 20), source: "WITHINGS", clothing: null },
      { id: "f", weightKg: 80, weighedAt: new Date(2026, 8, 27, 20).toISOString(), source: "WITHINGS", clothing: null },
    ],
    now
  );
  assert.deepEqual(items.map((i) => i.id), ["e", "d", "a"]);
});

test("dag og tidspunkt omtales som i går, ugedag, sidste uge eller dato", () => {
  assert.deepEqual(dayRef(new Date(2026, 9, 8, 7), now), { kind: "today" });
  assert.deepEqual(dayRef(new Date(2026, 9, 7, 7), now), { kind: "yesterday" });
  assert.deepEqual(dayRef(new Date(2026, 9, 5, 7), now), { kind: "thisWeek", weekday: 0 });
  assert.deepEqual(dayRef(new Date(2026, 9, 1, 7), now), { kind: "lastWeek", weekday: 3 });
  assert.equal(dayRef(new Date(2026, 8, 20, 7), now).kind, "date");
  assert.equal(partOfDay(new Date(2026, 9, 8, 7)), "morning");
  assert.equal(partOfDay(new Date(2026, 9, 8, 15)), "afternoon");
  assert.equal(partOfDay(new Date(2026, 9, 8, 21)), "evening");
});
