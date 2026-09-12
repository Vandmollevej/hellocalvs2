// Small, dependency-free SVG chart used by the Hello Doc preview page
// (/settings/hello-doc/preview) to plot a history series without pulling in
// a charting library — the rest of the app's charts (StatChart, StatsWheel)
// are hand-rolled SVG too, same convention.

export type MiniChartPoint = { label: string; value: number };

function buildLinePath(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

export function MiniLineChart({
  points,
  height = 120,
  color = "var(--hf-color-brand)",
  unit,
  emptyLabel = "Ingen data i denne periode",
}: {
  points: MiniChartPoint[];
  height?: number;
  color?: string;
  unit?: string;
  emptyLabel?: string;
}) {
  const width = 300;
  const padding = 8;

  if (points.length === 0) {
    return <EmptyChart height={height} label={emptyLabel} />;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : padding + (index / (points.length - 1)) * (width - padding * 2),
    y: height - padding - ((point.value - min) / range) * (height - padding * 2),
  }));

  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={`Graf: ${last.label} ${last.value}${unit ?? ""}`}>
      <path d={buildLinePath(coords)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((coord, index) => (
        <circle key={index} cx={coord.x} cy={coord.y} r={index === coords.length - 1 ? 3.5 : 2} fill={color} />
      ))}
    </svg>
  );
}

export function MiniBarChart({
  points,
  height = 120,
  color = "var(--hf-color-brand)",
  emptyLabel = "Ingen data i denne periode",
}: {
  points: MiniChartPoint[];
  height?: number;
  color?: string;
  emptyLabel?: string;
}) {
  const width = 300;
  const padding = 8;

  if (points.length === 0) {
    return <EmptyChart height={height} label={emptyLabel} />;
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  const barWidth = (width - padding * 2) / points.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Søjlediagram">
      {points.map((point, index) => {
        const barHeight = (point.value / max) * (height - padding * 2);
        const x = padding + index * barWidth;
        const y = height - padding - barHeight;
        return (
          <rect
            key={index}
            x={x + barWidth * 0.15}
            y={y}
            width={barWidth * 0.7}
            height={Math.max(barHeight, 1)}
            rx={2}
            fill={color}
          />
        );
      })}
    </svg>
  );
}

function EmptyChart({ height, label }: { height: number; label: string }) {
  return (
    <div
      className="hf-type-caption flex w-full items-center justify-center opacity-60"
      style={{ height }}
    >
      {label}
    </div>
  );
}
