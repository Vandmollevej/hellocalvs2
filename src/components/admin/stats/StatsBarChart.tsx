"use client";

import { useState } from "react";

// Enkel søjlediagram-komponent (evt. stablet) til /admin/statistics — ren SVG,
// ingen chart-bibliotek. Én y-akse, tynde søjler med 2 px mellemrum mellem
// stablede segmenter, afrundet top, legende ved ≥ 2 serier og hover-tooltip.

export type ChartSeries = { key: string; label: string; color: string };
export type ChartPoint = { key: string; label: string; values: Record<string, number> };

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 40 };

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value) ?? 10;
  return step * magnitude * 4;
}

const fmt = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });

export function StatsBarChart({
  points,
  series,
  unit,
  emptyText = "Ingen data i perioden",
}: {
  points: ChartPoint[];
  series: ChartSeries[];
  unit?: string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = points.map((p) => series.reduce((sum, s) => sum + (p.values[s.key] ?? 0), 0));
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const max = niceMax(Math.max(0, ...totals));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const labelEvery = Math.max(1, Math.ceil(points.length / 12));
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  return (
    <div className="flex flex-col gap-2">
      {series.length > 1 && (
        <div className="hf-type-small flex flex-wrap gap-x-4 gap-y-1 text-text-secondary">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Søjlediagram">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border-strong)"
                strokeWidth={tick === 0 ? 1 : 0.5}
                strokeDasharray={tick === 0 ? undefined : "2 3"}
              />
              <text x={PAD.left - 6} y={y(tick) + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                {fmt.format(tick)}
              </text>
            </g>
          ))}
          {points.map((point, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            let base = 0;
            const drawn = series.filter((s) => (point.values[s.key] ?? 0) > 0);
            return (
              <g key={point.key}>
                {drawn.map((s, index) => {
                  const value = point.values[s.key] ?? 0;
                  const top = y(base + value);
                  const bottom = y(base);
                  base += value;
                  const gap = index > 0 ? 2 : 0;
                  const h = Math.max(1, bottom - top - gap);
                  const isTop = index === drawn.length - 1;
                  const r = isTop ? Math.min(4, barW / 2, h) : 0;
                  const x0 = cx - barW / 2;
                  const path = `M${x0},${top + h} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${
                    x0 + barW
                  },${top} ${x0 + barW},${top + r} V${top + h} Z`;
                  return <path key={s.key} d={path} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} />;
                })}
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
        {grandTotal === 0 && (
          <p className="absolute inset-0 flex items-center justify-center hf-type-body text-text-muted">{emptyText}</p>
        )}
        {hover !== null && points[hover] && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-36 hf-surface hf-type-small px-2.5 py-1.5 shadow"
            style={{
              left: `${((PAD.left + slot * hover + slot / 2) / WIDTH) * 100}%`,
              transform: hover > points.length / 2 ? "translateX(-105%)" : "translateX(5%)",
            }}
          >
            <p className="hf-type-strong text-text-primary">{points[hover].label}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="text-text-primary">
                  {fmt.format(points[hover].values[s.key] ?? 0)}
                  {unit ? ` ${unit}` : ""}
                </span>
              </p>
            ))}
            {series.length > 1 && (
              <p className="mt-0.5 flex justify-between gap-3 border-t border-border-strong pt-0.5 text-text-primary">
                <span>I alt</span>
                <span>
                  {fmt.format(totals[hover])}
                  {unit ? ` ${unit}` : ""}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
