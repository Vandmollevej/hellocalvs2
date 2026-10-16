// Kør: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { changedRecheckFields, ingredientsSimilarity, isRecheckDue, recheckDueAt, registrationMacros } from "./product-recheck-rules.ts";

const base = {
  createdAt: new Date("2024-03-01T10:00:00Z"),
  qualityCheckedAt: null,
  privateOwnerId: null,
  discontinued: false,
  deletedAt: null,
  status: "APPROVED",
  pendingFields: [],
};

test("en vare over to år fremstår som ny", () => {
  assert.equal(isRecheckDue(base, new Date("2026-03-01T10:00:00Z")), true);
  assert.equal(isRecheckDue(base, new Date("2026-02-28T10:00:00Z")), false);
});

test("et tjek nulstiller de to år", () => {
  const checked = { ...base, qualityCheckedAt: new Date("2026-03-02T00:00:00Z") };
  assert.equal(recheckDueAt(checked).toISOString(), "2028-03-02T00:00:00.000Z");
  assert.equal(isRecheckDue(checked, new Date("2026-10-15T00:00:00Z")), false);
});

test("private, udgåede, afviste og varer under aflæsning tjekkes ikke", () => {
  const now = new Date("2027-01-01T00:00:00Z");
  assert.equal(isRecheckDue({ ...base, privateOwnerId: "u1" }, now), false);
  assert.equal(isRecheckDue({ ...base, discontinued: true }, now), false);
  assert.equal(isRecheckDue({ ...base, status: "REJECTED" }, now), false);
  assert.equal(isRecheckDue({ ...base, deletedAt: now }, now), false);
  assert.equal(isRecheckDue({ ...base, pendingFields: ["nutrition"] }, now), false);
});

const original = { kcalPer100g: 250, proteinPer100g: 8, carbsPer100g: 30, fatPer100g: 10, ingredientsText: "Hvedemel, sukker, smør, salt" };

test("afrunding på deklarationen er ingen ændring", () => {
  const read = { kcalPer100g: 252, proteinPer100g: 8.2, carbsPer100g: 30.5, fatPer100g: 10, ingredientsText: "HVEDEMEL, sukker, smør, salt." };
  assert.deepEqual(changedRecheckFields(original, read), []);
});

test("ny opskrift: ændret energi, fedt og ingredienser", () => {
  const read = { kcalPer100g: 275, proteinPer100g: 8, carbsPer100g: 30, fatPer100g: 12.5, ingredientsText: "Hvedemel, sukker, palmeolie, salt" };
  assert.deepEqual(changedRecheckFields(original, read), ["kcalPer100g", "fatPer100g", "ingredientsText"]);
});

test("et felt, der ikke kunne læses, er ingen ændring", () => {
  const read = { kcalPer100g: null, proteinPer100g: null, carbsPer100g: null, fatPer100g: null, ingredientsText: null };
  assert.deepEqual(changedRecheckFields(original, read), []);
});

test("ingredienslisternes lighed tæller ord, ikke rækkefølge", () => {
  assert.equal(ingredientsSimilarity("Ingredienser: sukker, salt", "salt og sukker"), 0.8);
  assert.equal(ingredientsSimilarity("sukker, salt", "Salt, sukker"), 1);
});

test("registreringens snapshot regnes for mængden", () => {
  assert.deepEqual(registrationMacros({ kcalPer100g: 200, proteinPer100g: 10, carbsPer100g: 20, fatPer100g: 5 }, 50), {
    kcalSnapshot: 100,
    proteinSnapshot: 5,
    carbsSnapshot: 10,
    fatSnapshot: 2.5,
  });
});
