"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
  /** Unit shown next to the series name in the picker, e.g. "kcal" or "kg". */
  unit?: string;
  /**
   * Optional goal value. When set, the series is plotted as deviation from
   * the goal (0 = goal hit) instead of raw values, and the points are
   * colored by whether they are below or above the goal.
   */
  goal?: number;
  /** Color used for points below the goal (default: hf-green). */
  underGoalColor?: string;
  /** Color used for points above the goal (default: hf-black). */
  overGoalColor?: string;
  /** Dashed line, e.g. for an AI estimate (trend weight) instead of measured data. */
  dashed?: boolean;
};

const STORAGE_KEY = "hellocal.statistik.series";
const CHART_TOP = 15;
const CHART_BOTTOM = 75;
const CHART_CENTER = (CHART_TOP + CHART_BOTTOM) / 2;
const CHART_HALF_RANGE = CHART_BOTTOM - CHART_CENTER;

function loadEnabledKeys(defaultKeys: string[]): string[] {
  if (typeof window === "undefined") return defaultKeys;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultKeys;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return defaultKeys;
  } catch {
    return defaultKeys;
  }
}

function normalize(values: number[]) {
  const positives = values.filter((v) => v > 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...positives, 0);
  const range = Math.max(max - min, 1);

  return values.map((value, i) => {
    const x = 10 + i * (260 / Math.max(values.length - 1, 1));
    const normalized = value > 0 ? (value - min) / range : 0;
    const y = 75 - normalized * 60;
    return { x, y, hasData: value > 0, deviation: 0 };
  });
}

/** Like normalize, but the points reflect the deviation from `goal` (0 at the middle of the chart). */
function normalizeDeviation(values: number[], goal: number) {
  const deviations = values.map((value) => (value > 0 ? value - goal : null));
  const maxAbs = Math.max(...deviations.map((d) => (d === null ? 0 : Math.abs(d))), 1);

  return values.map((value, i) => {
    const x = 10 + i * (260 / Math.max(values.length - 1, 1));
    const deviation = deviations[i];
    if (deviation === null) {
      return { x, y: CHART_CENTER, hasData: false, deviation: 0 };
    }
    const y = CHART_CENTER - (deviation / maxAbs) * CHART_HALF_RANGE;
    return { x, y, hasData: true, deviation };
  });
}

/** Text for the latest data point's deviation from the goal, e.g. "342 kcal over goal". */
function deviationLabel(series: ChartSeries, points: { hasData: boolean; deviation: number }[]) {
  const last = [...points].reverse().find((p) => p.hasData);
  if (!last) return null;
  const rounded = Math.round(Math.abs(last.deviation));
  const unit = series.unit ? `${series.unit} ` : "";
  if (rounded === 0) return `${series.label.toLowerCase()} lige på mål`;
  const direction = last.deviation > 0 ? "over mål" : "under mål";
  return `${rounded} ${unit}${direction}`;
}

export function StatChart({
  title,
  series,
  defaultEnabledKeys,
}: {
  title: string;
  series: ChartSeries[];
  defaultEnabledKeys: string[];
}) {
  const [enabledKeys, setEnabledKeys] = useState<string[]>(() => loadEnabledKeys(defaultEnabledKeys));
  const [menuOpen, setMenuOpen] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enabledKeys));
    } catch {
      // localStorage unavailable (private browsing etc.) — ignore.
    }
  }, [enabledKeys]);

  function toggleSeries(key: string) {
    setEnabledKeys((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  }

  const visibleSeries = useMemo(
    () => series.filter((s) => enabledKeys.includes(s.key)),
    [series, enabledKeys],
  );

  const hasGoalSeries = visibleSeries.some((s) => s.goal != null);

  return (
    <div className="relative rounded-2xl bg-hf-tan p-4">
      <p className="mb-3 text-sm font-bold text-hf-black">{title}</p>

      {visibleSeries
        .filter((s) => s.goal != null)
        .map((s) => {
          const points = normalizeDeviation(s.values, s.goal as number);
          const label = deviationLabel(s, points);
          if (!label) return null;
          return (
            <p key={s.key} className="mb-1 text-center text-[11px] text-hf-black opacity-60">
              {label}
            </p>
          );
        })}

      <svg viewBox="0 0 280 90" className="w-full" aria-hidden="true">
        {hasGoalSeries && (
          <line
            x1="6"
            y1={CHART_CENTER}
            x2="274"
            y2={CHART_CENTER}
            stroke="var(--hf-gray)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {visibleSeries.map((s) => {
          const underColor = s.underGoalColor ?? "var(--hf-green)";
          const overColor = s.overGoalColor ?? "var(--hf-black)";
          const points = s.goal != null ? normalizeDeviation(s.values, s.goal) : normalize(s.values);

          return (
            <g key={s.key}>
              {s.goal != null
                ? points.slice(1).map((p, i) => {
                    const prev = points[i];
                    const segColor = prev.deviation > 0 || p.deviation > 0 ? overColor : underColor;
                    return (
                      <line
                        key={i}
                        x1={prev.x}
                        y1={prev.y}
                        x2={p.x}
                        y2={p.y}
                        stroke={segColor}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    );
                  })
                : (
                    <polyline
                      points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={s.dashed ? "5 4" : undefined}
                    />
                  )}
              {points.map((p, i) => {
                const dotColor = s.goal != null ? (p.deviation > 0 ? overColor : underColor) : s.color;
                const isUnder = s.goal != null && p.deviation <= 0;
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="3.2"
                    fill={dotColor}
                    stroke={isUnder ? "var(--hf-white)" : "none"}
                    strokeWidth={isUnder ? 1.5 : 0}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center">
        <button
          type="button"
          aria-label="Vælg dataserier"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="-m-1 flex flex-wrap items-center gap-1.5 rounded-lg p-1 text-hf-black opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-hf-black"
        >
          <span className="flex flex-wrap items-center gap-3">
            {visibleSeries.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label}
                {s.unit ? ` (${s.unit})` : ""}
              </span>
            ))}
          </span>
          <IconChevronDown size={16} stroke={2.5} className={menuOpen ? "rotate-180" : ""} />
        </button>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Luk menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute bottom-11 right-4 z-40 w-52 overflow-hidden rounded-2xl border border-hf-tan-dark bg-hf-white p-1.5 text-hf-black shadow-xl">
            {series.map((s) => {
              const checked = enabledKeys.includes(s.key);
              return (
                <label
                  key={s.key}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-hf-cream"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSeries(s.key)}
                    className="size-4 accent-hf-green"
                  />
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                  {s.unit ? ` (${s.unit})` : ""}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
