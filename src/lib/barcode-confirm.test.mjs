// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { BARCODE_CONFIRM_WINDOW_MS, recordBarcodeSighting } from "./barcode-confirm.ts";

function feed(reads) {
  let history = [];
  return reads.map(([code, at]) => {
    const result = recordBarcodeSighting(history, code, at);
    history = result.history;
    return result.confirmed;
  });
}

test("a single read is never confirmed", () => {
  assert.deepEqual(feed([["5701234567892", 0]]), [false]);
});

test("the same code three times in a row is confirmed on the third read", () => {
  assert.deepEqual(
    feed([
      ["5701234567892", 0],
      ["5701234567892", 90],
      ["5701234567892", 180],
    ]),
    [false, false, true],
  );
});

test("random codes from a striped texture never confirm", () => {
  const codes = ["01234565", "04210009", "96385074", "01234565", "55123457", "04210009"];
  assert.ok(feed(codes.map((code, index) => [code, index * 90])).every((confirmed) => !confirmed));
});

test("reads older than the window don't count", () => {
  const late = BARCODE_CONFIRM_WINDOW_MS + 1;
  assert.deepEqual(
    feed([
      ["5701234567892", 0],
      ["5701234567892", 10],
      ["5701234567892", 10 + late],
    ]),
    [false, false, false],
  );
});

test("other codes in between don't block a real barcode", () => {
  assert.deepEqual(
    feed([
      ["5701234567892", 0],
      ["01234565", 90],
      ["5701234567892", 180],
      ["5701234567892", 270],
    ]),
    [false, false, false, true],
  );
});
