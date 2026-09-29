// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetForDate, isoDayKey, localDayAsUtc, makeBudgetLookup } from "./daily-budget.ts";

const snapshots = [
  { date: "2026-09-29", budgetKcal: 2450 },
  { date: "2026-10-05", budgetKcal: 2300 },
];

test("dage før første snapshot beholder det gamle mål", () => {
  assert.equal(budgetForDate(snapshots, new Date(2026, 8, 28), 3299), 3299);
  assert.equal(makeBudgetLookup(snapshots, 3299)(new Date(2026, 0, 1)), 3299);
});

test("egen snapshot vinder, ellers bæres den seneste frem", () => {
  assert.equal(budgetForDate(snapshots, new Date(2026, 8, 29), 3299), 2450);
  assert.equal(budgetForDate(snapshots, new Date(2026, 9, 2), 3299), 2450);
  assert.equal(budgetForDate(snapshots, new Date(2026, 9, 5), 3299), 2300);
  assert.equal(budgetForDate(snapshots, new Date(2027, 0, 1), 3299), 2300);
  const lookup = makeBudgetLookup([...snapshots].reverse(), 3299);
  assert.equal(lookup(new Date(2026, 9, 2)), 2450);
});

test("dagsnøglen er lokal kalenderdato", () => {
  assert.equal(isoDayKey(new Date(2026, 0, 5)), "2026-01-05");
});

test("snapshot-datoen følger telefonens tidszone", () => {
  // 23:30 UTC den 29. er 01:30 dansk sommertid den 30.
  const now = new Date(Date.UTC(2026, 8, 29, 23, 30));
  assert.equal(localDayAsUtc(now, 120).toISOString().slice(0, 10), "2026-09-30");
  assert.equal(localDayAsUtc(now, 0).toISOString().slice(0, 10), "2026-09-29");
  assert.equal(localDayAsUtc(now, -300).toISOString().slice(0, 10), "2026-09-29");
});
