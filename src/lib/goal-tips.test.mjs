import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGoalTip, typicalDailyKcal } from "./goal-tips.ts";

const key = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const today = new Date(2026, 9, 9);

test("gennemsnit kræver mindst 5 loggede dage", () => {
  const few = new Map([[key(new Date(2026, 9, 8)), 2000]]);
  assert.equal(typicalDailyKcal(few, today, key), null);
  const many = new Map();
  for (let i = 1; i <= 6; i += 1) many.set(key(new Date(2026, 9, 9 - i)), 2400);
  assert.equal(typicalDailyKcal(many, today, key), 2400);
});

test("tip når sædvanligt indtag ligger over målet", () => {
  const tip = buildGoalTip({ typicalKcal: 2400, goalKcal: 2100, bonusKcal: 0, intakeKcal: 500 });
  assert.equal(tip?.overKcal, 300);
  assert.equal(tip?.walkKm, 5);
  assert.equal(tip?.carrotGrams, 200);
});

test("intet tip under mål, uden historik eller når dagen allerede er overskredet", () => {
  assert.equal(buildGoalTip({ typicalKcal: 2000, goalKcal: 2100, bonusKcal: 0, intakeKcal: 0 }), null);
  assert.equal(buildGoalTip({ typicalKcal: null, goalKcal: 2100, bonusKcal: 0, intakeKcal: 0 }), null);
  assert.equal(buildGoalTip({ typicalKcal: 2400, goalKcal: 2100, bonusKcal: 0, intakeKcal: 2200 }), null);
});
