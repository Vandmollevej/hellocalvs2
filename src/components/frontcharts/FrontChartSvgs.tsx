"use client";

import type { GoalBar, StickBucket } from "@/lib/front-charts";

// Forsidens fire grafer (bruger 2026-10-14) i infoboksens plads: uden
// baggrund, kun min/maks til venstre og timetal i siderne under x-aksen. Kun
// pulsen har en titel ("Puls") i midten; de andre viser grafen i midten. Farven er den
// nye graf-accent (--hf-color-chart-blue).

// Højden følger pladsen i infoboksens felt (bruger 2026-10-16).
const PAD_L = 30;
const PAD_R = 4;
/** Plads under plotområdet til timetal og titel. */
const LABEL_SPACE = 15;
const plotH = (height: number) => height - LABEL_SPACE;

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
  top,
  bottom,
  children,
  ariaLabel,
}: {
  width: number;
  height: number;
  title: string;
  left: string;
  right: string;
  top: string;
  bottom: string;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const PLOT_H = plotH(height);
  const LABEL_Y = height - 3;
  return (
    <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
      <text x={0} y={9} className="hf-chart-axis fill-hf-text-secondary">{top}</text>
      <text x={0} y={PLOT_H} className="hf-chart-axis fill-hf-text-secondary">{bottom}</text>
      <line x1={PAD_L} x2={width - PAD_R} y1={PLOT_H + 3} y2={PLOT_H + 3} className="stroke-hf-line" strokeWidth={0.5} />
      {children}
      <text x={PAD_L} y={LABEL_Y} className="hf-chart-axis fill-hf-text-secondary">{left}</text>
      {title && <text x={width / 2 + PAD_L / 2} y={LABEL_Y} textAnchor="middle" className="hf-chart-axis fill-hf-text">{title}</text>}
      <text x={width - PAD_R} y={LABEL_Y} textAnchor="end" className="hf-chart-axis fill-hf-text-secondary">{right}</text>
    </svg>
  );
}

const hourLabel = (h: number) => String(h % 24 === 0 && h > 0 ? 24 : h).padStart(2, "0");


function plotX(width: number, count: number, i: number) {
  const w = width - PAD_L - PAD_R;
  return PAD_L + ((i + 0.5) / count) * w;
}

/** Pulsen over dagen som pindediagram (én min/maks-pind pr. kvarter). */
export function PulseSticks({
  width, height, buckets, startHour, endHour, title,
}: { width: number; height: number; buckets: StickBucket[]; startHour: number; endHour: number; title: string }) {
  const filled = buckets.filter((b): b is NonNullable<StickBucket> => b !== null);
  const lo = filled.length ? Math.min(...filled.map((b) => b.min)) : 0;
  const hi = filled.length ? Math.max(...filled.map((b) => b.max)) : 0;
  const span = Math.max(1, hi - lo);
  const PLOT_H = plotH(height);
  const y = (v: number) => PLOT_H - ((v - lo) / span) * (PLOT_H - 8);
  return (
    <Frame
      width={width} height={height} title={title} ariaLabel={title}
      left={hourLabel(startHour)} right={hourLabel(endHour)}
      top={filled.length ? String(Math.round(hi)) : ""} bottom={filled.length ? String(Math.round(lo)) : ""}
    >
      {filled.map((b) => (
        <line
          key={b.index}
          x1={plotX(width, buckets.length, b.index)} x2={plotX(width, buckets.length, b.index)}
          y1={y(b.min) + (b.min === b.max ? 1 : 0)} y2={y(b.max) - (b.min === b.max ? 1 : 0)}
          className="stroke-hf-chart-blue" strokeWidth={2} strokeLinecap="round"
        />
      ))}
    </Frame>
  );
}

/** Kalorieindtag som pinde, med den anbefalede energifordeling som glat kurve i midten. */
export function KcalSticks({
  width, height, sums, shares, budgetKcal, startHour, endHour, title,
}: { width: number; height: number; sums: number[]; shares: number[]; budgetKcal: number; startHour: number; endHour: number; title: string }) {
  const peakPlan = Math.max(...shares.map((s) => s * budgetKcal), 1);
  const top = Math.max(...sums, peakPlan, 1);
  const PLOT_H = plotH(height);
  const y = (v: number) => PLOT_H - (v / top) * (PLOT_H - 8);
  const plan = shares.map((s, i) => ({ x: plotX(width, shares.length, i), y: y(s * budgetKcal) }));
  return (
    <Frame
      width={width} height={height} title="" ariaLabel={title}
      left={hourLabel(startHour)} right={hourLabel(endHour)}
      top={String(Math.round(top))} bottom="0"
    >
      {sums.map((v, i) => v > 0 && (
        <line key={i} x1={plotX(width, sums.length, i)} x2={plotX(width, sums.length, i)} y1={PLOT_H} y2={y(v)}
          className="stroke-hf-chart-blue" strokeWidth={2} strokeLinecap="round" />
      ))}
      <path d={smoothPath(plan)} fill="none" className="stroke-hf-text-secondary" strokeWidth={1.25} strokeLinecap="round" />
    </Frame>
  );
}

/** Statisk grå anbefalet kurve mod den faktiske kalorie-status i blå. */
export function PlanVsActual({
  width, height, planCumulative, actualCumulative, elapsed, startHour, endHour, title,
}: { width: number; height: number; planCumulative: number[]; actualCumulative: number[]; elapsed: number; startHour: number; endHour: number; title: string }) {
  const count = planCumulative.length;
  const top = Math.max(planCumulative[count - 1] ?? 0, actualCumulative[Math.max(0, elapsed - 1)] ?? 0, 1);
  const PLOT_H = plotH(height);
  const y = (v: number) => PLOT_H - (v / top) * (PLOT_H - 8);
  const plan = planCumulative.map((v, i) => ({ x: plotX(width, count, i), y: y(v) }));
  const actual = actualCumulative.slice(0, Math.max(0, elapsed)).map((v, i) => ({ x: plotX(width, count, i), y: y(v) }));
  return (
    <Frame
      width={width} height={height} title="" ariaLabel={title}
      left={hourLabel(startHour)} right={hourLabel(endHour)}
      top={String(Math.round(top))} bottom="0"
    >
      <path d={smoothPath(plan)} fill="none" className="stroke-hf-line" strokeWidth={2.5} strokeLinecap="round" />
      {actual.length > 1 && <path d={smoothPath(actual)} fill="none" className="stroke-hf-chart-blue" strokeWidth={2.5} strokeLinecap="round" />}
    </Frame>
  );
}

/**
 * Målsætningens tidslinje: én pind pr. dag/uge fra laveste til højeste indtag,
 * en bredere grå bånd for anbefalet min–maks og en tynd grå streg for målet.
 * Dage uden målt indtag er tomme.
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
  const span = Math.max(1, top - bottom);
  const PLOT_H = plotH(height);
  const y = (v: number) => PLOT_H - ((v - bottom) / span) * (PLOT_H - 8);
  const x = (i: number) => plotX(width, slots, i);
  const barW = Math.max(1.5, Math.min(6, ((width - PAD_L - PAD_R) / slots) * 0.6));
  return (
    <Frame
      width={width} height={height} title="" ariaLabel={title}
      left={startLabel} right={endLabel}
      top={String(Math.round(top))} bottom={String(Math.round(bottom))}
    >
      <rect x={PAD_L} y={y(recMax)} width={width - PAD_L - PAD_R} height={Math.max(2, y(recMin) - y(recMax))} className="fill-hf-nav" opacity={0.7} />
      {goalKcal !== null && <line x1={PAD_L} x2={width - PAD_R} y1={y(goalKcal)} y2={y(goalKcal)} className="stroke-hf-text-secondary" strokeWidth={1.5} />}
      {bars.map((b, i) => b.lowKcal !== null && b.highKcal !== null && (
        <line key={i} x1={x(i)} x2={x(i)} y1={y(b.lowKcal)} y2={Math.min(y(b.lowKcal) - 1, y(b.highKcal))}
          className="stroke-hf-chart-blue" strokeWidth={barW} strokeLinecap="round" />
      ))}
    </Frame>
  );
}
