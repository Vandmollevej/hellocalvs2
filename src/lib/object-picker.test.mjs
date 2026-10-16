// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickObjectInFocus } from "./object-picker.ts";

const box = (label, x, y, width, height) => ({ label, x, y, width, height });

test("det objekt, der dækker rammens midte, er varen — det største vinder", () => {
  const carton = box("mælkekarton", 0.2, 0.05, 0.4, 0.9);
  const label = box("etiket", 0.3, 0.4, 0.2, 0.2);
  const bananas = box("bananer", 0.65, 0.3, 0.2, 0.15);
  assert.equal(pickObjectInFocus([bananas, label, carton]), carton);
});

test("ét eller ingen objekter: hele billedet", () => {
  assert.equal(pickObjectInFocus([]), null);
  assert.equal(pickObjectInFocus([box("vare", 0.2, 0.2, 0.5, 0.5)]), null);
});

test("en boks, der er hele billedet, er baggrund og tæller ikke", () => {
  const table = box("bord", 0, 0, 1, 1);
  const carton = box("karton", 0.3, 0.1, 0.3, 0.8);
  const cup = box("kop", 0.7, 0.6, 0.15, 0.2);
  assert.equal(pickObjectInFocus([table, carton, cup]), carton);
  assert.equal(pickObjectInFocus([table, carton]), null);
});

test("dækker intet objekt midten, bruges det nærmeste i rammen", () => {
  const near = box("vare", 0.55, 0.55, 0.2, 0.2);
  const far = box("vare", 0.0, 0.0, 0.1, 0.1);
  assert.equal(pickObjectInFocus([far, near]), near);
  const edgeA = box("a", 0.0, 0.0, 0.1, 0.1);
  const edgeB = box("b", 0.9, 0.9, 0.1, 0.1);
  assert.equal(pickObjectInFocus([edgeA, edgeB]), null);
});
