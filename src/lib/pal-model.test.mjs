// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateBasePal,
  estimateDailyEnergy,
  levelForPal,
  netActivityKcal,
  questionnairePal,
  trainingAllowanceKcalPerDay,
} from "./pal-model.ts";

const answers = (partial) => ({ version: 1, work: null, walkStand: null, transport: null, steps: null, training: null, ...partial });

test("eksempelprofilerne fra docs/ACTIVITY-PAL.md rammer deres niveau", () => {
  // Kontor + bil + under 1 t gang → Stillesiddende
  assert.equal(levelForPal(questionnairePal({ work: "SITTING", walkStand: "UNDER_1", transport: "MOTORIZED" })), "LOW");
  // Kontor + cykling + 2–4 t gang → Almindeligt aktiv
  assert.equal(levelForPal(questionnairePal({ work: "MOSTLY_SITTING", walkStand: "H2_4", transport: "REGULAR_ACTIVE" })), "MODERATE");
  // Butik + 4–6 t stående → Meget aktiv
  assert.equal(levelForPal(questionnairePal({ work: "MOSTLY_STANDING", walkStand: "H4_6", transport: "SOME_WALKING" })), "HIGH");
  // Tungt arbejde + over 6 t + aktiv transport → Ekstremt aktiv
  assert.equal(levelForPal(questionnairePal({ work: "PHYSICAL", walkStand: "OVER_6", transport: "DAILY_ACTIVE" })), "VERY_HIGH");
});

test("PAL holder sig inden for 1,2–2,0 og er null uden svar", () => {
  assert.equal(questionnairePal({ work: null, walkStand: null, transport: null }), null);
  const max = questionnairePal({ work: "PHYSICAL", walkStand: "OVER_6", transport: "DAILY_ACTIVE" });
  assert.ok(max <= 2.0);
  assert.equal(questionnairePal({ work: "SITTING", walkStand: null, transport: null }), 1.4);
});

test("skridt trækker PAL mod skridt-tallet, mere når de er målt", () => {
  const base = answers({ work: "SITTING", walkStand: "UNDER_1", transport: "MOTORIZED" });
  const self = estimateBasePal({ ...base, steps: "K10_15" });
  const measured = estimateBasePal({ ...base, steps: "K10_15", stepsMeasured: true });
  assert.ok(self.pal > 1.4 && self.pal < measured.pal);
  assert.equal(self.uncertainty, 0.1);
  // "Ved ikke" → kun spørgeskema, større usikkerhed
  const unknown = estimateBasePal(base);
  assert.equal(unknown.pal, 1.4);
  assert.equal(unknown.uncertainty, 0.15);
  assert.equal(estimateBasePal(answers({})), null);
});

test("niveaugrænserne ligger midt i kildernes huller", () => {
  assert.equal(levelForPal(1.39), "VERY_LOW");
  assert.equal(levelForPal(1.4), "LOW");
  assert.equal(levelForPal(1.54), "LOW");
  assert.equal(levelForPal(1.55), "MODERATE");
  assert.equal(levelForPal(1.75), "HIGH");
  assert.equal(levelForPal(1.95), "VERY_HIGH");
});

test("MET regnes netto: hvilestofskiftet tælles ikke to gange", () => {
  // 4 MET, 80 kg, 1 time: brutto 320, netto 240
  assert.equal(netActivityKcal(4, 80, 60), 240);
  assert.equal(netActivityKcal(1, 80, 60), 0);
  assert.equal(netActivityKcal(4, 0, 60), 0);
});

test("træningstillæg er ugens netto-kcal delt på 7", () => {
  // 3 × 45 min moderat (4,5 MET) ved 80 kg: (3,5 × 80 × 0,75) × 3 / 7 = 90
  assert.equal(trainingAllowanceKcalPerDay({ sessionsPerWeek: 3, sessionMinutes: 45, intensity: "MODERATE" }, 80), 90);
  assert.equal(trainingAllowanceKcalPerDay(null, 80), 0);
  assert.equal(trainingAllowanceKcalPerDay({ sessionsPerWeek: 3, sessionMinutes: 45, intensity: "MODERATE" }, null), 0);
  assert.equal(trainingAllowanceKcalPerDay({ sessionsPerWeek: 0, sessionMinutes: 45, intensity: "MODERATE" }, 80), 0);
});

test("dagens energibehov: tillæg, logget erstatter tillæg, målt erstatter alt", () => {
  const base = { bmr: 1700, pal: 1.5, palUncertainty: 0.1, trainingAllowanceKcal: 200 };
  const allowance = estimateDailyEnergy(base);
  assert.equal(allowance.method, "ALLOWANCE");
  assert.equal(allowance.kcal, 2750);
  assert.ok(allowance.low < allowance.kcal && allowance.high > allowance.kcal);
  assert.equal(allowance.kcal % 10, 0);

  const logged = estimateDailyEnergy({ ...base, loggedActivityKcal: 400 });
  assert.equal(logged.method, "LOGGED");
  assert.equal(logged.kcal, 2950);

  const measured = estimateDailyEnergy({ ...base, loggedActivityKcal: 400, measuredActiveKcal: 900 });
  assert.equal(measured.method, "MEASURED");
  assert.equal(measured.kcal, 2600);

  const plain = estimateDailyEnergy({ bmr: 1700, pal: 1.5 });
  assert.equal(plain.method, "BASELINE");
  assert.equal(plain.kcal, 2550);
});
