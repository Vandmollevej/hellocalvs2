// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanExtractedRows, latestDate, normalizeMeal, parseGrams, registrationTime } from "./migration-import.ts";

test("måltider fra MyFitnessPal og Lifesum", () => {
  assert.equal(normalizeMeal("Breakfast"), "breakfast");
  assert.equal(normalizeMeal("Morgenmad"), "breakfast");
  assert.equal(normalizeMeal("Frokost"), "lunch");
  assert.equal(normalizeMeal("Dinner"), "dinner");
  assert.equal(normalizeMeal("Aftensmad"), "dinner");
  assert.equal(normalizeMeal("Snacks"), "snack");
});

test("mængde i gram", () => {
  assert.equal(parseGrams("150 g"), 150);
  assert.equal(parseGrams("2 x 30 g"), 60);
  assert.equal(parseGrams("0,5 l"), 500);
  assert.equal(parseGrams("1 cup"), null);
  assert.equal(parseGrams(null), null);
});

test("rækker renses, total smides væk og dubletter samles", () => {
  const rows = cleanExtractedRows(
    [
      { date: null, meal: "Breakfast", name: "Havregryn ", amountText: "60 g", kcal: 220, protein: 8, carbs: 36, fat: 4, confidence: 0.9 },
      { date: null, meal: "Breakfast", name: "Havregryn", amountText: "60 g", kcal: 220, protein: 8, carbs: 36, fat: 4, confidence: 0.7 },
      { date: "2026-10-01", meal: "Lunch", name: "Total", amountText: null, kcal: 900, protein: null, carbs: null, fat: null, confidence: 1 },
      { date: "2026-10-01", meal: "Lunch", name: "Rugbrød", amountText: null, kcal: null, protein: null, carbs: null, fat: null, confidence: 1 },
    ],
    "2026-10-01",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-10-01");
  assert.equal(rows[0].amountGrams, 60);
  assert.equal(rows[0].confidence, 0.9);
  assert.equal(latestDate([{ date: "2026-09-30" }, { date: "2026-10-02" }], "2026-10-01"), "2026-10-02");
});

test("tidspunkt i dansk tid", () => {
  assert.equal(registrationTime("2026-07-01", "breakfast").toISOString(), "2026-07-01T06:00:00.000Z");
  assert.equal(registrationTime("2026-12-01", "dinner").toISOString(), "2026-12-01T17:00:00.000Z");
});
