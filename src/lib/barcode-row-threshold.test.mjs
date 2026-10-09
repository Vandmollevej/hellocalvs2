// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { thresholdRowLocally } from "./barcode-row-threshold.ts";

const WIDTH = 960;
const LIT = { space: 220, bar: 60 };
// Skygge: alt bliver 45 % så lyst — en hvid flade i skyggen (99) er mørkere
// end en sort streg i lyset (60).
const SHADOW = 0.45;

// Stregmønster (modulbredder) midt på rækken: start-vagt, nogle cifre,
// midter-vagt, flere cifre, slut-vagt. 7 px pr. modul.
const MODULE_PX = 7;
const RUNS = [1, 1, 1, 3, 2, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 2, 1, 4, 1, 1, 1, 1, 1];

function barcodeRow(shadowFrom, rampPx) {
  const row = new Uint8ClampedArray(WIDTH).fill(LIT.space);
  const expected = new Uint8Array(WIDTH);
  const totalModules = RUNS.reduce((sum, run) => sum + run, 0);
  let x = Math.round((WIDTH - totalModules * MODULE_PX) / 2);
  const left = x;
  RUNS.forEach((run, index) => {
    const bar = index % 2 === 0;
    for (let i = 0; i < run * MODULE_PX; i += 1, x += 1) {
      row[x] = bar ? LIT.bar : LIT.space;
      expected[x] = bar ? 1 : 0;
    }
  });
  if (shadowFrom !== null) {
    for (let px = 0; px < WIDTH; px += 1) {
      const t = Math.min(1, Math.max(0, (px - shadowFrom) / rampPx));
      row[px] = Math.round(row[px] * (1 - t * (1 - SHADOW)));
    }
  }
  return { row, expected, left, right: x };
}

function runs(bits, from, to) {
  const out = [];
  let start = from;
  for (let x = from + 1; x <= to; x += 1) {
    if (x === to || bits[x] !== bits[start]) {
      out.push({ dark: bits[start], width: x - start });
      start = x;
    }
  }
  return out;
}

function assertSameBars(actual, expected, left, right) {
  const got = runs(actual, left, right);
  const want = runs(expected, left, right);
  assert.equal(got.length, want.length, `antal løb: ${got.length} ≠ ${want.length}`);
  got.forEach((run, index) => {
    assert.equal(run.dark, want[index].dark, `løb ${index}: farve`);
    assert.ok(Math.abs(run.width - want[index].width) <= 1, `løb ${index}: bredde ${run.width} ≠ ${want[index].width}`);
  });
}

test("stregkode uden skygge læses streg for streg", () => {
  const { row, expected, left, right } = barcodeRow(null, 0);
  assertSameBars(thresholdRowLocally(row, WIDTH), expected, left, right);
});

test("skygge hen over halvdelen af stregkoden ændrer ikke stregerne", () => {
  const { row, expected, left, right } = barcodeRow(WIDTH / 2, 30);
  const bits = thresholdRowLocally(row, WIDTH);
  assertSameBars(bits, expected, left, right);
  // Én fælles tærskel for rækken (midt mellem lysest og mørkest, som ZXing
  // i praksis ender med) fejler på samme række: hvide felter i skyggen
  // bliver sorte.
  const global = (Math.max(...row) + Math.min(...row)) / 2;
  const wrong = Array.from(row).filter((value, x) => x >= left && x < right && (value < global ? 1 : 0) !== expected[x]).length;
  assert.ok(wrong > 20, `global tærskel burde fejle, men kun ${wrong} pixels var forkerte`);
});

test("skarp skyggekant midt i stregkoden", () => {
  const { row, expected, left, right } = barcodeRow(WIDTH / 2, 4);
  assertSameBars(thresholdRowLocally(row, WIDTH), expected, left, right);
});

test("ensfarvede områder bliver hvide, også med støj og mørk baggrund", () => {
  const dark = thresholdRowLocally(new Uint8ClampedArray(WIDTH).fill(30), WIDTH);
  assert.equal(dark.reduce((sum, bit) => sum + bit, 0), 0);
  const noisy = new Uint8ClampedArray(WIDTH);
  for (let x = 0; x < WIDTH; x += 1) noisy[x] = 200 + (x % 5) - 2;
  assert.equal(thresholdRowLocally(noisy, WIDTH).reduce((sum, bit) => sum + bit, 0), 0);
  // Stilhedszonen før og efter stregerne er hvid, så læseren finder start-vagten.
  const { row, left, right } = barcodeRow(null, 0);
  const bits = thresholdRowLocally(row, WIDTH);
  for (let x = 0; x < left; x += 1) assert.equal(bits[x], 0);
  for (let x = right; x < WIDTH; x += 1) assert.equal(bits[x], 0);
});
