// A working UPC-E row reader. @zxing/library's own UPCEReader (0.21) never
// returns a result: its decodeMiddle drops the decoded digits (a JS string is
// passed "by reference"), the shared decodeRow checks the EAN checksum and
// end guard instead of the UPC-E ones, and convertUPCEtoUPCA expands char
// codes instead of digits. This reader plugs into ZXing's own OneDReader row
// loop (rows from the middle out, each also tried reversed), so result points
// and orientation behave exactly like the EAN/UPC-A reads.
//
// UPC-E layout (51 modules): start guard 101, six digits of 7 modules whose
// odd/even (L/G) parity encodes the number system + check digit, end guard
// 010101 — followed by a quiet zone.

import { BarcodeFormat, NotFoundException, OneDReader, Result, ResultPoint, type BitArray } from "@zxing/library";

// Run widths (space, bar, space, bar) of the odd-parity ("L") digits 0–9;
// even-parity ("G") digits are the same runs reversed.
const L_RUNS = [
  [3, 2, 1, 1],
  [2, 2, 2, 1],
  [2, 1, 2, 2],
  [1, 4, 1, 1],
  [1, 1, 3, 2],
  [1, 2, 3, 1],
  [1, 1, 1, 4],
  [1, 3, 1, 2],
  [1, 2, 1, 3],
  [3, 1, 1, 2],
];
const G_RUNS = L_RUNS.map((runs) => [...runs].reverse());

// Parity pattern (bit set = G, first digit = most significant bit) for
// number system 0 by check digit; number system 1 is the bitwise inverse.
const NS0_PARITY = [0x38, 0x34, 0x32, 0x31, 0x2c, 0x26, 0x23, 0x2a, 0x29, 0x25];

const MODULES = 51;
const RUNS = 3 + 6 * 4 + 6;
const QUIET_ZONE_MODULES = 3;
// Same tolerances as ZXing's UPC/EAN readers.
const MAX_AVG_VARIANCE = 0.48;
const MAX_INDIVIDUAL_VARIANCE = 0.7;

type Run = { start: number; width: number; bar: boolean };

function runsOf(row: BitArray): Run[] {
  const size = row.getSize();
  const runs: Run[] = [];
  let start = 0;
  for (let x = 1; x <= size; x += 1) {
    if (x === size || row.get(x) !== row.get(start)) {
      runs.push({ start, width: x - start, bar: row.get(start) });
      start = x;
    }
  }
  return runs;
}

// ZXing-style variance of measured run widths against a module pattern,
// as a fraction of a module; Infinity when any single run is too far off.
function variance(widths: number[], pattern: number[]): number {
  const total = widths.reduce((sum, width) => sum + width, 0);
  const patternLength = pattern.reduce((sum, width) => sum + width, 0);
  const unit = total / patternLength;
  let sum = 0;
  for (let index = 0; index < widths.length; index += 1) {
    const difference = Math.abs(widths[index] - pattern[index] * unit);
    if (difference > MAX_INDIVIDUAL_VARIANCE * unit) return Infinity;
    sum += difference;
  }
  return sum / total;
}

export function expandUpcE(code: string): string {
  const [numberSystem, d1, d2, d3, d4, d5, d6, check] = code;
  let body: string;
  if (d6 === "0" || d6 === "1" || d6 === "2") body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${numberSystem}${body}${check}`;
}

export function upcAChecksumValid(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  let sum = 0;
  for (let index = 0; index < 11; index += 1) sum += Number(code[index]) * (index % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(code[11]);
}

function decodeAt(runs: Run[], first: number, rowSize: number): { text: string; left: number; right: number } | null {
  const window = runs.slice(first, first + RUNS);
  if (window.length < RUNS || !window[0].bar) return null;
  const total = window.reduce((sum, run) => sum + run.width, 0);
  const moduleWidth = total / MODULES;

  const before = runs[first - 1];
  if (!before || before.bar || before.width < QUIET_ZONE_MODULES * moduleWidth) return null;
  const after = runs[first + RUNS];
  const end = window[RUNS - 1].start + window[RUNS - 1].width;
  if (!after || after.bar || Math.min(after.width, rowSize - end) < QUIET_ZONE_MODULES * moduleWidth) return null;

  const widths = window.map((run) => run.width);
  if (variance(widths.slice(0, 3), [1, 1, 1]) > MAX_AVG_VARIANCE) return null;
  if (variance(widths.slice(RUNS - 6), [1, 1, 1, 1, 1, 1]) > MAX_AVG_VARIANCE) return null;

  let digits = "";
  let parity = 0;
  for (let digit = 0; digit < 6; digit += 1) {
    const digitWidths = widths.slice(3 + digit * 4, 7 + digit * 4);
    let best = -1;
    let bestVariance = MAX_AVG_VARIANCE;
    for (let value = 0; value < 20; value += 1) {
      const candidate = variance(digitWidths, value < 10 ? L_RUNS[value] : G_RUNS[value - 10]);
      if (candidate < bestVariance) {
        bestVariance = candidate;
        best = value;
      }
    }
    if (best < 0) return null;
    digits += String(best % 10);
    if (best >= 10) parity |= 1 << (5 - digit);
  }

  for (let numberSystem = 0; numberSystem <= 1; numberSystem += 1) {
    for (let check = 0; check < 10; check += 1) {
      const expected = numberSystem === 0 ? NS0_PARITY[check] : ~NS0_PARITY[check] & 0x3f;
      if (expected !== parity) continue;
      const text = `${numberSystem}${digits}${check}`;
      if (!upcAChecksumValid(expandUpcE(text))) return null;
      const startGuardEnd = window[2].start + window[2].width;
      const endGuardStart = window[RUNS - 6].start;
      return { text, left: (window[0].start + startGuardEnd) / 2, right: (endGuardStart + end) / 2 };
    }
  }
  return null;
}

export class UpcEReader extends OneDReader {
  decodeRow(rowNumber: number, row: BitArray): Result {
    const runs = runsOf(row);
    for (let index = 1; index < runs.length; index += 1) {
      const read = decodeAt(runs, index, row.getSize());
      if (read) {
        return new Result(
          read.text,
          new Uint8Array(0),
          0,
          [new ResultPoint(read.left, rowNumber), new ResultPoint(read.right, rowNumber)],
          BarcodeFormat.UPC_E,
          Date.now()
        );
      }
    }
    throw new NotFoundException();
  }
}
