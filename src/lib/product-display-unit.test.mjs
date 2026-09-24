// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatProductAmount,
  fromDisplayAmount,
  getProductDisplayUnit,
  normalizeUnit,
  unitFromPackageSize,
} from "./product-display-unit.ts";

const unitAndAmount = (product, baseAmount) =>
  formatProductAmount(baseAmount, getProductDisplayUnit(product));

test("drikkevare med ml viser ml", () => {
  assert.equal(unitAndAmount({ productCategory: "DRINK", packageSizeText: "500 ml" }, 100), "100 ml");
});

test("drikkevare med cl bevarer cl", () => {
  assert.equal(unitAndAmount({ productCategory: "DRINK", packageSizeText: "33cl" }, 330), "33 cl");
  assert.equal(unitAndAmount({ productCategory: "DRINK", packageSizeText: "50 cl" }, 100), "10 cl");
});

test("drikkevare uden enhed falder tilbage til ml", () => {
  assert.equal(unitAndAmount({ productCategory: "DRINK", packageSizeText: null }, 100), "100 ml");
  assert.equal(unitAndAmount({ productCategory: "DRINK", packageSizeText: "1Ltr" }, 100), "100 ml");
});

test("drikkevare med fejlagtigt g viser aldrig gram", () => {
  assert.equal(unitAndAmount({ productCategory: "DRINK", packageSizeText: "250 g" }, 100), "100 ml");
});

test("alle øvrige kategorier viser g", () => {
  for (const productCategory of ["PROCESSED", "GENERIC", "RAW", "INGREDIENT"]) {
    assert.equal(unitAndAmount({ productCategory, packageSizeText: "33 cl" }, 100), "100 g");
  }
});

test("ukendt eller manglende kategori viser g", () => {
  assert.equal(unitAndAmount({}, 100), "100 g");
  assert.equal(unitAndAmount(null, 100), "100 g");
  assert.equal(unitAndAmount({ productCategory: "NOGET_ANDET" }, 100), "100 g");
});

test("plus/minus ændrer tallet men ikke enheden", () => {
  const unit = getProductDisplayUnit({ productCategory: "PROCESSED" });
  assert.deepEqual([100, 110, 120].map((a) => formatProductAmount(a, unit)), ["100 g", "110 g", "120 g"]);
});

test("cl-indtastning gemmes som ml", () => {
  assert.equal(fromDisplayAmount(33, "cl"), 330);
  assert.equal(fromDisplayAmount(100, "ml"), 100);
});

test("normalizeUnit og unitFromPackageSize", () => {
  assert.equal(normalizeUnit(" Gr. "), "g");
  assert.equal(normalizeUnit("centiliter"), "cl");
  assert.equal(normalizeUnit("stk"), null);
  assert.equal(unitFromPackageSize("6 x 33 cl"), "cl");
  assert.equal(unitFromPackageSize("10 Stk"), null);
});
