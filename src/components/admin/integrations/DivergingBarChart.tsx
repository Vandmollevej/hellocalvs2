"use client";

import { useState } from "react";
import type { ChartPoint } from "@/components/admin/stats/StatsBarChart";

// Søjler op og ned fra nullinjen: tilkoblinger over, frakoblinger under
// (admin → Integrationer). Samme mål og hover-tooltip som StatsBarChart.

type Side = { key: string; label: string; color: string };

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 40 };

const fmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });

function niceMax(value: number) {
  if (value <= 2) return 2;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 2 >= value) ?? 10;
  return step * magnitude * 2;
}

export function DivergingBarChart({
  points,
  up,
  down,
  emptyText = "Ingen til- eller frakoblinger i perioden",
}: {
  points: ChartPoint[];
  up: Side;
  down: Side;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ups = points.map((p) => p.values[up.key] ?? 0);
  const downs = points.map((p) => p.values[down.key] ?? 0);
  const max = niceMax(Math.max(0, ...ups, ...downs));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const zero = PAD.top + innerH / 2;
  const scale = innerH / 2 / max;
  const slot = innerW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const labelEvery = Math.max(1, Math.ceil(points.length / 12));
  const ticks = [max, max / 2, 0, -max / 2, -max];
  const empty = ups.every((v) => v === 0) && downs.every((v) => v === 0);

  // Afrundet ende væk fra nullinjen.
  function bar(cx: number, value: number, direction: 1 | -1) {
    const h = Math.max(1, value * scale);
    const r = Math.min(4, barW / 2, h);
    const x0 = cx - barW / 2;
    const end = zero - direction * h;
    const near = zero - direction * 1;
    return direction === 1
      ? `M${x0},${near} V${end + r} Q${x0},${end} ${x0 + r},${end} H${x0 + barW - r} Q${x0 + barW},${end} ${x0 + barW},${end + r} V${near} Z`
      : `M${x0},${near} V${end - r} Q${x0},${end} ${x0 + r},${end} H${x0 + barW - r} Q${x0 + barW},${end} ${x0 + barW},${end - r} V${near} Z`;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-text-secondary hf-type-small">
        {[up, down].map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${up.label} og ${down.label}`}>
          {ticks.map((tick) => {
            const y = zero - tick * scale;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--border-strong)"
                  strokeWidth={tick === 0 ? 1 : 0.5}
                  strokeDasharray={tick === 0 ? undefined : "2 3"}
                />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                  {fmt.format(Math.abs(tick))}
                </text>
              </g>
            );
          })}
          {points.map((point, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const opacity = hover === null || hover === i ? 1 : 0.55;
            return (
              <g key={point.key}>
                {ups[i] > 0 && <path d={bar(cx, ups[i], 1)} fill={up.color} opacity={opacity} />}
                {downs[i] > 0 && <path d={bar(cx, downs[i], -1)} fill={down.color} opacity={opacity} />}
                {i % labelEvery === 0 && (
                  <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                    {point.label}
                  </text>
                )}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {empty && <p className="absolute inset-0 flex items-center justify-center text-text-muted hf-type-body">{emptyText}</p>}
        {hover !== null && points[hover] && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 shadow hf-type-small"
            style={{
              left: `${((PAD.left + slot * hover + slot / 2) / WIDTH) * 100}%`,
              transform: hover > points.length / 2 ? "translateX(-105%)" : "translateX(5%)",
            }}
          >
            <p className="text-text-primary hf-type-strong">{points[hover].label}</p>
            {[up, down].map((s, index) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-text-primary">{fmt.format(index === 0 ? ups[hover] : downs[hover])}</span>
              </p>
            ))}
            <p className="mt-0.5 flex justify-between gap-3 border-t border-border-strong pt-0.5 text-text-primary">
              <span>Netto</span>
              <span>
                {ups[hover] - downs[hover] > 0 ? "+" : ""}
                {fmt.format(ups[hover] - downs[hover])}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
