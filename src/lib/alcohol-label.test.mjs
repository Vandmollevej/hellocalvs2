// Kør: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { alcoholDrinkKcal, parseAlcoholPercent } from "./alcohol-label.ts";

test("alkoholprocenten læses fra emballagens tekst", () => {
  assert.equal(parseAlcoholPercent("Eierlikör 20 % vol 0,5 l"), 20);
  assert.equal(parseAlcoholPercent("alc. 40% vol."), 40);
  assert.equal(parseAlcoholPercent("Alkohol 4,6 %"), 4.6);
  assert.equal(parseAlcoholPercent("15% ABV"), 15);
});

test("andre procenter er ikke alkohol", () => {
  assert.equal(parseAlcoholPercent("Fedt 20 %"), null);
  assert.equal(parseAlcoholPercent("Kakao min. 70 %"), null);
  assert.equal(parseAlcoholPercent(""), null);
});

test("alkoholens energi regnes præcist, resten lægges til", () => {
  // 20 % vol = 15,78 g alkohol = 110 kcal pr. 100 ml.
  assert.equal(alcoholDrinkKcal({ alcoholPercent: 20, carbs: 0, protein: 0, fat: 0 }), 110);
  // Eierlikör: + ca. 27 g sukker, 4 g protein, 5 g fedt.
  assert.equal(alcoholDrinkKcal({ alcoholPercent: 20, carbs: 27, protein: 4, fat: 5 }), 279);
});
