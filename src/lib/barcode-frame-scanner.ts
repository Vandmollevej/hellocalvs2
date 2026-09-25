// Live EAN/UPC decode loop for `/camera?mode=product`. Replaces
// @zxing/browser's own `decodeFromConstraints` loop so we control exactly
// which pixels are decoded:
//
// - Only the centre square of the video is decoded — the same region the
//   square viewfinder shows with `object-fit: cover` — so a result point in
//   decode-canvas pixels divided by the canvas side is directly a fraction of
//   the viewfinder (no separate video→screen mapping that can drift).
// - Every frame is tried both as-is and turned 90°, so a barcode held on its
//   side is read without the user having to turn the phone (turning the
//   phone rotates the whole web app instead). ZXing's own TRY_HARDER rotation
//   is not used: @zxing/browser's canvas luminance source doesn't update its
//   width/height when rotating a non-square canvas.

import { BrowserMultiFormatOneDReader } from "@zxing/browser";
import { BarcodeFormat, ChecksumException, DecodeHintType, FormatException, NotFoundException } from "@zxing/library";
import type { BarcodeSymbology } from "@/lib/barcode-pattern";

export type BarcodeRead = {
  text: string;
  symbology: BarcodeSymbology;
  // Start/end guard centres in decode-canvas pixels (unrotated).
  points: { x: number; y: number }[];
  side: number;
  // How far the bars reach from the scan line, in decode-canvas pixels,
  // towards the barcode's top ("before") and its digits ("after"). ZXing
  // only reports the single row it decoded, which can sit anywhere on the
  // bars; null when the extent couldn't be measured.
  barExtent: { before: number; after: number } | null;
  // How far the bars lean away from perpendicular to the scan line, in
  // degrees: ZXing decodes along a pixel row/column, so a tilted barcode
  // still comes back with a perfectly horizontal/vertical scan line.
  tiltDeg: number;
};

const SYMBOLOGY_BY_FORMAT = new Map<BarcodeFormat, BarcodeSymbology>([
  [BarcodeFormat.EAN_13, "ean13"],
  [BarcodeFormat.EAN_8, "ean8"],
  [BarcodeFormat.UPC_A, "upca"],
  [BarcodeFormat.UPC_E, "upce"],
]);

// Caps the decode canvas so a 4K stream doesn't cost 4K luminance
// conversions per frame; ~960 px still leaves an EAN-13 filling a third of
// the viewfinder at >3 px per module.
const MAX_DECODE_SIDE = 960;
const FRAME_INTERVAL_MS = 90;

type Orientation = "upright" | "sideways";

// A line parallel to the scan line still counts as "on the bars" while its
// light/dark transition density stays above this share of the scan line's.
const BAR_EDGE_DENSITY_RATIO = 0.55;
// Printed EAN-13 bars are ~0.6–0.75 × the barcode width (EAN-8 up to ~0.95);
// cap the measurement there so a striped background can't stretch the overlay.
const MAX_BAR_HEIGHT_TO_WIDTH = 1;

// Largest tilt the correlation below searches; ZXing rarely decodes a row
// through bars leaning more than this anyway.
const MAX_TILT_DEG = 30;

function luminanceAt(pixels: Uint8ClampedArray, side: number, x: number, y: number): number | null {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= side || py >= side) return null;
  const i = (py * side + px) * 4;
  return pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
}

// Compares the bar pattern on two lines parallel to the scan line, one on
// each side of it: the sideways shift between them is how much the bars
// lean, i.e. how far the barcode is turned. Bar patterns repeat roughly
// every few modules, so a wide search window can lock onto the wrong bar —
// start with lines close together (small, unambiguous shift) and refine the
// estimate with lines further apart in a narrow window around it.
function measureTilt(
  pixels: Uint8ClampedArray,
  side: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  extent: { before: number; after: number }
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const count = Math.round(length);

  function profile(offset: number, margin: number): number[] | null {
    const values: number[] = [];
    for (let index = -margin; index < count + margin; index += 1) {
      const value = luminanceAt(pixels, side, start.x + ux * index + nx * offset, start.y + uy * index + ny * offset);
      if (value === null) return null;
      values.push(value);
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.map((value) => value - mean);
  }

  let tan = 0;
  let measured = false;
  for (const fraction of [0.08, 0.2, 0.35, 0.5]) {
    const offsetA = -extent.before * fraction;
    const offsetB = extent.after * fraction;
    const gap = offsetB - offsetA;
    if (gap < 6) continue;
    const predicted = Math.round(-tan * gap);
    const window = measured ? 3 : Math.ceil(Math.tan((MAX_TILT_DEG * Math.PI) / 180) * gap);
    const margin = Math.abs(predicted) + window;
    const a = profile(offsetA, 0);
    const b = profile(offsetB, margin);
    if (!a || !b) break;
    let bestShift = predicted;
    let bestScore = -Infinity;
    for (let shift = predicted - window; shift <= predicted + window; shift += 1) {
      let score = 0;
      for (let index = 0; index < a.length; index += 1) score += a[index] * b[index + margin + shift];
      if (score > bestScore) {
        bestScore = score;
        bestShift = shift;
      }
    }
    // Bars run along (shift, gap) in scan-line/normal coordinates; the
    // barcode's own axis is that turned −90°.
    tan = -bestShift / gap;
    measured = true;
  }
  return (Math.atan(tan) * 180) / Math.PI;
}

// Walks away from the decoded scan line, perpendicular to it, until the
// bar pattern fades out, to find the printed bars' real height and position.
function measureBarExtent(
  pixels: Uint8ClampedArray,
  side: number,
  start: { x: number; y: number },
  end: { x: number; y: number }
): { before: number; after: number } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 20) return null;
  // Unit normal pointing from the bars towards the digits (the scan line's
  // direction turned +90° in y-down screen space).
  const nx = -dy / length;
  const ny = dx / length;
  const samples = Math.min(Math.round(length), 480);

  function edgeDensity(offset: number): number {
    let edges = 0;
    let previous = -1;
    let sum = 0;
    const values: number[] = [];
    for (let index = 0; index < samples; index += 1) {
      const t = index / (samples - 1);
      const x = Math.round(start.x + dx * t + nx * offset);
      const y = Math.round(start.y + dy * t + ny * offset);
      if (x < 0 || y < 0 || x >= side || y >= side) return 0;
      const i = (y * side + x) * 4;
      const luminance = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
      values.push(luminance);
      sum += luminance;
    }
    const threshold = sum / samples;
    for (const value of values) {
      const dark = value < threshold ? 1 : 0;
      if (previous !== -1 && dark !== previous) edges += 1;
      previous = dark;
    }
    return edges;
  }

  const base = edgeDensity(0);
  if (base < 10) return null;
  const limit = length * MAX_BAR_HEIGHT_TO_WIDTH;
  const step = Math.max(1, length / 95);
  function reach(direction: 1 | -1): number {
    let distance = 0;
    while (distance + step <= limit && edgeDensity(direction * (distance + step)) >= base * BAR_EDGE_DENSITY_RATIO) {
      distance += step;
    }
    return distance;
  }
  const before = reach(-1);
  const after = reach(1);
  if (before + after > limit) return null;
  return { before, after };
}

function isExpectedMiss(error: unknown): boolean {
  return error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException;
}

export function startBarcodeFrameScanner(
  video: HTMLVideoElement,
  onRead: (read: BarcodeRead) => void,
  onFatalError: (error: unknown) => void
): () => void {
  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, [...SYMBOLOGY_BY_FORMAT.keys()]]]);
  const reader = new BrowserMultiFormatOneDReader(hints);
  const frame = document.createElement("canvas");
  const turned = document.createElement("canvas");
  const frameContext = frame.getContext("2d", { willReadFrequently: true });
  const turnedContext = turned.getContext("2d", { willReadFrequently: true });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Try last frame's successful orientation first — a held barcode rarely
  // changes orientation between frames, so this halves the average work.
  let preferred: Orientation = "upright";

  function decode(orientation: Orientation, side: number): BarcodeRead | null {
    const canvas = orientation === "upright" ? frame : turned;
    if (orientation === "sideways") {
      if (!turnedContext) return null;
      turnedContext.setTransform(1, 0, 0, 1, 0, 0);
      turnedContext.translate(side, 0);
      turnedContext.rotate(Math.PI / 2);
      turnedContext.drawImage(frame, 0, 0);
    }
    const result = reader.decodeFromCanvas(canvas);
    const symbology = SYMBOLOGY_BY_FORMAT.get(result.getBarcodeFormat());
    if (!symbology) return null;
    const points = result.getResultPoints().map((point) =>
      // Canvas rotation of +90° maps (x, y) → (side − y, x); invert it.
      orientation === "upright" ? { x: point.getX(), y: point.getY() } : { x: point.getY(), y: side - point.getX() }
    );
    const pixels = frameContext?.getImageData(0, 0, side, side).data;
    const barExtent = pixels && points.length >= 2 ? measureBarExtent(pixels, side, points[0], points[1]) : null;
    const tiltDeg = pixels && barExtent ? measureTilt(pixels, side, points[0], points[1], barExtent) : 0;
    return { text: result.getText(), symbology, points, side, barExtent, tiltDeg };
  }

  function tick() {
    if (stopped) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (frameContext && width && height && video.readyState >= 2) {
      const sourceSide = Math.min(width, height);
      const side = Math.min(sourceSide, MAX_DECODE_SIDE);
      if (frame.width !== side) {
        frame.width = frame.height = side;
        turned.width = turned.height = side;
      }
      frameContext.drawImage(video, (width - sourceSide) / 2, (height - sourceSide) / 2, sourceSide, sourceSide, 0, 0, side, side);

      const order: Orientation[] = preferred === "upright" ? ["upright", "sideways"] : ["sideways", "upright"];
      for (const orientation of order) {
        try {
          const read = decode(orientation, side);
          if (read) {
            preferred = orientation;
            onRead(read);
            break;
          }
        } catch (error) {
          if (!isExpectedMiss(error)) {
            stopped = true;
            onFatalError(error);
            return;
          }
        }
      }
    }
    timer = setTimeout(tick, FRAME_INTERVAL_MS);
  }

  // First frame async, so callers always hold the stop function before onRead.
  timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
