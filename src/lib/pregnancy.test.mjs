// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentBreastfeedingWeeks, currentPregnancyWeek, pregnancyInfo, trimesterForWeek } from "./pregnancy.ts";

const now = new Date("2026-10-14T12:00:00Z");
const weeksAgo = (n) => new Date(now.getTime() - n * 7 * 24 * 3600 * 1000);

test("trimester følger ugen: 1–13, 14–27, 28+", () => {
  assert.equal(trimesterForWeek(1), 1);
  assert.equal(trimesterForWeek(13), 1);
  assert.equal(trimesterForWeek(14), 2);
  assert.equal(trimesterForWeek(27), 2);
  assert.equal(trimesterForWeek(28), 3);
  assert.equal(trimesterForWeek(42), 3);
});

test("ugen regnes frem fra den gemte dato og stopper ved 42", () => {
  assert.equal(currentPregnancyWeek(10, weeksAgo(3), now), 13);
  assert.equal(currentPregnancyWeek(40, weeksAgo(5), now), 42);
  assert.equal(currentPregnancyWeek(10, null, now), 10);
  assert.equal(currentPregnancyWeek(null, weeksAgo(3), now), null);
  assert.equal(currentBreastfeedingWeeks(4, weeksAgo(2), now), 6);
  assert.equal(currentBreastfeedingWeeks(null, null, now), 0);
});

test("gravid: EFSA-tillæg 70 / 260 / 500 kcal pr. trimester", () => {
  const t1 = pregnancyInfo({ pregnancyStatus: "PREGNANT", pregnancyWeek: 8, breastfeedingWeeks: null, pregnancyStatusUpdatedAt: now }, now);
  assert.deepEqual(t1, { status: "PREGNANT", week: 8, trimester: 1, breastfeedingWeeks: null, extraKcal: 70 });
  const t2 = pregnancyInfo({ pregnancyStatus: "PREGNANT", pregnancyWeek: 12, breastfeedingWeeks: null, pregnancyStatusUpdatedAt: weeksAgo(8) }, now);
  assert.equal(t2.week, 20);
  assert.equal(t2.trimester, 2);
  assert.equal(t2.extraKcal, 260);
  const t3 = pregnancyInfo({ pregnancyStatus: "PREGNANT", pregnancyWeek: 30, breastfeedingWeeks: null, pregnancyStatusUpdatedAt: now }, now);
  assert.equal(t3.extraKcal, 500);
  // Ukendt uge: det højeste tillæg, så målet aldrig bliver for lavt.
  const unknown = pregnancyInfo({ pregnancyStatus: "PREGNANT", pregnancyWeek: null, breastfeedingWeeks: null, pregnancyStatusUpdatedAt: null }, now);
  assert.equal(unknown.trimester, 3);
  assert.equal(unknown.extraKcal, 500);
});

test("ammer: 500 kcal de første 26 uger, derefter 300", () => {
  const full = pregnancyInfo({ pregnancyStatus: "BREASTFEEDING", pregnancyWeek: null, breastfeedingWeeks: 3, pregnancyStatusUpdatedAt: now }, now);
  assert.deepEqual(full, { status: "BREASTFEEDING", week: null, trimester: null, breastfeedingWeeks: 3, extraKcal: 500 });
  const partial = pregnancyInfo({ pregnancyStatus: "BREASTFEEDING", pregnancyWeek: null, breastfeedingWeeks: 20, pregnancyStatusUpdatedAt: weeksAgo(6) }, now);
  assert.equal(partial.breastfeedingWeeks, 26);
  assert.equal(partial.extraKcal, 300);
});

test("hverken gravid eller ammende giver null", () => {
  assert.equal(pregnancyInfo({ pregnancyStatus: null, pregnancyWeek: 10, breastfeedingWeeks: null, pregnancyStatusUpdatedAt: now }, now), null);
  assert.equal(pregnancyInfo(null, now), null);
});
