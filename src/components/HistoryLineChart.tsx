"use client";

// Forløbsgraf øverst i Status-sidens historik-dropdowns (vægt og hvert
// kropsmål). Samme udtryk som kropsmål-grafen på statistiksiden: grøn linje
// og prikker, x efter tid (ikke jævnt fordelt), min/maks-tal i hjørnet.
// Et eventuelt mål tegnes som stiplet grå linje (som StatChart's mållinje).

import type { HistoryPoint } from "@/lib/profile-status";

const WIDTH = 320;
const HEIGHT = 120;
const LEFT = 6;
const RIGHT = WIDTH - 6;
const TOP = 14;
const BOTTOM = HEIGHT - 14;

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "2-digit" }).format(new Date(value));
}

export function HistoryLineChart({
  points,
  format,
  target = null,
  targetLabel,
  ariaLabel,
}: {
  points: HistoryPoint[];
  format: (value: number) => string;
  target?: number | null;
  targetLabel?: string;
  ariaLabel: string;
}) {
  if (points.length === 0) return null;

  const times = points.map((p) => new Date(p.at).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const values = points.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  // Målet tæller med i y-aksen, så linjen altid er synlig i grafen.
  const low = target != null ? Math.min(minValue, target) : minValue;
  const high = target != null ? Math.max(maxValue, target) : maxValue;

  const x = (time: number) =>
    maxTime === minTime ? (LEFT + RIGHT) / 2 : LEFT + ((time - minTime) / (maxTime - minTime)) * (RIGHT - LEFT);
  const y = (value: number) =>
    high === low ? (TOP + BOTTOM) / 2 : BOTTOM - ((value - low) / (high - low)) * (BOTTOM - TOP);
  const coords = points.map((p, i) => ({ x: x(times[i]), y: y(p.value) }));

  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full overflow-visible" role="img" aria-label={ariaLabel}>
        {high !== low && (
          <>
            <text x={LEFT} y={TOP - 4} fontSize="9" fill="var(--hf-gray)">
              {format(high)}
            </text>
            <text x={LEFT} y={BOTTOM + 11} fontSize="9" fill="var(--hf-gray)">
              {format(low)}
            </text>
          </>
        )}
        {target != null && (
          <>
            <line
              x1={LEFT}
              y1={y(target)}
              x2={RIGHT}
              y2={y(target)}
              stroke="var(--hf-gray)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {targetLabel && (
              <text x={RIGHT} y={y(target) - 4} fontSize="9" textAnchor="end" fill="var(--hf-gray)">
                {targetLabel}
              </text>
            )}
          </>
        )}
        {coords.length > 1 && (
          <polyline
            points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
            fill="none"
            stroke="var(--hf-green)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Mange vejninger → små prikker, så linjen ikke drukner. */}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={coords.length > 30 ? 1.6 : 3} fill="var(--hf-green)" />
        ))}
      </svg>
      <span className="hf-type-micro text-text-secondary">
        {points.length > 1
          ? `${formatShortDate(points[0].at)} – ${formatShortDate(points[points.length - 1].at)}`
          : formatShortDate(points[0].at)}
      </span>
    </div>
  );
}
