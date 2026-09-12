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

export function barcodeGuideBoxFraction(): FractionRect {
  const width = BARCODE_GUIDE_WIDTH_FRACTION;
  const height = width / BARCODE_GUIDE_ASPECT;
  const left = (1 - width) / 2;
  const top = (1 - height) / 2;
  return { left, top, right: left + width, bottom: top + height };
}

// Maps a point in native video-pixel space to a fraction (0..1) of the
// square viewfinder container, accounting for the same object-fit: cover
// crop the <video> element renders with. Confirmed against
// node_modules/@zxing/browser's BrowserCodeReader.createCaptureCanvas/
// drawImageOnCanvas: the decode capture canvas is drawn at native
// videoWidth/videoHeight with no extra scaling, so a decoded result's
// ResultPoint coordinates are already in that same native pixel space.
export function videoPointToFraction(
  x: number,
  y: number,
  videoWidth: number,
  videoHeight: number
): { x: number; y: number } {
  const scale = Math.max(1 / videoWidth, 1 / videoHeight);
  const offsetX = (1 - videoWidth * scale) / 2;
  const offsetY = (1 - videoHeight * scale) / 2;
  return { x: offsetX + x * scale, y: offsetY + y * scale };
}

// A decoded 1D barcode only yields points along its scan line, not its full
// printed height — approximate the height from the decoded width using the
// physical EAN-13 print ratio (22.85mm tall / ~37mm wide at 100%).
const DECODED_HEIGHT_FROM_WIDTH_RATIO = 0.6;

export function decodedPointsToFraction(
  points: { getX(): number; getY(): number }[],
  videoWidth: number,
  videoHeight: number
): FractionRect | null {
  if (points.length === 0 || !videoWidth || !videoHeight) return null;
  const mapped = points.map((p) => videoPointToFraction(p.getX(), p.getY(), videoWidth, videoHeight));
  const xs = mapped.map((p) => p.x);
  const ys = mapped.map((p) => p.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const centerY = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  const halfHeight = ((right - left) * DECODED_HEIGHT_FROM_WIDTH_RATIO) / 2;
  return { left, right, top: centerY - halfHeight, bottom: centerY + halfHeight };
}

export function rectCenter(rect: FractionRect): { x: number; y: number } {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}

export function pointInRect(point: { x: number; y: number }, rect: FractionRect): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
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
