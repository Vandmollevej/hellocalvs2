// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIngredientLine, parseRecipeText } from "./recipe-text-parser.ts";

const SAMPLE = `Boller i karry
4 personer

Ingredienser
- 500 g hakket svinekød
2 dl fløde
1 spsk karry
3 fed hvidløg
salt og peber

Fremgangsmåde
1. Brun kødet i en gryde.
2. Tilsæt fløde og karry.
3. Lad det simre i 20 minutter.

Næringsindhold pr. portion
Energi: 520 kcal
Protein: 31 g
Kulhydrat: 12 g
Fedt: 38 g`;

test("ingrediens med mængde omregnes til gram", () => {
  assert.deepEqual(parseIngredientLine("2 dl fløde"), { raw: "2 dl fløde", name: "fløde", amount: 2, unit: "dl", grams: 200 });
  assert.equal(parseIngredientLine("1 spsk karry").grams, 15);
  assert.equal(parseIngredientLine("3 fed hvidløg").grams, null);
  assert.equal(parseIngredientLine("salt og peber").amount, null);
});

test("hel opskrift deles i titel, personer, ingredienser, trin og næring", () => {
  const recipe = parseRecipeText(SAMPLE);
  assert.equal(recipe.title, "Boller i karry");
  assert.equal(recipe.servings, 4);
  assert.equal(recipe.ingredients.length, 5);
  assert.equal(recipe.ingredients[0].grams, 500);
  assert.deepEqual(recipe.steps, ["Brun kødet i en gryde.", "Tilsæt fløde og karry.", "Lad det simre i 20 minutter."]);
  assert.deepEqual(recipe.nutrition, { kcal: 520, protein: 31, carbs: 12, fat: 38, perServing: true });
});
