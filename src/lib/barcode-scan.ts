// Geometry helpers for the live barcode-scan guide overlay on
// `/camera?mode=product` ("Stregkode" tab). Kept separate from the
// presentational component (`src/components/hf/BarcodeScanOverlay.tsx`) and
// from the page's state/wiring, per AGENTS.md "keep business logic out of UI
// components".

export type FractionRect = { left: number; top: number; right: number; bottom: number };

// The on-screen guide box a user must align a barcode inside, as a fraction
// of the (square) camera viewfinder — 2.2:1, per the user's measured
// barcode-aspect brief.
export const BARCODE_GUIDE_ASPECT = 2.2;
export const BARCODE_GUIDE_WIDTH_FRACTION = 0.78;

// Whether the guide box is laid out for a barcode held normally
// ("horizontal", long side across) or on its side ("vertical", long side
// upright) — flipped automatically once a barcode is read on its side
// (see `orientationFromPose`).
export type BarcodeOrientation = "horizontal" | "vertical";

export function barcodeGuideBoxFraction(orientation: BarcodeOrientation = "horizontal"): FractionRect {
  const long = BARCODE_GUIDE_WIDTH_FRACTION;
  const short = long / BARCODE_GUIDE_ASPECT;
  const width = orientation === "vertical" ? short : long;
  const height = orientation === "vertical" ? long : short;
  const left = (1 - width) / 2;
  const top = (1 - height) / 2;
  return { left, top, right: left + width, bottom: top + height };
}

// Where a decoded barcode sits in the square viewfinder, for the live AR
// overlay: `cx`/`cy`/`length` are fractions (0..1) of the viewfinder side,
// `angleDeg` the direction of the scan line (the barcode's own left→right),
// so the overlay can be rotated to lie exactly on the physical barcode —
// also when it is held on its side.
// `barsBefore`/`barsAfter` (same fraction unit, null when unknown) are how
// far the printed bars reach from that scan line towards the barcode's top
// and towards its digits.
export type BarcodePose = {
  cx: number;
  cy: number;
  length: number;
  angleDeg: number;
  barsBefore: number | null;
  barsAfter: number | null;
};

// `points` are the two ZXing result points (centres of the start/end guard
// patterns) in the pixel space of the square decode canvas of side `side`.
export function barcodePoseFromPoints(
  points: { x: number; y: number }[],
  side: number,
  barExtent: { before: number; after: number } | null = null,
  tiltDeg = 0
): BarcodePose | null {
  if (points.length < 2 || !side) return null;
  const [start, end] = points;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // A scan line crossing tilted bars is longer than the barcode itself.
  const length = (Math.hypot(dx, dy) / side) * Math.cos((tiltDeg * Math.PI) / 180);
  if (!length) return null;
  return {
    cx: (start.x + end.x) / 2 / side,
    cy: (start.y + end.y) / 2 / side,
    length,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI + tiltDeg,
    barsBefore: barExtent ? barExtent.before / side : null,
    barsAfter: barExtent ? barExtent.after / side : null,
  };
}

export function orientationFromPose(pose: BarcodePose): BarcodeOrientation {
  const angle = Math.abs(pose.angleDeg);
  return angle > 45 && angle < 135 ? "vertical" : "horizontal";
}

export function toPercentStyle(rect: FractionRect): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${rect.left * 100}%`,
    top: `${rect.top * 100}%`,
    width: `${(rect.right - rect.left) * 100}%`,
    height: `${(rect.bottom - rect.top) * 100}%`,
  };
}
