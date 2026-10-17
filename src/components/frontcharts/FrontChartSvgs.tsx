"use client";

import type { GoalBar, StickBucket } from "@/lib/front-charts";

// Forsidens fire grafer (bruger 2026-10-14) i infoboksens plads: uden
// baggrund og uden tal i venstre side; kun det højeste tal står oven på den
// højeste pind/top (bruger 2026-10-16). Timetal i siderne under x-aksen ("kl."
// foran det venstre) og titlen i midten i læsbar størrelse. Farven er den
// nye graf-accent (--hf-color-chart-blue).

const PAD_L = 0;
/** Samme stregtykkelse på alle linjer og pinde i graferne (bruger 2026-10-17). */
const LINE_W = 2;
const PAD_R = 0;
/** Plads under plotområdet til timetal og titel (12 px tekst). */
const LABEL_SPACE = 17;
/** Plads over plotområdet til tallet oven på den højeste pind. */
const PEAK_SPACE = 11;
const plotH = (height: number) => height - LABEL_SPACE;
/** Lodret skala: 0 (eller laveste) i bunden, højeste værdi PEAK_SPACE under toppen. */
const scaleY = (height: number, lo: number, hi: number) => {
  const h = plotH(height);
  const span = Math.max(1, hi - lo);
  return (v: number) => h - ((v - lo) / span) * (h - PEAK_SPACE);
};

type Peak = { x: number; y: number; value: number } | null;

type Pt = { x: number; y: number };

/** Glat kurve gennem punkterne (Catmull-Rom → kubisk Bézier). */
export function smoothPath(points: Pt[]) {
  if (points.length === 0) return "";
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function Frame({
  width,
  height,
  title,
  left,
  right,
  peak,
  children,
  ariaLabel,
}: {
  width: number;
  height: number;
  title: string;
  left: string;
  right: string;
  peak: Peak;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const PLOT_H = plotH(height);
  const LABEL_Y = height - 3;
  // Titlen centreres i rummet mellem venstre og højre etiket, så lange titler ikke rammer "kl. 07".
  const CHAR_W = 6.4;
  const titleX = (PAD_L + left.length * CHAR_W + (width - PAD_R - right.length * CHAR_W)) / 2;
  const peakAnchor = peak && peak.x < 14 ? "start" : peak && peak.x > width - 14 ? "end" : "middle";
  return (
    <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
      <line x1={PAD_L} x2={width - PAD_R} y1={PLOT_H + 1} y2={PLOT_H + 1} className="stroke-hf-line" strokeWidth={0.5} />
      {children}
      {peak && (
        <text x={peak.x} y={peak.y - 4} textAnchor={peakAnchor} className="hf-chart-axis fill-hf-text-secondary">
          {Math.round(peak.value)}
        </text>
      )}
      <text x={PAD_L} y={LABEL_Y} className="hf-chart-axis--caption fill-hf-text-secondary">{left}</text>
      {title && <text x={titleX} y={LABEL_Y} textAnchor="middle" className="hf-chart-axis--caption fill-hf-text">{title}</text>}
      <text x={width - PAD_R} y={LABEL_Y} textAnchor="end" className="hf-chart-axis--caption fill-hf-text-secondary">{right}</text>
    </svg>
  );
}

const hourLabel = (h: number) => String(h % 24 === 0 && h > 0 ? 24 : h).padStart(2, "0");


function plotX(width: number, count: number, i: number) {
  const w = width - PAD_L - PAD_R;
  return PAD_L + ((i + 0.5) / count) * w;
}

/** Pulsen over dagen som blå kurve med en stiplet grå linje ved moderat intensitet; dagens maks står ved toppen. */
export function PulseSticks({
  width, height, leftLabel, buckets, startHour, endHour, title, zoneBpm,
}: { leftLabel: (hour: string) => string; width: number; height: number; buckets: StickBucket[]; startHour: number; endHour: number; title: string; zoneBpm: number }) {
  const filled = buckets.filter((b): b is NonNullable<StickBucket> => b !== null);
  const lo = filled.length ? Math.min(...filled.map((b) => b.min), zoneBpm) : 0;
  const hi = filled.length ? Math.max(...filled.map((b) => b.max), zoneBpm) : 0;
  const y = scaleY(height, lo, hi);
  const top = filled.length ? filled.reduce((a, b) => (b.max > a.max ? b : a)) : null;
  const peak: Peak = top ? { x: plotX(width, buckets.length, top.index), y: y(top.max), value: top.max } : null;
  // Blå kurve gennem kvarterets gennemsnit; stiplet grå linje ved moderat intensitet (bruger 2026-10-17).
  const points = filled.map((b) => ({ x: plotX(width, buckets.length, b.index), y: y((b.min + b.max) / 2) }));
  return (
    <Frame
      width={width} height={height} title={title} ariaLabel={title} peak={peak}
      left={leftLabel(hourLabel(startHour))} right={hourLabel(endHour)}
    >
      {filled.length > 0 && (
        <line x1={PAD_L} x2={width - PAD_R} y1={y(zoneBpm)} y2={y(zoneBpm)}
          className="stroke-hf-line" strokeWidth={LINE_W} strokeDasharray="4 3" />
      )}
      {points.length > 1 && <path d={smoothPath(points)} fill="none" className="stroke-hf-chart-blue" strokeWidth={LINE_W} strokeLinecap="round" strokeLinejoin="round" />}
    </Frame>
  );
}

/**
 * Kalorier fordelt (bruger 2026-10-17): eget indtag pr. time som blå pinde og den
 * anbefalede energifordeling over dagen som grå streg.
 */
export function KcalSticks({
  width, height, leftLabel, sums, shares, budgetKcal, startHour, endHour, title,
}: { leftLabel: (hour: string) => string; width: number; height: number; sums: number[]; shares: number[]; budgetKcal: number; startHour: number; endHour: number; title: string }) {
  const peakPlan = Math.max(...shares.map((s) => s * budgetKcal), 1);
  const maxSum = Math.max(...sums, 0);
  const top = Math.max(maxSum, peakPlan, 1);
  const y = scaleY(height, 0, top);
  const plan = shares.map((s, i) => ({ x: plotX(width, shares.length, i), y: y(s * budgetKcal) }));
  const peakIndex = maxSum > 0 ? sums.indexOf(maxSum) : -1;
  const peak: Peak = peakIndex >= 0 ? { x: plotX(width, sums.length, peakIndex), y: y(maxSum), value: maxSum } : null;
  return (
    <Frame
      width={width} height={height} title={title} ariaLabel={title} peak={peak}
      left={leftLabel(hourLabel(startHour))} right={hourLabel(endHour)}
    >
      <path d={smoothPath(plan)} fill="none" className="stroke-hf-line" strokeWidth={LINE_W} strokeLinecap="round" />
      {sums.map((v, i) => v > 0 && (
        <line key={i} x1={plotX(width, sums.length, i)} x2={plotX(width, sums.length, i)} y1={plotH(height)} y2={y(v)}
          className="stroke-hf-chart-blue" strokeWidth={LINE_W} strokeLinecap="round" />
      ))}
    </Frame>
  );
}

/**
 * Målsætningens tidslinje: én blå pind pr. dag/uge fra laveste til højeste indtag,
 * et bredere gråt bånd for anbefalet min–maks og en grå tværbar for målet.
 * Dage uden målt indtag er tomme. Det højeste indtag står oven på sin pind,
 * ellers målet ved tværbarens højre ende.
 */
export function GoalTimeline({
  width, height, bars, goalKcal, recMin, recMax, startLabel, endLabel, title, slots,
}: {
  width: number; height: number; bars: GoalBar[]; goalKcal: number | null; recMin: number; recMax: number;
  startLabel: string; endLabel: string; title: string; slots: number;
}) {
  const measured = bars.filter((b) => b.lowKcal !== null && b.highKcal !== null);
  const highs = measured.map((b) => b.highKcal as number);
  const lows = measured.map((b) => b.lowKcal as number);
  const top = Math.max(...highs, recMax, goalKcal ?? 0, 1);
  const bottom = Math.min(...lows, recMin, goalKcal ?? Infinity);
  const y = scaleY(height, bottom, top);
  const x = (i: number) => plotX(width, slots, i);
  const maxHigh = highs.length ? Math.max(...highs) : null;
  const peakIndex = maxHigh === null ? -1 : bars.findIndex((b) => b.highKcal === maxHigh);
  const peak: Peak = peakIndex >= 0 && maxHigh !== null
    ? { x: x(peakIndex), y: y(maxHigh) - LINE_W / 2, value: maxHigh }
    : goalKcal !== null ? { x: width - PAD_R, y: y(goalKcal), value: goalKcal } : null;
  return (
    <Frame
      width={width} height={height} title={title} ariaLabel={title} peak={peak}
      left={startLabel} right={endLabel}
    >
      <rect x={PAD_L} y={y(recMax)} width={width - PAD_L - PAD_R} height={Math.max(2, y(recMin) - y(recMax))} className="fill-hf-nav" opacity={0.7} />
      {goalKcal !== null && <line x1={PAD_L} x2={width - PAD_R} y1={y(goalKcal)} y2={y(goalKcal)} className="stroke-hf-text-secondary" strokeWidth={LINE_W} />}
      {bars.map((b, i) => b.lowKcal !== null && b.highKcal !== null && (
        <line key={i} x1={x(i)} x2={x(i)} y1={y(b.lowKcal)} y2={Math.min(y(b.lowKcal) - 1, y(b.highKcal))}
          className="stroke-hf-chart-blue" strokeWidth={LINE_W} strokeLinecap="round" />
      ))}
    </Frame>
  );
}
