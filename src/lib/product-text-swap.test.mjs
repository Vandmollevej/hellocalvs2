// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyProductTexts, productTextsFor, swapProductTexts, translationPlacement } from "./product-text-swap.ts";

const translated = {
  id: "p1",
  name: "Stærk chilisauce",
  variant: "Signatur",
  packageSizeText: "248 g",
  brand: { name: "Fansaoguang", logoUrl: "x.png" },
  kcalPer100g: 167,
};
const info = {
  showing: "translated",
  sourceLanguageName: "kinesisk",
  targetLanguageName: "dansk",
  alternate: { name: "香辣酱", variant: "招牌", packageSizeText: "净含量：248克", brand: "饭扫光" },
};

test("Vis original bytter felterne og husker oversættelsen", () => {
  const original = swapProductTexts(translated, info);
  assert.equal(original.product.name, "香辣酱");
  assert.equal(original.product.brand.name, "饭扫光");
  assert.equal(original.product.brand.logoUrl, "x.png");
  assert.equal(original.product.kcalPer100g, 167);
  assert.equal(original.translation.showing, "original");
  assert.equal(original.translation.alternate.name, "Stærk chilisauce");

  const back = swapProductTexts(original.product, original.translation);
  assert.deepEqual(back.product, translated);
  assert.equal(back.translation.showing, "translated");
});

test("brand uden brand på varen og ukendte felter", () => {
  const noBrand = applyProductTexts({ name: "a", brand: null }, { brand: "b", name: "c" });
  assert.equal(noBrand.brand, null);
  assert.equal(noBrand.name, "c");
  assert.deepEqual(productTextsFor({ name: "a", brand: null, variant: 3 }, ["name", "brand", "variant"]), {
    name: "a",
    brand: null,
    variant: null,
  });
});

test("Kun ingredienserne oversat: linjen står over ingredienslisten", () => {
  const original = { name: "Oat Drink Barista", packageSizeText: "1 L", ingredientsText: "Vatten, havre 10 %" };
  assert.equal(
    translationPlacement(original, { name: "oat drink  barista", packageSizeText: "1 L", ingredientsText: "Vand, havre 10 %" }),
    "ingredients",
  );
  assert.equal(translationPlacement(original, { ...original, name: "Havredrik Barista" }), "title");
  assert.equal(translationPlacement(original, { ...original }), null);
});
