"use client";

import { useEffect, useRef, useState } from "react";
import { usePulseZoneSettings } from "@/lib/pulse-zone-settings";
import { WHEEL_SPAN } from "./StatsWheel";

// Forsidens hvide infoboks (bruger 2026-10-11): står i modsat side af
// tal-hjulet, fra række 2 over til række 2 under midten, 1 px sort kant og
// takket bund. Hele boksen er touch-område; swipe op/ned bladrer mellem
// visninger (AI-statistikker kommer senere).

const EDGE = 13;
const CENTER_GAP = 12;
const TOOTH_W = 12;
const TOOTH_H = 7;
const SWIPE_MIN = 30;

type Sample = { bpm: number; at: Date };

function isToday(d: Date) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function PulseChart({ width, height }: { width: number; height: number }) {
  const { zones } = usePulseZoneSettings();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [resting, setResting] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/health-metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { metrics: { type: string; value: number; recordedAt: string }[] } | null) => {
        if (!live || !data) return;
        const today = data.metrics.filter((m) => isToday(new Date(m.recordedAt)));
        setSamples(
          today
            .filter((m) => m.type === "HEART_RATE_BPM")
            .map((m) => ({ bpm: m.value, at: new Date(m.recordedAt) }))
            .sort((a, b) => a.at.getTime() - b.at.getTime()),
        );
        const rest = today.filter((m) => m.type === "RESTING_HEART_RATE_BPM").pop();
        setResting(rest ? rest.value : null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const maxBpm = zones[zones.length - 1]?.max ?? 190;
  const minBpm = Math.max(30, (resting ?? Math.min(60, ...samples.map((s) => s.bpm))) - 10);
  // Kun vågne timer: fra første måling (mindst 06) til nu/sidste måling (højst 24).
  const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;
  const startH = samples.length ? Math.min(6, Math.floor(hourOf(samples[0].at))) : 6;
  const endH = Math.min(24, Math.max(22, Math.ceil(hourOf(new Date()))));
  const padL = 24;
  const w = width - padL - 4;
  const h = height - 16;
  const x = (hr: number) => padL + ((hr - startH) / (endH - startH)) * w;
  const y = (bpm: number) => h - ((Math.min(maxBpm, Math.max(minBpm, bpm)) - minBpm) / (maxBpm - minBpm)) * (h - 4);
  const path = samples.map((s, i) => `${i ? "L" : "M"}${x(hourOf(s.at)).toFixed(1)},${y(s.bpm).toFixed(1)}`).join(" ");
  const ticks: number[] = [];
  for (let t = Math.ceil(startH / 6) * 6; t <= endH; t += 6) ticks.push(t);

  return (
    <svg width={width} height={height} role="img" aria-label="Puls over dagen" className="block">
      <text x={0} y={9} fontSize={9} fill="#6b7280">{maxBpm}</text>
      <text x={0} y={h} fontSize={9} fill="#6b7280">{Math.round(minBpm)}</text>
      <line x1={padL} x2={padL + w} y1={h} y2={h} stroke="#d1d5db" />
      {resting !== null && <line x1={padL} x2={padL + w} y1={y(resting)} y2={y(resting)} stroke="#d1d5db" strokeDasharray="3 3" />}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={height - 3} fontSize={9} fill="#6b7280" textAnchor="middle">{String(t % 24).padStart(2, "0")}</text>
      ))}
      {path ? (
        <path d={path} fill="none" stroke="#e11d48" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      ) : (
        <text x={padL + w / 2} y={h / 2} fontSize={10} fill="#9ca3af" textAnchor="middle">Ingen pulsdata endnu</text>
      )}
    </svg>
  );
}

export function InfoBox({ side }: { side: "left" | "right" }) {
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const moved = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(0);
  const pages = [{ key: "pulse", title: "puls over dagen" }];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const n = Math.floor(w / TOOTH_W) || 1;
  const tw = w / n;
  let d = `M0.5,0.5 H${w - 0.5} V${h - TOOTH_H}`;
  for (let i = 0; i < n; i++) d += ` L${w - (i + 0.5) * tw},${h - 0.5} L${w - (i + 1) * tw},${h - TOOTH_H}`;
  d += " Z";
  const current = pages[page];

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Infoboks. Swipe op eller ned for at bladre."
      tabIndex={0}
      onPointerDown={(e) => {
        startY.current = e.clientY;
        moved.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        if (startY.current === null) return;
        const dy = startY.current - e.clientY;
        startY.current = null;
        if (Math.abs(dy) >= SWIPE_MIN) setPage((p) => (p + (dy > 0 ? 1 : -1) + pages.length) % pages.length);
      }}
      onPointerCancel={() => (startY.current = null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") setPage((p) => (p + 1) % pages.length);
        if (e.key === "ArrowUp") setPage((p) => (p - 1 + pages.length) % pages.length);
      }}
      className="absolute touch-none select-none"
      style={{
        [side]: EDGE,
        [side === "left" ? "right" : "left"]: `calc(50% + ${CENTER_GAP}px)`,
        top: `calc(50% + ${WHEEL_SPAN.shift - WHEEL_SPAN.half}px)`,
        height: WHEEL_SPAN.half * 2,
      } as React.CSSProperties}
    >
      <svg width={w} height={h} className="pointer-events-none absolute inset-0" aria-hidden>
        <path d={d} fill="#fff" stroke="#000" strokeWidth={1} />
      </svg>
      <div className="absolute inset-x-0 top-0 overflow-hidden px-2 pt-2" style={{ bottom: TOOTH_H }}>
        <div key={current.key} className="hf-type-label hf-type-strong lowercase text-black">{current.title}</div>
        {current.key === "pulse" && w > 0 && <PulseChart width={w - 16} height={Math.max(40, h - TOOTH_H - 34)} />}
      </div>
    </div>
  );
}
