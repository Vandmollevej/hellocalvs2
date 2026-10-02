// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasProperCutout, rescanStepsFor } from "./product-rescan-offer.ts";

const barcodes = [{ code: "5701234567890" }];

test("Open Food Facts-vare: alle tre felter, indtil den er scannet igen", () => {
  assert.deepEqual(rescanStepsFor({ externalSource: "OPEN_FOOD_FACTS", barcodes, imageUrl: "https://x/y.png" }), [
    "front",
    "nutrition",
    "ingredients",
  ]);
  assert.deepEqual(rescanStepsFor({ externalSource: "OPEN_FOOD_FACTS", barcodes, rescannedAt: "2026-10-02" }), []);
});

test("egen online-vare: kun forsiden, og kun uden fritlagt PNG", () => {
  assert.deepEqual(rescanStepsFor({ externalSource: "REMA1000", barcodes, imageUrl: "/product-images/rema/1.jpg" }), ["front"]);
  assert.deepEqual(rescanStepsFor({ externalSource: "BILKA", barcodes, imageUrl: "/product-images/cutouts/1.PNG?v=2" }), []);
  assert.deepEqual(
    rescanStepsFor({ externalSource: "BILKA", barcodes, imageUrl: "/a.jpg", images: [{ url: "/b.png", tags: ["Cutout"] }] }),
    [],
  );
});

test("intet banner for brugeroprettede, private eller stregkodeløse varer", () => {
  assert.deepEqual(rescanStepsFor({ externalSource: null, barcodes, imageUrl: null }), []);
  assert.deepEqual(rescanStepsFor({ externalSource: "OPEN_FOOD_FACTS", barcodes: [] }), []);
  assert.deepEqual(rescanStepsFor({ externalSource: "OPEN_FOOD_FACTS", barcodes, privateOwnerId: "u1" }), []);
  assert.equal(hasProperCutout({ imageUrl: null }), false);
});
