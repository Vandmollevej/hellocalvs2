// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateActivityKcal, metFor, metForSpeed } from "./activity-met.ts";

test("MET stiger med intensitet og ukendt sport bruger 'other'", () => {
  assert.ok(metFor("running", "LIGHT") < metFor("running", "VIGOROUS"));
  assert.equal(metFor("badminton", "MODERATE"), metFor("other", "MODERATE"));
});

test("hastighed: gang 5 km/t ≈ 3,7 MET, løb 10 km/t ≈ 10 MET", () => {
  assert.ok(Math.abs(metForSpeed(5) - 3.7) < 0.2);
  assert.ok(Math.abs(metForSpeed(10) - 10) < 0.3);
  assert.equal(metForSpeed(0), 2.8);
  assert.equal(metForSpeed(30), 14.5);
});

test("kcal er netto og afrundet; distance vinder over intensitet for gang/løb", () => {
  // 80 kg, 60 min moderat løb: (8,3 − 1) × 80 = 584 → 585
  const byIntensity = estimateActivityKcal({ sportType: "running", minutes: 60, weightKg: 80, intensity: "MODERATE" });
  assert.equal(byIntensity.method, "INTENSITY");
  assert.equal(byIntensity.kcal, 585);
  const bySpeed = estimateActivityKcal({ sportType: "running", minutes: 60, weightKg: 80, intensity: "LIGHT", distanceKm: 10 });
  assert.equal(bySpeed.method, "SPEED");
  assert.ok(bySpeed.kcal > byIntensity.kcal);
  // Distance ignoreres for andre sportsgrene
  assert.equal(estimateActivityKcal({ sportType: "cycling", minutes: 60, weightKg: 80, distanceKm: 20 }).method, "INTENSITY");
  assert.equal(estimateActivityKcal({ sportType: "running", minutes: 60, weightKg: null }).kcal, null);
});
