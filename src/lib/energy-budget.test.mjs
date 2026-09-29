// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDailyBudget, maxLossPace } from "./energy-budget.ts";

const adult = { tdeeKcal: 3000, bmrKcal: 1900, weightKg: 95, heightCm: 180, age: 40, sex: "MALE" };

test("vedligehold giver energibehovet uden justeringer", () => {
  const budget = computeDailyBudget({ ...adult, mode: "MAINTAIN" });
  assert.equal(budget.budgetKcal, 3000);
  assert.equal(budget.deltaKcal, 0);
  assert.deepEqual(budget.adjustments, []);
});

test("0,5 kg/uge ≈ 550 kcal underskud og uger til mål", () => {
  const budget = computeDailyBudget({ ...adult, mode: "LOSE", targetWeightKg: 80, paceKgPerWeek: 0.5 });
  assert.equal(budget.deltaKcal, -550);
  assert.equal(budget.budgetKcal, 2450);
  assert.equal(budget.weeksToTarget, 30);
  assert.deepEqual(budget.adjustments, []);
});

test("tempo over 0,5 kg/uge begrænses, medmindre BMI ≥ 30", () => {
  const normal = computeDailyBudget({ ...adult, mode: "LOSE", paceKgPerWeek: 0.75 });
  assert.equal(normal.paceKgPerWeek, 0.5);
  assert.ok(normal.adjustments.includes("PACE_CAPPED"));
  const obese = computeDailyBudget({ ...adult, weightKg: 110, tdeeKcal: 4200, mode: "LOSE", paceKgPerWeek: 0.75 });
  assert.equal(obese.paceKgPerWeek, 0.75);
  assert.deepEqual(obese.adjustments, []);
  assert.equal(maxLossPace({ weightKg: 45, heightCm: 175 }), 0.25);
});

test("20 % af energibehovet slår ind før 0,5 kg/uge ved lavt behov", () => {
  // 0,5 kg/uge = 550, men 20 % af 2.600 er 520
  const budget = computeDailyBudget({ tdeeKcal: 2600, bmrKcal: 1700, weightKg: 90, heightCm: 180, age: 40, sex: "MALE", mode: "LOSE", paceKgPerWeek: 0.5 });
  assert.equal(budget.deltaKcal, -520);
  assert.equal(budget.paceKgPerWeek, 0.47);
  assert.ok(budget.adjustments.includes("DEFICIT_CAPPED_SHARE"));
});

test("underskud højst 20 % og aldrig under gulvet", () => {
  const small = computeDailyBudget({ tdeeKcal: 1800, bmrKcal: 1300, weightKg: 80, heightCm: 165, age: 35, sex: "FEMALE", mode: "LOSE", paceKgPerWeek: 0.5 });
  // 0,5 kg/uge ville være 550, men 20 % af 1800 er 360
  assert.equal(small.deltaKcal, -360);
  assert.ok(small.adjustments.includes("DEFICIT_CAPPED_SHARE"));

  const low = computeDailyBudget({ tdeeKcal: 1400, bmrKcal: 1150, weightKg: 58, heightCm: 165, age: 35, sex: "FEMALE", mode: "LOSE", paceKgPerWeek: 0.25 });
  assert.equal(low.budgetKcal, 1200);
  assert.ok(low.adjustments.includes("FLOOR_APPLIED"));

  const highBmr = computeDailyBudget({ tdeeKcal: 2000, bmrKcal: 1900, weightKg: 100, heightCm: 190, age: 30, sex: "MALE", mode: "LOSE", paceKgPerWeek: 0.5 });
  assert.equal(highBmr.budgetKcal, 1900);
  assert.ok(highBmr.adjustments.includes("BMR_FLOOR_APPLIED"));
});

test("normalvægt giver kun langsomt tempo; undervægt ingen vægttab", () => {
  const normal = computeDailyBudget({ tdeeKcal: 2300, bmrKcal: 1500, weightKg: 70, heightCm: 178, age: 30, sex: "MALE", mode: "LOSE", paceKgPerWeek: 0.5 });
  assert.equal(normal.paceKgPerWeek, 0.25);
  assert.ok(normal.adjustments.includes("PACE_SLOW_NORMAL_WEIGHT"));

  const under = computeDailyBudget({ tdeeKcal: 2000, bmrKcal: 1400, weightKg: 55, heightCm: 178, age: 30, sex: "FEMALE", mode: "LOSE", paceKgPerWeek: 0.25 });
  assert.equal(under.deltaKcal, 0);
  assert.ok(under.adjustments.includes("UNDERWEIGHT_NO_LOSS"));
});

test("vægtmål under BMI 20 hæves", () => {
  const budget = computeDailyBudget({ ...adult, mode: "LOSE", targetWeightKg: 55, paceKgPerWeek: 0.5 });
  assert.equal(budget.targetWeightKg, 64.8);
  assert.ok(budget.adjustments.includes("TARGET_RAISED_TO_MIN_BMI"));
});

test("børn får aldrig underskud", () => {
  const child = computeDailyBudget({ tdeeKcal: 2200, bmrKcal: 1400, weightKg: 60, heightCm: 165, age: 15, sex: "MALE", mode: "LOSE", paceKgPerWeek: 0.5 });
  assert.equal(child.budgetKcal, 2200);
  assert.ok(child.adjustments.includes("CHILD_NO_DEFICIT"));
});

test("vægtøgning højst 0,25 kg/uge", () => {
  const gain = computeDailyBudget({ ...adult, mode: "GAIN", paceKgPerWeek: 0.5 });
  assert.equal(gain.paceKgPerWeek, 0.25);
  assert.equal(gain.deltaKcal, 275);
  assert.ok(gain.adjustments.includes("GAIN_PACE_CAPPED"));
});
