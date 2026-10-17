// Kør: npm test  (node --test)
// Stregkode-reserven (brugerens valg 2026-10-17): kun når tallene passer med etiketten.
import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeReserveNutrition, labelEnergyNumbers, nameMatchesFront } from "./ean-reserve-match.ts";

// Telefonens tekstlæsning af Änglamark-letmælkens etiket (2026-10-16).
const letmaelkLabel = "NÆRINGSINDHOLD/100 g:\nENG ris een isseøien 199 KJ (46 keal)\n7 SE hobs 1,59";
const off = { basis: "100ml", kcal: 46, kj: 194.9, protein: 3.5, carbs: 4.7, fat: 1.5 };

test("læser energien trods stavefejl i tekstlæsningen", () => {
  assert.deepEqual(labelEnergyNumbers([letmaelkLabel]), { kcal: [46], kj: [199] });
  assert.deepEqual(labelEnergyNumbers(["Energi 1046 kJ / 250 kcal"]), { kcal: [250], kj: [1046] });
});

test("letmælken: opslaget passer med etiketten", () => {
  assert.equal(judgeReserveNutrition(off, [letmaelkLabel]), "ok");
});

test("afviser opslag, der ikke passer med etiketten eller sig selv", () => {
  assert.equal(judgeReserveNutrition({ ...off, kcal: 64, kj: 268 }, [letmaelkLabel]), "inconsistent");
  assert.equal(judgeReserveNutrition({ ...off, kcal: 46 }, ["Energi 300 kcal"]), "label_mismatch");
  assert.equal(judgeReserveNutrition(off, ["ingen tal her"]), "no_label_energy");
  assert.equal(judgeReserveNutrition({ ...off, fat: null }, [letmaelkLabel]), "incomplete");
  assert.equal(judgeReserveNutrition(null, [letmaelkLabel]), "incomplete");
});

test("navnet bruges kun, når det står på forsiden", () => {
  assert.equal(nameMatchesFront("Letmælk 1,5 %", ["ØKOLOGISK LETMÆLK 1 liter"]), true);
  assert.equal(nameMatchesFront("Sødmælk", ["ØKOLOGISK LETMÆLK"]), false);
  assert.equal(nameMatchesFront("Letmælk", []), false);
});
