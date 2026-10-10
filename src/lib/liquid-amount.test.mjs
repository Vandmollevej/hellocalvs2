// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { liquidAmountFor, liquidBaseFromValue, liquidSecondaryText, liquidValue } from "./liquid-amount.ts";

const milk = { id: "letmaelk", group: "maelk", name: "Letmælk", gramsPerDl: 103, keywords: ["letmælk"] };
const flour = { id: "hvedemel", group: "torvarer", name: "Hvedemel", gramsPerDl: 60, keywords: ["mel"] };
const egg = { id: "hele-aeg", group: "aeg", name: "Hele æg", gramsPerDl: 103, keywords: ["æg"] };

test("kun væsker får skiftet", () => {
  assert.equal(liquidAmountFor("g", flour), null);
  assert.equal(liquidAmountFor("g", egg), null);
  assert.equal(liquidAmountFor("g", null), null);
  assert.deepEqual(liquidAmountFor("g", milk), { baseIsVolume: false, volumeUnit: "ml", gramsPerDl: 103 });
  assert.deepEqual(liquidAmountFor("cl", null), { baseIsVolume: true, volumeUnit: "cl", gramsPerDl: 100 });
});

test("drikkevare i ml: gram i hjørnet, og byt om", () => {
  const liquid = liquidAmountFor("ml", milk);
  assert.equal(liquidValue(200, liquid, "volume"), 200);
  assert.equal(liquidSecondaryText(200, liquid, "volume"), "206 g");
  assert.equal(liquidValue(200, liquid, "grams"), 206);
  assert.equal(liquidSecondaryText(200, liquid, "grams"), "200 ml");
  assert.equal(liquidBaseFromValue(103, liquid, "grams"), 100);
});

test("cl og vare gemt i gram", () => {
  const cl = liquidAmountFor("cl", null);
  assert.equal(liquidValue(330, cl, "volume"), 33);
  assert.equal(liquidBaseFromValue(25, cl, "volume"), 250);
  const grams = liquidAmountFor("g", milk);
  assert.equal(liquidValue(103, grams, "volume"), 100);
  assert.equal(liquidBaseFromValue(100, grams, "volume"), 103);
  assert.equal(liquidBaseFromValue(50, grams, "grams"), 50);
});
