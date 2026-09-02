"use client";

import { useMemo } from "react";

type Registration = {
  createdAt: string;
  kcalSnapshot: number;
};

const BUCKET_MINUTES = 30;
const BUCKET_COUNT = (24 * 60) / BUCKET_MINUTES;
const HOUR_LABELS = [0, 6, 12, 18, 24];

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function bucketAverages(registrations: Registration[], windowDays: number) {
  const totals = new Array(BUCKET_COUNT).fill(0);
  for (const registration of registrations) {
    const minutes = minutesFromMidnight(new Date(registration.createdAt));
    const bucket = Math.min(BUCKET_COUNT - 1, Math.floor(minutes / BUCKET_MINUTES));
    totals[bucket] += registration.kcalSnapshot;
  }
  return totals.map((sum) => sum / Math.max(windowDays, 1));
}

/** Kalorieindtag kl. 00-24 som en glat kurve (ikke søjler), så man kan se
 * hvornår på dagen man typisk spiser mest — plus en AI-udregnet
 * morgenmad/frokost/aftensmad-opdeling til analytisk brug (docs/AI.md).
 * Ingen registreringer tagges automatisk. */
export function IntradayKcalChart({
  registrations,
  windowDays,
}: {
  registrations: Registration[];
  windowDays: number;
}) {
  const averages = useMemo(() => bucketAverages(registrations, windowDays), [registrations, windowDays]);

  const max = Math.max(...averages, 1);
  const points = averages.map((value, i) => {
    const x = 10 + i * (260 / (BUCKET_COUNT - 1));
    const y = 80 - (value / max) * 65;
    return { x, y, value };
  });
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `10,80 ${polylinePoints} 270,80`;

  // Lokale toppe i kurven, så man kan se hvor mange kcal der blev spist på de
  // tidspunkter, kurven topper — kun tydelige toppe, ikke støj.
  const peaks = points.filter((p, i) => {
    if (p.value < max * 0.15) return false;
    const prev = points[i - 1];
    const next = points[i + 1];
    if (prev && p.value < prev.value) return false;
    if (next && p.value < next.value) return false;
    if (prev && next && p.value === prev.value && p.value === next.value) return false;
    return true;
  });

  return (
    <div className="rounded-2xl bg-hf-tan p-4">
      <p className="mb-3 text-sm font-bold text-hf-black">Kalorieindtag i løbet af dagen</p>

      <svg viewBox="0 0 280 90" className="w-full overflow-visible" aria-hidden="true">
        <polygon points={areaPoints} fill="var(--hf-green)" opacity="0.15" />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="var(--hf-green)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {peaks.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={Math.max(8, p.y - 6)}
            textAnchor="middle"
            fontSize="7"
            fontWeight="700"
            fill="var(--hf-black)"
          >
            {Math.round(p.value)} kcal
          </text>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[10px] text-hf-black opacity-50">
        {HOUR_LABELS.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, "0")}</span>
        ))}
      </div>
    </div>
  );
}
