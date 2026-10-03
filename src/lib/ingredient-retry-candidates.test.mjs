// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { orderIngredientCandidates } from "./ingredient-retry-candidates.ts";

test("separat indholdsfoto: stregkode, energi, så indhold igen", () => {
  const list = orderIngredientCandidates({
    barcodePhotoUrl: "/b.jpg",
    nutritionPhotoUrl: "/n.jpg",
    ingredientsPhotoUrl: "/i.jpg",
    nutritionOcrText: "N",
    ingredientsOcrText: "I",
  });
  assert.deepEqual(
    list.map((c) => [c.url, c.ocrText]),
    [["/b.jpg", undefined], ["/n.jpg", "N"], ["/i.jpg", "I"]],
  );
});

test("liste på energifotoet: stregkode, så energi igen", () => {
  const list = orderIngredientCandidates({ barcodePhotoUrl: "/b.jpg", nutritionPhotoUrl: "/n.jpg", ingredientsPhotoUrl: null });
  assert.deepEqual(list.map((c) => c.url), ["/b.jpg", "/n.jpg"]);
});

test("manglende og ens fotos springes over", () => {
  assert.deepEqual(orderIngredientCandidates({ barcodePhotoUrl: null, nutritionPhotoUrl: null, ingredientsPhotoUrl: null }), []);
  const same = orderIngredientCandidates({ barcodePhotoUrl: "/x.jpg", nutritionPhotoUrl: "/x.jpg", ingredientsPhotoUrl: null });
  assert.equal(same.length, 1);
});
