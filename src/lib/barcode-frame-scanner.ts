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
//   phone rotates the whole web app instead). ZXing's own rotation is switched
//   off (isRotateSupported=false): @zxing/browser's canvas luminance source
//   doesn't update its width/height when rotating. TRY_HARDER is still on for
//   its dense row scan.
// - Where the browser has the native BarcodeDetector it runs first; the JS
//   decoder is the fallback (iOS Safari). Its scan lines are thresholded
//   locally first (`LocalRowBinarizer`: a shadow across part of the code
//   must not stop the read, DECISIONS 2026-10-09), then with ZXing's global
//   histogram (low contrast, blur). Note ZXing's HybridBinarizer only
//   differs from the global one for 2D matrices — for 1D rows both use the
//   same single black point per row, which is what fails under a shadow.

import { BrowserMultiFormatOneDReader, HTMLCanvasElementLuminanceSource } from "@zxing/browser";
import {
  BarcodeFormat,
  BinaryBitmap,
  ChecksumException,
  DecodeHintType,
  FormatException,
  GlobalHistogramBinarizer,
  NotFoundException,
  type Result,
} from "@zxing/library";
import { LocalRowBinarizer } from "@/lib/barcode-local-binarizer";
import type { BarcodeSymbology } from "@/lib/barcode-pattern";
import { UpcEReader } from "@/lib/upce-reader";

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
const MAX_DECODE_SIDE = 1080;
const FRAME_INTERVAL_MS = 90;
// A read whose bar extent couldn't be measured (shadow gradients and glare
// confuse the edge-density walk) is accepted only when the same code comes
// back in this many consecutive frames — the EAN checksum alone lets ~1 in
// 10 random stripe patterns through.
const UNMEASURED_CONFIRMATIONS = 2;

// Native shape detector (Chrome/Edge/Android WebView; not iOS Safari). It
// finds rotated and shadowed codes far better than the JS decoder, so it runs
// first whenever it exists.
type NativeDetectedBarcode = { rawValue: string; format: string; cornerPoints: { x: number; y: number }[] };
type NativeBarcodeDetector = { detect(source: CanvasImageSource): Promise<NativeDetectedBarcode[]> };
type NativeBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector;

const NATIVE_SYMBOLOGY: Record<string, BarcodeSymbology> = {
  ean_13: "ean13",
  ean_8: "ean8",
  upc_a: "upca",
  upc_e: "upce",
};

function createNativeDetector(): NativeBarcodeDetector | null {
  if (typeof window === "undefined") return null;
  const Detector = (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({ formats: Object.keys(NATIVE_SYMBOLOGY) });
  } catch {
    return null;
  }
}

// One luminance conversion per canvas, two ways of turning its rows into
// bars: local thresholds first (shadows, uneven light), then ZXing's global
// histogram (low contrast, blur). Rotation is switched off on the source
// because the canvas source's rotate doesn't update its size (see top of
// file); we turn the frame ourselves.
function bitmapsFromCanvas(canvas: HTMLCanvasElement): BinaryBitmap[] {
  const source = new HTMLCanvasElementLuminanceSource(canvas);
  source.isRotateSupported = () => false;
  return [new BinaryBitmap(new LocalRowBinarizer(source)), new BinaryBitmap(new GlobalHistogramBinarizer(source))];
}

type Orientation = "upright" | "sideways";

// A line parallel to the scan line still counts as "on the bars" while its
// light/dark transition density stays above this share of the scan line's.
const BAR_EDGE_DENSITY_RATIO = 0.55;
// Printed EAN-13 bars are ~0.6–0.75 × the barcode width, EAN-8 up to ~0.95
// and the narrow UPC-E ~1–1.3; cap the measurement there so a striped
// background can't stretch the overlay.
const MAX_BAR_HEIGHT_TO_WIDTH = 1.4;

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
  // UPC-E is read by our own UpcEReader — @zxing/library's never returns a
  // result (see src/lib/upce-reader.ts), so it's left out of the main reader.
  // TRY_HARDER = 256 scan rows per frame instead of 32 (and the reversed
  // direction), the biggest single gain for codes in shadow or slightly blurred.
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatOneDReader(hints);
  const upcEReader = new UpcEReader();
  const nativeDetector = createNativeDetector();
  const frame = document.createElement("canvas");
  const turned = document.createElement("canvas");
  const frameContext = frame.getContext("2d", { willReadFrequently: true });
  const turnedContext = turned.getContext("2d", { willReadFrequently: true });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Try last frame's successful orientation first — a held barcode rarely
  // changes orientation between frames, so this halves the average work.
  let preferred: Orientation = "upright";
  let unmeasuredCode: string | null = null;
  let unmeasuredCount = 0;

  function measuredRead(
    text: string,
    symbology: BarcodeSymbology,
    points: { x: number; y: number }[],
    side: number,
    pixels: Uint8ClampedArray | undefined
  ): BarcodeRead | null {
    const barExtent = pixels && points.length >= 2 ? measureBarExtent(pixels, side, points[0], points[1]) : null;
    if (!barExtent) {
      // Not measurable (shadow/glare) — accept only a code seen repeatedly.
      if (unmeasuredCode === text) unmeasuredCount += 1;
      else {
        unmeasuredCode = text;
        unmeasuredCount = 1;
      }
      if (unmeasuredCount < UNMEASURED_CONFIRMATIONS || points.length < 2) return null;
      const length = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      return { text, symbology, points, side, barExtent: { before: length * 0.3, after: length * 0.3 }, tiltDeg: 0 };
    }
    unmeasuredCode = null;
    unmeasuredCount = 0;
    const tiltDeg = pixels ? measureTilt(pixels, side, points[0], points[1], barExtent) : 0;
    return { text, symbology, points, side, barExtent, tiltDeg };
  }

  function decode(orientation: Orientation, side: number): BarcodeRead | null {
    const canvas = orientation === "upright" ? frame : turned;
    if (orientation === "sideways") {
      if (!turnedContext) return null;
      turnedContext.setTransform(1, 0, 0, 1, 0, 0);
      turnedContext.translate(side, 0);
      turnedContext.rotate(Math.PI / 2);
      turnedContext.drawImage(frame, 0, 0);
    }
    let result: Result | null = null;
    for (const bitmap of bitmapsFromCanvas(canvas)) {
      for (const decodeWith of [() => reader.decodeBitmap(bitmap), () => upcEReader.decode(bitmap)]) {
        try {
          result = decodeWith();
          break;
        } catch (error) {
          if (!isExpectedMiss(error)) throw error;
        }
      }
      if (result) break;
    }
    if (!result) throw new NotFoundException();
    const symbology = SYMBOLOGY_BY_FORMAT.get(result.getBarcodeFormat());
    if (!symbology) return null;
    const points = result.getResultPoints().map((point) =>
      // Canvas rotation of +90° maps (x, y) → (side − y, x); invert it.
      orientation === "upright" ? { x: point.getX(), y: point.getY() } : { x: point.getY(), y: side - point.getX() }
    );
    const pixels = frameContext?.getImageData(0, 0, side, side).data;
    return measuredRead(result.getText(), symbology, points, side, pixels);
  }

  // The native detector reads any rotation in one call; its four corner
  // points (barcode's own top-left, top-right, bottom-right, bottom-left) give
  // the scan line (mid left edge → mid right edge) and the bar height directly.
  async function decodeNative(side: number): Promise<BarcodeRead | null> {
    if (!nativeDetector) return null;
    const found = await nativeDetector.detect(frame);
    for (const item of found) {
      const symbology = NATIVE_SYMBOLOGY[item.format];
      const corners = item.cornerPoints;
      if (!symbology || !item.rawValue || !corners || corners.length < 4) continue;
      const start = { x: (corners[0].x + corners[3].x) / 2, y: (corners[0].y + corners[3].y) / 2 };
      const end = { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 };
      const half = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y) / 2;
      unmeasuredCode = null;
      unmeasuredCount = 0;
      return { text: item.rawValue, symbology, points: [start, end], side, barExtent: { before: half, after: half }, tiltDeg: 0 };
    }
    return null;
  }

  async function tick() {
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

      try {
        let read: BarcodeRead | null = null;
        try {
          read = await decodeNative(side);
        } catch {
          // Detector failed on this frame — fall through to the JS decoder.
        }
        if (stopped) return;
        if (read) {
          onRead(read);
        } else {
          const order: Orientation[] = preferred === "upright" ? ["upright", "sideways"] : ["sideways", "upright"];
          for (const orientation of order) {
            try {
              read = decode(orientation, side);
              if (read) {
                preferred = orientation;
                onRead(read);
                break;
              }
            } catch (error) {
              if (!isExpectedMiss(error)) throw error;
            }
          }
        }
      } catch (error) {
        stopped = true;
        onFatalError(error);
        return;
      }
    }
    if (!stopped) timer = setTimeout(() => void tick(), FRAME_INTERVAL_MS);
  }

  // First frame async, so callers always hold the stop function before onRead.
  timer = setTimeout(() => void tick(), 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
