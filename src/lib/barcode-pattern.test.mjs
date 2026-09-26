// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { barcodePattern, guardSpanModules } from "./barcode-pattern.ts";

function bitsOf(pattern) {
  const bits = Array(pattern.modules).fill("0");
  for (const bar of pattern.bars) for (let x = bar.x; x < bar.x + bar.width; x += 1) bits[x] = "1";
  return bits.join("");
}

test("EAN-13 re-encodes to its standard 95-module pattern", () => {
  const pattern = barcodePattern("5901234123457", "ean13");
  assert.equal(pattern.modules, 95);
  assert.equal(
    bitsOf(pattern),
    "10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101"
  );
  assert.deepEqual(pattern.digits.map((digit) => digit.char).join(""), "5901234123457");
  assert.equal(guardSpanModules(pattern, "ean13"), 92);
});

test("UPC-A is drawn as EAN-13 with a leading zero but shows its own 12 digits", () => {
  const upca = barcodePattern("036000291452", "upca");
  assert.equal(bitsOf(upca), bitsOf(barcodePattern("0036000291452", "ean13")));
  assert.equal(upca.digits.map((digit) => digit.char).join(""), "036000291452");
});

test("EAN-8 has 67 modules", () => {
  const pattern = barcodePattern("96385074", "ean8");
  assert.equal(pattern.modules, 67);
  assert.equal(guardSpanModules(pattern, "ean8"), 64);
});

test("mismatched codes return null instead of invented bars", () => {
  assert.equal(barcodePattern("123", "ean13"), null);
  assert.equal(barcodePattern("abcdefghijklm", "ean13"), null);
  assert.equal(barcodePattern("21234565", "upce"), null);
});
