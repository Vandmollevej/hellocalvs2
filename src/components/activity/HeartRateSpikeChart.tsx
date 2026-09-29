"use client";

import { useState } from "react";
import type { HeartRateSample } from "@/lib/heart-rate-spikes";

// Puls over de fire timer med udsvinget i midten. Én serie, tynd linje,
// udsvinget skraveret, tidsangivelser under. Hover/tryk viser tid + puls.
const W = 320;
const H = 150;
const PAD = { top: 12, right: 8, bottom: 22, left: 30 };

function timeLabel(ms: number) {
  return new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

export function HeartRateSpikeChart({
  samples,
  windowStart,
  windowEnd,
  spikeStart,
  spikeEnd,
}: {
  samples: HeartRateSample[];
  windowStart: string;
  windowEnd: string;
  spikeStart: string;
  spikeEnd: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const t0 = new Date(windowStart).getTime();
  const t1 = new Date(windowEnd).getTime();
  const points = samples.map((s) => ({ t: new Date(s.at).getTime(), bpm: s.bpm }));
  const maxBpm = Math.max(120, ...points.map((p) => p.bpm));
  const minBpm = Math.max(0, Math.min(50, ...points.map((p) => p.bpm)) - 5);
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (bpm: number) => PAD.top + (1 - (bpm - minBpm) / (maxBpm - minBpm)) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.bpm).toFixed(1)}`).join("");
  const ticks = [0, 1, 2, 3, 4].map((i) => t0 + ((t1 - t0) * i) / 4);
  const yTicks = [Math.round(minBpm / 10) * 10 + 10, Math.round(((minBpm + maxBpm) / 2) / 10) * 10, Math.floor(maxBpm / 10) * 10];
  const hovered = hover == null ? null : points[hover];

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const t = t0 + (((event.clientX - rect.left) / rect.width) * W - PAD.left) / (W - PAD.left - PAD.right) * (t1 - t0);
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.t - t) < Math.abs(points[best].t - t)) best = i;
    });
    setHover(best);
  }

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label="Puls over fire timer"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <rect
          x={x(new Date(spikeStart).getTime())}
          y={PAD.top}
          width={Math.max(2, x(new Date(spikeEnd).getTime()) - x(new Date(spikeStart).getTime()))}
          height={H - PAD.top - PAD.bottom}
          rx={4}
          fill="var(--hf-green)"
          opacity={0.15}
        />
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--hf-tan-dark)" strokeWidth={1} />
            <text x={PAD.left - 4} y={y(v) + 3} textAnchor="end" fontSize={9} fill="var(--text-secondary)">
              {v}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--hf-green-dark)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {ticks.map((tick, i) => (
          <text
            key={tick}
            x={x(tick)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
            fontSize={10}
            fill="var(--text-secondary)"
          >
            {timeLabel(tick)}
          </text>
        ))}
        {hovered && (
          <g>
            <line x1={x(hovered.t)} x2={x(hovered.t)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--text-secondary)" strokeWidth={1} />
            <circle cx={x(hovered.t)} cy={y(hovered.bpm)} r={4} fill="var(--hf-green-dark)" stroke="var(--hf-cream)" strokeWidth={2} />
          </g>
        )}
      </svg>
      <figcaption className="hf-type-small h-5 text-center text-text-secondary">
        {hovered ? `${timeLabel(hovered.t)} · ${hovered.bpm} bpm` : ""}
      </figcaption>
    </figure>
  );
}
