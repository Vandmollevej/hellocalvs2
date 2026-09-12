import { formatEan13 } from "@/lib/regions";
import { toPercentStyle, type FractionRect } from "@/lib/barcode-scan";

// Hello Cal-specifik primitiv uden HelloFresh-reference (jf. design.md §1),
// tilføjet 2026-09-12 til den fiktive stregkode-scanningsguide på
// `/camera?mode=product` ("Stregkode"-fanen). Se design.md §6.11.
export type BarcodeAlignment = "idle" | "aligned" | "misaligned";

const ALIGNMENT_BORDER_CLASS: Record<BarcodeAlignment, string> = {
  idle: "border-white/80",
  aligned: "border-hf-lime",
  misaligned: "border-hf-red-dark",
};

// Arbitrary, purely decorative bar widths — same convention as HfBarcodeIcon
// (does not encode `fakeCode`, just needs to read as a barcode silhouette).
const BAR_WIDTHS = [
  2, 1, 1, 3, 2, 1, 4, 1, 2, 3, 1, 1, 2, 4, 1, 3, 2, 1, 1, 2, 3, 1, 4, 2, 1, 3, 1, 2, 1, 4, 3, 1, 2, 1, 3, 2,
  4, 1, 1, 2, 3, 1, 2, 4, 1, 3, 1, 2, 1, 4, 2, 3, 1, 1, 2, 3, 4, 1, 2, 1,
];

// Laid out once at module load (not per render) — the react-hooks/immutability
// rule flags a mutable running-x variable inside a component's render body.
function layoutBars(widths: number[]): { x: number; width: number }[] {
  let x = 0;
  return widths.map((width) => {
    const bar = { x, width };
    x += width + 1;
    return bar;
  });
}

const FAKE_BARCODE_BARS = layoutBars(BAR_WIDTHS);
const FAKE_BARCODE_VIEWBOX_WIDTH = FAKE_BARCODE_BARS.reduce((max, bar) => Math.max(max, bar.x + bar.width), 0);

function FakeBarcodeBars() {
  return (
    <svg
      viewBox={`0 0 ${FAKE_BARCODE_VIEWBOX_WIDTH} 64`}
      className="h-full w-full text-white"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {FAKE_BARCODE_BARS.map((bar, index) => (
        <rect key={index} x={bar.x} y={0} width={bar.width} height={64} fill="currentColor" />
      ))}
    </svg>
  );
}

export function BarcodeScanOverlay({
  guideBox,
  alignment,
  confirmed,
  fakeCode,
  decodedRect,
  hintText,
}: {
  guideBox: FractionRect;
  alignment: BarcodeAlignment;
  confirmed: boolean;
  fakeCode: string;
  decodedRect: FractionRect | null;
  hintText: string | null;
}) {
  const boxStyle = toPercentStyle(guideBox);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className={`absolute border transition-colors duration-200 ${ALIGNMENT_BORDER_CLASS[alignment]}`}
        style={confirmed ? boxStyle : { ...boxStyle, boxShadow: "0 0 0 999px rgba(0,0,0,0.55)" }}
      >
        {!confirmed && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3">
            <div className="h-[58%] w-full">
              <FakeBarcodeBars />
            </div>
            <p className="font-mono text-[11px] tracking-[0.15em] text-white">{formatEan13(fakeCode)}</p>
          </div>
        )}
      </div>

      {confirmed && decodedRect && (
        <>
          <div className="absolute bg-hf-lime/45" style={toPercentStyle(decodedRect)} />
          <div
            className="absolute bg-hf-lime/60"
            style={toPercentStyle({
              left: decodedRect.left,
              right: decodedRect.right,
              top: decodedRect.bottom,
              bottom: decodedRect.bottom + (decodedRect.bottom - decodedRect.top) * 0.22,
            })}
          />
        </>
      )}

      {hintText && !confirmed && (
        <p className="absolute inset-x-4 bottom-4 rounded-full bg-black/80 px-4 py-2 text-center text-xs font-semibold text-white">
          {hintText}
        </p>
      )}
    </div>
  );
}
