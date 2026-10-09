import assert from "node:assert/strict";
import { test } from "node:test";
import { clampMeasureText, measureTextLines, suggestMeasureText } from "./custom-measure-text.ts";

test("clampMeasureText holder 2 linjer a 15 tegn", () => {
  assert.equal(clampMeasureText("a".repeat(20)), "a".repeat(15));
  assert.equal(clampMeasureText("et\nto\ntre"), "et\nto");
});

test("measureTextLines dropper tomme linjer", () => {
  assert.deepEqual(measureTextLines("Kalorier\n  "), ["Kalorier"]);
});

test("suggestMeasureText deler lange etiketter i to linjer", () => {
  assert.equal(suggestMeasureText("Skridt"), "Skridt");
  assert.equal(suggestMeasureText("Kalorier indtaget i dag"), "Kalorier\nindtaget i dag");
  for (const line of suggestMeasureText("Kalorier forbrændt ved sport").split("\n")) {
    assert.ok(line.length <= 15);
  }
});
