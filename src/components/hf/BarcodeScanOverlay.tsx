import type { CSSProperties } from "react";
import { barcodePattern, guardSpanModules, type BarcodePattern, type BarcodeSymbology } from "@/lib/barcode-pattern";
import {
  BARCODE_GUIDE_ASPECT,
  BARCODE_GUIDE_WIDTH_FRACTION,
  toPercentStyle,
  type BarcodeOrientation,
  type BarcodePose,
  type FractionRect,
} from "@/lib/barcode-scan";

// Hello Cal-specifik primitiv uden HelloFresh-reference (jf. design.md §1) til
// den live stregkode-scanning på `/camera?mode=product` ("Stregkode"-fanen).
// Se design.md §6.11.

export type BarcodeDetection = {
  code: string;
  symbology: BarcodeSymbology;
  pose: BarcodePose;
  // "reading": the decode animation / product lookup is running.
  // "failed": this code was already looked up and not found.
  tone: "reading" | "failed";
};

// Bar/digit geometry in modules (the barcode's narrowest bar unit), close to
// a printed EAN-13 at 100 %: bars ~58 modules tall (used when the scanner
// couldn't measure the real height), guard bars reach down into the digit
// row, digits ~9 modules high. Quiet zone leaves room for the first/last
// digit printed outside the bars.
const DEFAULT_BAR_HEIGHT = 58;
const MIN_BAR_HEIGHT = 20;
const MAX_BAR_HEIGHT = 80;
const GUARD_EXTRA = 5;
const DIGIT_GAP = 12;
const DIGIT_SIZE = 9;
const QUIET_ZONE = 9;
const PLATE_PADDING = 3;

function viewBoxHeight(barHeight: number): number {
  return barHeight + DIGIT_GAP + 3;
}

// Animation timing — keep in sync with DECODE_ANIMATION_MS on the page.
const BAR_DRAW_MS = 600;
const DIGIT_START_MS = 620;
const DIGIT_STEP_MS = 45;

function BarcodeSvg({
  pattern,
  barHeight = DEFAULT_BAR_HEIGHT,
  animated,
  className,
  style,
  plate,
}: {
  pattern: BarcodePattern;
  barHeight?: number;
  animated: boolean;
  className?: string;
  style?: CSSProperties;
  plate?: "reading" | "failed";
}) {
  const width = pattern.modules + QUIET_ZONE * 2;
  const height = viewBoxHeight(barHeight);
  return (
    <svg
      viewBox={`${-QUIET_ZONE} 0 ${width} ${height}`}
      className={className}
      style={style}
      aria-hidden="true"
    >
      {plate && (
        <rect
          x={-QUIET_ZONE + PLATE_PADDING}
          y={-PLATE_PADDING}
          width={width - PLATE_PADDING * 2}
          height={height + PLATE_PADDING}
          rx={4}
          fill="rgb(0 0 0 / 0.5)"
          // Not-found codes keep the same calm plate, just outlined in the
          // danger token — the message under the viewfinder says why.
          stroke={plate === "failed" ? "var(--hf-color-danger)" : "transparent"}
          strokeWidth={1.2}
          className="transition-[stroke] duration-300"
        />
      )}
      {pattern.bars.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={0}
          width={bar.width}
          height={bar.guard ? barHeight + GUARD_EXTRA : barHeight}
          fill="currentColor"
          className={animated ? "hf-barcode-bar" : undefined}
          style={animated ? { animationDelay: `${(bar.x / pattern.modules) * BAR_DRAW_MS}ms` } : undefined}
        />
      ))}
      {animated && (
        <rect
          x={0}
          y={-1}
          width={1.2}
          height={barHeight + 2}
          fill="currentColor"
          className="hf-barcode-sweep"
          style={{ "--hf-barcode-sweep-distance": `${pattern.modules}px` } as CSSProperties}
        />
      )}
      {pattern.digits.map((digit, index) => (
        <text
          key={index}
          x={digit.x}
          y={barHeight + DIGIT_GAP}
          fontSize={DIGIT_SIZE}
          textAnchor="middle"
          fill="currentColor"
          className={`font-mono ${animated ? "hf-barcode-digit" : ""}`}
          style={animated ? { animationDelay: `${DIGIT_START_MS + index * DIGIT_STEP_MS}ms` } : undefined}
        >
          {digit.char}
        </text>
      ))}
    </svg>
  );
}

// The live "decoding" overlay: the real bars of the decoded code, drawn bar
// by bar and then digit by digit, lying on the physical barcode (position,
// size and angle from the decoder, so it also follows a barcode held on its
// side). Sizes are in `cqw` of the square viewfinder (container-type set on
// the overlay root), so 1 cqw = 1 % of the viewfinder side both ways.
function DecodeOverlay({ detection }: { detection: BarcodeDetection }) {
  const pattern = barcodePattern(detection.code, detection.symbology);
  if (!pattern) return null;
  const { pose } = detection;
  const moduleFraction = pose.length / guardSpanModules(pattern, detection.symbology);
  const moduleSize = moduleFraction * 100;
  const measured = pose.barsBefore !== null && pose.barsAfter !== null;
  const barHeight = measured
    ? Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, (pose.barsBefore! + pose.barsAfter!) / moduleFraction))
    : DEFAULT_BAR_HEIGHT;
  // Modules from the top of the bars down to the decoded scan line.
  const barsAboveScanLine = measured
    ? Math.min(barHeight, pose.barsBefore! / moduleFraction)
    : barHeight / 2;
  const svgWidth = (pattern.modules + QUIET_ZONE * 2) * moduleSize;
  const svgHeight = viewBoxHeight(barHeight) * moduleSize;

  return (
    <div
      className="absolute h-0 w-0 transition-[left,top,transform] duration-150 ease-linear"
      style={{ left: `${pose.cx * 100}%`, top: `${pose.cy * 100}%`, transform: `rotate(${pose.angleDeg}deg)` }}
    >
      <BarcodeSvg
        pattern={pattern}
        barHeight={barHeight}
        animated
        plate={detection.tone}
        className="absolute max-w-none text-white transition-[left,top,width,height] duration-150 ease-linear"
        style={{
          width: `${svgWidth}cqw`,
          height: `${svgHeight}cqw`,
          // Lay the bars (not the digits) over the measured printed bars.
          left: `${-(QUIET_ZONE + pattern.modules / 2) * moduleSize}cqw`,
          top: `${-barsAboveScanLine * moduleSize}cqw`,
        }}
      />
    </div>
  );
}

export function BarcodeScanOverlay({
  guideBox,
  orientation = "horizontal",
  fakeCode,
  detection,
  hintText,
}: {
  guideBox: FractionRect;
  orientation?: BarcodeOrientation;
  fakeCode: string;
  detection: BarcodeDetection | null;
  hintText: string | null;
}) {
  const guidePattern = barcodePattern(fakeCode, "ean13");
  const guideLong = BARCODE_GUIDE_WIDTH_FRACTION * 100;
  const guideShort = guideLong / BARCODE_GUIDE_ASPECT;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ containerType: "inline-size" }}>
      {/* Guide box + light dim around it. Fades (never snaps) away once a
          real barcode is being decoded, and back when it's gone. */}
      <div
        className="absolute rounded-[6px] border border-white/80 transition-[opacity,left,top,width,height] duration-300"
        style={{
          ...toPercentStyle(guideBox),
          boxShadow: "0 0 0 999px rgb(0 0 0 / 0.28)",
          opacity: detection ? 0 : 1,
        }}
      >
        {guidePattern && (
          <div
            className="absolute left-1/2 top-1/2 flex items-center justify-center px-[4cqw] py-[2cqw] transition-transform duration-300"
            style={{
              width: `${guideLong}cqw`,
              height: `${guideShort}cqw`,
              transform: `translate(-50%, -50%) rotate(${orientation === "vertical" ? 90 : 0}deg)`,
            }}
          >
            <BarcodeSvg pattern={guidePattern} animated={false} className="h-full w-full text-white/85" />
          </div>
        )}
      </div>

      {detection && <DecodeOverlay key={detection.code} detection={detection} />}

      {hintText && !detection && (
        <p className="absolute inset-x-4 bottom-4 rounded-full bg-black/70 px-4 py-2 text-center text-xs font-semibold text-white">
          {hintText}
        </p>
      )}
    </div>
  );
}
