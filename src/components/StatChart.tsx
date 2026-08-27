"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
  /**
   * Optional mål-værdi. Når sat, plottes serien som afvigelse fra målet
   * (0 = målet ramt) i stedet for rå værdier, og punkterne farves efter
   * om de ligger under eller over målet.
   */
  goal?: number;
  /** Farve brugt for punkter under målet (default: hf-green). */
  underGoalColor?: string;
  /** Farve brugt for punkter over målet (default: hf-black). */
  overGoalColor?: string;
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

/** Ligesom normalize, men punkterne afspejler afvigelsen fra `goal` (0 midt på grafen). */
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
      // localStorage utilgængelig (privat browsing e.l.) — ignorér.
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

      {hasGoalSeries && (
        <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-hf-black opacity-50">
          Mål · 0
        </p>
      )}

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
          const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

          return (
            <g key={s.key}>
              <polyline
                points={polyline}
                fill="none"
                stroke={s.goal != null ? "var(--hf-gray)" : s.color}
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((p, i) => {
                const dotColor = s.goal != null ? (p.deviation > 0 ? overColor : underColor) : s.color;
                return <circle key={i} cx={p.x} cy={p.y} r="3.2" fill={dotColor} />;
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
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
