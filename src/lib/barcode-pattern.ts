// Re-encodes a decoded EAN/UPC barcode into its real bar pattern, so the live
// scan overlay on `/camera?mode=product` can "draw" the exact bars the camera
// just read on top of the physical barcode (design.md §6.11). Pure data — no
// DOM — so the presentational overlay only has to render rectangles.

export type BarcodeSymbology = "ean13" | "ean8" | "upca" | "upce";

export type BarcodeBar = { x: number; width: number; guard: boolean };
export type BarcodeDigit = { char: string; x: number };

export type BarcodePattern = {
  // Total width in modules (the narrowest bar/space unit), guards included.
  modules: number;
  bars: BarcodeBar[];
  // Human-readable digits, each centred at `x` (in modules; may sit in the
  // quiet zone left/right of the bars, like the printed first/last digit).
  digits: BarcodeDigit[];
};

const L_CODES = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R_CODES = L_CODES.map((code) => [...code].map((bit) => (bit === "1" ? "0" : "1")).join(""));
const G_CODES = R_CODES.map((code) => [...code].reverse().join(""));

// First-digit parity of the left half of an EAN-13 (L = odd, G = even).
const EAN13_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLG", "LGLGGL", "LGLGLL", "LGGLGL"];
// UPC-E parity by check digit for number system 0 (E = even/G, O = odd/L);
// number system 1 uses the inverse.
const UPCE_PARITY_NS0 = ["EEEOOO", "EEOEOO", "EEOOEO", "EEOOOE", "EOEEOO", "EOOEEO", "EOOOEE", "EOEOEO", "EOEOOE", "EOOEOE"];

const START_GUARD = "101";
const MIDDLE_GUARD = "01010";
const END_GUARD = "101";
const UPCE_END_GUARD = "010101";

type Segment = { bits: string; guard: boolean };

function digitsOf(code: string): number[] {
  return [...code].map((char) => Number(char));
}

function segmentsToBars(segments: Segment[]): { modules: number; bars: BarcodeBar[] } {
  const bars: BarcodeBar[] = [];
  let x = 0;
  for (const segment of segments) {
    for (const bit of segment.bits) {
      if (bit === "1") {
        const previous = bars[bars.length - 1];
        if (previous && previous.x + previous.width === x && previous.guard === segment.guard) previous.width += 1;
        else bars.push({ x, width: 1, guard: segment.guard });
      }
      x += 1;
    }
  }
  return { modules: x, bars };
}

function digitSlot(start: number, index: number): number {
  return start + index * 7 + 3.5;
}

function ean13Pattern(code: string, displayed: string, symbology: "ean13" | "upca"): BarcodePattern {
  const [first, ...rest] = digitsOf(code);
  const parity = EAN13_PARITY[first];
  const left = rest.slice(0, 6).map((digit, index) => (parity[index] === "L" ? L_CODES[digit] : G_CODES[digit]));
  const right = rest.slice(6).map((digit) => R_CODES[digit]);
  const { modules, bars } = segmentsToBars([
    { bits: START_GUARD, guard: true },
    { bits: left.join(""), guard: false },
    { bits: MIDDLE_GUARD, guard: true },
    { bits: right.join(""), guard: false },
    { bits: END_GUARD, guard: true },
  ]);

  const digits: BarcodeDigit[] =
    symbology === "upca"
      ? [
          { char: displayed[0], x: -4 },
          ...[...displayed.slice(1, 6)].map((char, index) => ({ char, x: digitSlot(3, index + 1) })),
          ...[...displayed.slice(6, 11)].map((char, index) => ({ char, x: digitSlot(50, index) })),
          { char: displayed[11], x: modules + 4 },
        ]
      : [
          { char: displayed[0], x: -4 },
          ...[...displayed.slice(1, 7)].map((char, index) => ({ char, x: digitSlot(3, index) })),
          ...[...displayed.slice(7, 13)].map((char, index) => ({ char, x: digitSlot(50, index) })),
        ];
  return { modules, bars, digits };
}

function ean8Pattern(code: string): BarcodePattern {
  const values = digitsOf(code);
  const { modules, bars } = segmentsToBars([
    { bits: START_GUARD, guard: true },
    { bits: values.slice(0, 4).map((digit) => L_CODES[digit]).join(""), guard: false },
    { bits: MIDDLE_GUARD, guard: true },
    { bits: values.slice(4).map((digit) => R_CODES[digit]).join(""), guard: false },
    { bits: END_GUARD, guard: true },
  ]);
  const digits = [
    ...[...code.slice(0, 4)].map((char, index) => ({ char, x: digitSlot(3, index) })),
    ...[...code.slice(4)].map((char, index) => ({ char, x: digitSlot(36, index) })),
  ];
  return { modules, bars, digits };
}

function upcePattern(code: string): BarcodePattern {
  const values = digitsOf(code);
  const numberSystem = values[0];
  const check = values[7];
  const parity = UPCE_PARITY_NS0[check];
  const data = values.slice(1, 7).map((digit, index) => {
    const even = parity[index] === "E" ? numberSystem === 0 : numberSystem === 1;
    return even ? G_CODES[digit] : L_CODES[digit];
  });
  const { modules, bars } = segmentsToBars([
    { bits: START_GUARD, guard: true },
    { bits: data.join(""), guard: false },
    { bits: UPCE_END_GUARD, guard: true },
  ]);
  const digits = [
    { char: code[0], x: -4 },
    ...[...code.slice(1, 7)].map((char, index) => ({ char, x: digitSlot(3, index) })),
    { char: code[7], x: modules + 4 },
  ];
  return { modules, bars, digits };
}

// Returns null for a code that doesn't fit its symbology (the overlay then
// skips the bar drawing rather than inventing bars).
export function barcodePattern(code: string, symbology: BarcodeSymbology): BarcodePattern | null {
  if (!/^\d+$/.test(code)) return null;
  if (symbology === "ean13" && code.length === 13) return ean13Pattern(code, code, "ean13");
  if (symbology === "upca" && code.length === 12) return ean13Pattern(`0${code}`, code, "upca");
  if (symbology === "ean8" && code.length === 8) return ean8Pattern(code);
  if (symbology === "upce" && code.length === 8 && (code[0] === "0" || code[0] === "1")) return upcePattern(code);
  return null;
}

// Distance in modules between the two ZXing result points of a 1D read: the
// centres of the start and end guard patterns.
export function guardSpanModules(pattern: BarcodePattern, symbology: BarcodeSymbology): number {
  const endGuardWidth = symbology === "upce" ? UPCE_END_GUARD.length : END_GUARD.length;
  return pattern.modules - START_GUARD.length / 2 - endGuardWidth / 2;
}
