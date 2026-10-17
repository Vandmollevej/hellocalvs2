import test from "node:test";
import assert from "node:assert/strict";
import { formatQuantityText } from "./quantity-text.ts";
import { photoFitFor } from "./product-photo-fit.ts";

test("mængde i arkenes stil", () => {
  assert.equal(formatQuantityText("1l"), "1 l");
  assert.equal(formatQuantityText("500ML"), "500 ml");
  assert.equal(formatQuantityText("1,5 Ltr."), "1.5 l");
  assert.equal(formatQuantityText("6x33cl"), "6 x 33 cl");
  assert.equal(formatQuantityText("200 g."), "200 g");
  assert.equal(formatQuantityText("ca 600g"), "ca. 600 g");
  assert.equal(formatQuantityText("1 bakke"), "1 bakke");
  assert.equal(formatQuantityText("  "), null);
});

test("højt foto vises helt, kvadratisk dækker", () => {
  assert.equal(photoFitFor(400, 1000), "contain");
  assert.equal(photoFitFor(1000, 1000), "cover");
  assert.equal(photoFitFor(1100, 1000), "cover");
  assert.equal(photoFitFor(0, 0), "cover");
});
