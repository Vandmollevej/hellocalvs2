import { test } from "node:test";
import assert from "node:assert/strict";
import {
  awakeHours, stickBuckets, recommendedShares, aheadOfPlan, splitSurplus, walkOptions,
  daysPerBar, groupDays, recommendedRange, cumulative,
} from "./front-charts.ts";

test("vågne timer rundes ned til venstre og op til højre", () => {
  assert.deepEqual(awakeHours("06:45", "22:10"), { start: 6, end: 23 });
  assert.deepEqual(awakeHours("07:00", "00:30"), { start: 7, end: 24 });
  assert.deepEqual(awakeHours(null, null), { start: 7, end: 23 });
});

test("pindediagram giver min/maks pr. tidsrum og tomme huller", () => {
  const at = (h, m) => new Date(2026, 9, 14, h, m);
  const b = stickBuckets([{ value: 60, at: at(7, 1) }, { value: 90, at: at(7, 10) }, { value: 70, at: at(8, 0) }], 7, 9, 30);
  assert.equal(b.length, 4);
  assert.deepEqual(b[0], { index: 0, min: 60, max: 90 });
  assert.equal(b[1], null);
  assert.deepEqual(b[2], { index: 2, min: 70, max: 70 });
});

test("anbefalet fordeling summer til 1", () => {
  const s = recommendedShares(7, 23);
  assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test("forud for planen: kun overskud tæller", () => {
  const shares = recommendedShares(7, 23, 60);
  const none = new Array(shares.length).fill(0);
  assert.equal(aheadOfPlan(none, 2000, shares, 5), 0);
  const heavy = [...none]; heavy[0] = 1500;
  assert.ok(aheadOfPlan(heavy, 2000, shares, 2) > 800);
});

test("overskud deles mellem mindre mad og forbrænding", () => {
  assert.deepEqual(splitSurplus(400), { reduceKcal: 200, burnKcal: 200 });
});

test("gåtur: højere tempo giver kortere tur", () => {
  const [easy, brisk, fast] = walkOptions(300, 80);
  assert.ok(easy.minutes > brisk.minutes && brisk.minutes > fast.minutes);
});

test("dage pr. søjle: dage, få dage, uger", () => {
  assert.equal(daysPerBar(30, 60), 1);
  assert.equal(daysPerBar(90, 45), 2);
  assert.equal(daysPerBar(365, 40), 14);
});

test("gruppering springer umålte dage over og tomme søjler bliver null", () => {
  const days = [
    { day: "a", kcal: 1800 }, { day: "b", kcal: null }, { day: "c", kcal: 2200 },
    { day: "d", kcal: null }, { day: "e", kcal: null },
  ];
  const bars = groupDays(days, 3);
  assert.deepEqual(bars[0], { label: "a", avgKcal: 2000, lowKcal: 1800, highKcal: 2200 });
  assert.equal(bars[1].avgKcal, null);
});

test("anbefalet maks er aldrig under gulvet", () => {
  assert.deepEqual(recommendedRange(1000, 1500), { min: 1500, max: 1500 });
  assert.deepEqual(recommendedRange(2000, 1500), { min: 1700, max: 2000 });
  assert.deepEqual(cumulative([1, 2, 3]), [1, 3, 6]);
});
