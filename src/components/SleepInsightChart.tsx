"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatMinutesOfDay, type SleepStatDay } from "@/lib/sleep-stats";

// Søvngraferne (docs/DECISIONS.md 2026-09-29): oplevet søvn 1–5 som kurve på
// en fast venstre-akse, med tilvalgte bjælker for dagen før natten bagved.
// Bruges både på /statistics/sleep og som tilføjede grafer i statistikmodulet.

export type SleepInsightKind = "quality" | "kcal" | "coffee" | "sport" | "device" | "bodyFat";

type Overlay = {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  format: (value: number) => string;
  time?: boolean;
};

const LEFT = 26;
const RIGHT = 290;
const TOP = 10;
const BOTTOM = 124;
const HEIGHT = BOTTOM - TOP;

function overlaysFor(kind: Exclude<SleepInsightKind, "bodyFat">, days: SleepStatDay[], t: (key: string) => string): Overlay[] {
  const kcal = (v: number) => `${Math.round(v)} kcal`;
  const time = (v: number) => formatMinutesOfDay(v);
  if (kind === "quality") {
    return [
      { key: "lastMeal", label: t("sleepStats.lastMeal"), color: "var(--hf-green)", values: days.map((d) => d.lastMealMinutes), format: time, time: true },
    ];
  }
  if (kind === "kcal") {
    return [{ key: "kcal", label: t("sleepStats.kcal"), color: "var(--hf-green)", values: days.map((d) => d.kcal), format: kcal }];
  }
  if (kind === "coffee") {
    return [
      { key: "coffeeCount", label: t("sleepStats.coffeeCount"), color: "var(--hf-green)", values: days.map((d) => d.coffeeCount || null), format: (v) => `${v}` },
      { key: "lastCoffee", label: t("sleepStats.lastCoffee"), color: "var(--hf-gray)", values: days.map((d) => d.lastCoffeeMinutes), format: time, time: true },
    ];
  }
  if (kind === "sport") {
    return [
      { key: "sportMinutes", label: t("sleepStats.sportMinutes"), color: "var(--hf-green)", values: days.map((d) => d.sportMinutes || null), format: (v) => `${v} min` },
      { key: "lastSport", label: t("sleepStats.lastSport"), color: "var(--hf-gray)", values: days.map((d) => d.lastSportEndMinutes), format: time, time: true },
    ];
  }
  return [
    { key: "deviceSleep", label: t("sleepStats.deviceSleep"), color: "var(--hf-green)", values: days.map((d) => d.deviceSleepHours), format: (v) => `${v.toLocaleString("da-DK")} t` },
  ];
}

// Tidsbjælker skaleres fra kl. 12, så aftenens forskelle kan ses.
function domain(overlay: Overlay): [number, number] {
  const present = overlay.values.filter((v): v is number => v !== null);
  if (overlay.time) return [12 * 60, Math.max(24 * 60, ...present)];
  return [0, Math.max(1, ...present)];
}

function loadEnabled(storageKey: string, fallback: string[]) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : fallback;
  } catch {
    return fallback;
  }
}

export function SleepInsightChart({ kind, days }: { kind: SleepInsightKind; days: SleepStatDay[] }) {
  return kind === "bodyFat" ? <BodyFatChart days={days} /> : <SleepBarChart kind={kind} days={days} />;
}

// Målt søvn vises i forhold til 8 timer (= 100), oplevet søvn 1–5 som 20–100.
const FULL_NIGHT_HOURS = 8;

function toggleStored(storageKey: string, key: string, current: string[]) {
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // localStorage utilgængelig — valget gælder kun nu.
  }
  return next;
}

// Fedtprocent og begge typer søvn på én fælles 0–100-akse (uden %-tegn).
function BodyFatChart({ days }: { days: SleepStatDay[] }) {
  const { t } = useTranslation();
  const storageKey = "hellocal.sleepStats.bodyFat";
  const lines = [
    { key: "experienced", label: t("sleepStats.experienced"), color: "var(--hf-black)", values: days.map((d) => (d.rating === null ? null : d.rating * 20)) },
    { key: "measured", label: t("sleepStats.measuredSleep"), color: "var(--hf-gray)", values: days.map((d) => (d.deviceSleepHours === null ? null : Math.min((d.deviceSleepHours / FULL_NIGHT_HOURS) * 100, 100))) },
    { key: "bodyFat", label: t("sleepStats.bodyFat"), color: "var(--hf-green)", values: days.map((d) => d.bodyFatPercent) },
  ];
  const allKeys = lines.map((l) => l.key);
  const [enabled, setEnabled] = useState<string[]>(allKeys);
  useEffect(() => {
    // localStorage er usynlig for serveren: læs valget efter mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(loadEnabled(storageKey, ["experienced", "measured", "bodyFat"]));
  }, []);

  const n = Math.max(days.length, 1);
  const slot = (RIGHT - LEFT) / n;
  const xCenter = (i: number) => LEFT + slot * (i + 0.5);
  const y = (value: number) => BOTTOM - (value / 100) * HEIGHT;
  const dot = n > 40 ? 1.4 : n > 14 ? 2.2 : 3.2;
  const dateLabel = (date: Date) => date.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
  const labelIndexes = n <= 7 ? days.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div className="rounded-2xl bg-hf-tan p-4">
      <h3 className="hf-type-body hf-type-strong text-hf-black">{t("sleepStats.chart.bodyFat")}</h3>
      <p className="hf-type-small mt-1 text-text-secondary">{t("sleepStats.chartInfo.bodyFat")}</p>
      <svg viewBox="0 0 320 146" className="mt-3 w-full" role="img" aria-label={t("sleepStats.chart.bodyFat")}>
        {[0, 20, 40, 60, 80, 100].map((value) => (
          <g key={value}>
            <line x1={LEFT} x2={RIGHT} y1={y(value)} y2={y(value)} stroke="var(--hf-tan-dark)" strokeWidth="0.6" />
            <text x={LEFT - 6} y={y(value) + 3} textAnchor="end" fontSize="8" fill="var(--hf-black)">
              {value}
            </text>
          </g>
        ))}
        {lines
          .filter((line) => enabled.includes(line.key))
          .map((line) => {
            const points = line.values
              .map((value, i) => (value === null ? null : { x: xCenter(i), y: y(value), i, value }))
              .filter((p): p is { x: number; y: number; i: number; value: number } => p !== null);
            return (
              <g key={line.key}>
                {points.length > 1 && (
                  <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                )}
                {points.map((p) => (
                  <circle key={p.i} cx={p.x} cy={p.y} r={dot} fill={line.color}>
                    <title>{`${dateLabel(days[p.i].date)}: ${Math.round(p.value)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        {labelIndexes.map((i) => (
          <text key={i} x={xCenter(i)} y={140} textAnchor="middle" fontSize="7.5" fill="var(--hf-black)">
            {dateLabel(days[i].date)}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lines.map((line) => (
          <button key={line.key} type="button" aria-pressed={enabled.includes(line.key)} onClick={() => setEnabled((c) => toggleStored(storageKey, line.key, c))} className="hf-choice flex items-center gap-1.5 px-3 py-1.5">
            <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: line.color }} />
            {line.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SleepBarChart({ kind, days }: { kind: Exclude<SleepInsightKind, "bodyFat">; days: SleepStatDay[] }) {
  const { t } = useTranslation();
  const overlays = overlaysFor(kind, days, t);
  // Grafen for sidste indtag er slået fra som standard (tilvalg); de andre viser alt.
  const defaultOn = kind === "quality" ? [] : overlays.map((o) => o.key);
  const storageKey = `hellocal.sleepStats.${kind}`;
  const [enabled, setEnabled] = useState<string[]>(defaultOn);

  useEffect(() => {
    const stored = loadEnabled(storageKey, defaultOn);
    // localStorage er usynlig for serveren: læs valget efter mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(stored);
    // defaultOn er afledt af kind, som storageKey også er.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function toggle(key: string) {
    setEnabled((current) => {
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage utilgængelig — valget gælder kun nu.
      }
      return next;
    });
  }

  const visible = overlays.filter((o) => enabled.includes(o.key));
  const n = Math.max(days.length, 1);
  const slot = (RIGHT - LEFT) / n;
  const barWidth = Math.max((slot * 0.7) / Math.max(visible.length, 1), 0.6);
  const xCenter = (i: number) => LEFT + slot * (i + 0.5);
  const ratingY = (rating: number) => BOTTOM - ((rating - 1) / 4) * HEIGHT;
  const dot = n > 40 ? 1.4 : n > 14 ? 2.2 : 3.2;
  const hasRatings = days.some((d) => d.rating !== null);

  // Kurven brydes, hvor en nat mangler vurdering.
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  days.forEach((day, i) => {
    if (day.rating === null) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push({ x: xCenter(i), y: ratingY(day.rating) });
  });
  if (current.length) segments.push(current);

  const axisOverlay = visible[0];
  const axisDomain = axisOverlay ? domain(axisOverlay) : null;
  const dateLabel = (date: Date) => date.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
  const labelIndexes = n <= 7 ? days.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div className="rounded-2xl bg-hf-tan p-4">
      <h3 className="hf-type-body hf-type-strong text-hf-black">{t(`sleepStats.chart.${kind}`)}</h3>
      <p className="hf-type-small mt-1 text-text-secondary">{t(`sleepStats.chartInfo.${kind}`)}</p>

      <svg viewBox="0 0 320 146" className="mt-3 w-full" role="img" aria-label={t(`sleepStats.chart.${kind}`)}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <g key={rating}>
            <line x1={LEFT} x2={RIGHT} y1={ratingY(rating)} y2={ratingY(rating)} stroke="var(--hf-tan-dark)" strokeWidth="0.6" />
            <text x={LEFT - 6} y={ratingY(rating) + 3} textAnchor="end" fontSize="8" fill="var(--hf-black)">
              {rating}
            </text>
          </g>
        ))}

        {visible.map((overlay, overlayIndex) => {
          const [min, max] = domain(overlay);
          return overlay.values.map((value, i) => {
            if (value === null) return null;
            const h = Math.max(((Math.min(value, max) - min) / (max - min)) * HEIGHT, 1);
            const x = xCenter(i) - (barWidth * visible.length) / 2 + barWidth * overlayIndex;
            return (
              <rect key={`${overlay.key}-${i}`} x={x} y={BOTTOM - h} width={barWidth} height={h} fill={overlay.color} opacity="0.55" rx={Math.min(barWidth / 3, 1.5)}>
                <title>{`${dateLabel(days[i].date)}: ${overlay.format(value)}`}</title>
              </rect>
            );
          });
        })}

        {axisOverlay && axisDomain && (
          <>
            <text x={RIGHT + 4} y={TOP + 3} fontSize="7" fill="var(--hf-black)">
              {axisOverlay.format(axisDomain[1])}
            </text>
            <text x={RIGHT + 4} y={BOTTOM + 3} fontSize="7" fill="var(--hf-black)">
              {axisOverlay.format(axisDomain[0])}
            </text>
          </>
        )}

        {segments.map((segment, i) =>
          segment.length > 1 ? (
            <polyline key={i} points={segment.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--hf-black)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ) : null,
        )}
        {days.map((day, i) =>
          day.rating === null ? null : (
            <circle key={i} cx={xCenter(i)} cy={ratingY(day.rating)} r={dot} fill="var(--hf-black)">
              <title>{`${dateLabel(day.date)}: ${t("sleepQuality.calendarBar", { rating: day.rating })}`}</title>
            </circle>
          ),
        )}

        {labelIndexes.map((i) => (
          <text key={i} x={xCenter(i)} y={140} textAnchor="middle" fontSize="7.5" fill="var(--hf-black)">
            {dateLabel(days[i].date)}
          </text>
        ))}
      </svg>

      {!hasRatings && <p className="hf-type-small mt-2 text-text-secondary">{t("sleepStats.noRatings")}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="hf-type-small flex items-center gap-1.5 text-hf-black">
          <span aria-hidden="true" className="inline-block size-2 rounded-full bg-hf-black" />
          {t("sleepStats.experienced")}
        </span>
        {overlays.map((overlay) => {
          const on = enabled.includes(overlay.key);
          return (
            <button key={overlay.key} type="button" aria-pressed={on} onClick={() => toggle(overlay.key)} className="hf-choice flex items-center gap-1.5 px-3 py-1.5">
              <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: overlay.color }} />
              {overlay.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
