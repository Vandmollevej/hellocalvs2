"use client";

// Væskestatistik: kropsvand (%) pr. dag mod kalorier, salt og sukker.
// Se src/lib/water-stats.ts.

import { useMemo, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SLEEP_STAT_PERIODS, sleepPeriodDays, type SleepStatPeriodKey } from "@/lib/sleep-stats";
import { useSleepStatInputs } from "@/lib/use-sleep-stat-inputs";
import { buildWaterStatDays, waterCorrelation, WATER_FACTORS, type WaterFactorKey } from "@/lib/water-stats";
import type { RegistrationTotals } from "@/lib/daily-totals";

const LEFT = 8;
const RIGHT = 312;
const TOP = 10;
const BOTTOM = 124;

function scale(values: (number | null)[]) {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return () => BOTTOM;
  const min = Math.min(...present);
  const max = Math.max(...present);
  return (v: number) => (max === min ? (TOP + BOTTOM) / 2 : BOTTOM - ((v - min) / (max - min)) * (BOTTOM - TOP));
}

export default function BodyWaterStatisticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<SleepStatPeriodKey>("last30");
  const [factor, setFactor] = useState<WaterFactorKey>("salt");
  const periodDays = useMemo(() => sleepPeriodDays(period), [period]);
  const inputs = useSleepStatInputs();
  const days = useMemo(
    () => buildWaterStatDays({ days: periodDays, registrations: inputs.registrations as unknown as RegistrationTotals[], metrics: inputs.metrics }),
    [periodDays, inputs.registrations, inputs.metrics],
  );

  const n = Math.max(days.length, 1);
  const x = (i: number) => LEFT + ((RIGHT - LEFT) / n) * (i + 0.5);
  const yWater = scale(days.map((d) => d.waterPercent));
  const yFactor = scale(days.map((d) => d[factor]));
  const line = (values: (number | null)[], y: (v: number) => number, color: string) => {
    const pts = values.flatMap((v, i) => (v === null ? [] : [{ x: x(i), y: y(v), i }]));
    return (
      <g>
        {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />}
        {pts.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={n > 40 ? 1.4 : 3} fill={color} />
        ))}
      </g>
    );
  };

  const hasWater = days.some((d) => d.waterPercent !== null);
  const r = waterCorrelation(days, factor);

  return (
    <HfScreen title={t("waterStats.title")}>
      <div className="hf-page">
        <div className="hf-card hf-card--brand">
          <p className="hf-type-small">{t("waterStats.intro")}</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("sleepStats.periodAria")}>
          {SLEEP_STAT_PERIODS.map((key) => (
            <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)} className="hf-choice px-3 py-1.5">
              {t(`sleepStats.period.${key}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group">
          {WATER_FACTORS.map(({ key }) => (
            <button key={key} type="button" aria-pressed={factor === key} onClick={() => setFactor(key)} className="hf-choice px-3 py-1.5">
              {t(`waterStats.factor.${key}`)}
            </button>
          ))}
        </div>
        {inputs.loading ? (
          <div className="h-56 animate-pulse rounded-2xl bg-hf-tan" />
        ) : !hasWater ? (
          <p className="hf-type-small text-text-secondary text-center">{t("waterStats.noData")}</p>
        ) : (
          <div className="hf-card">
            <svg viewBox="0 0 320 130" className="w-full" role="img" aria-label={t("waterStats.title")}>
              {line(days.map((d) => d[factor]), yFactor, "var(--hf-gray)")}
              {line(days.map((d) => d.waterPercent), yWater, "var(--hf-green)")}
            </svg>
            <div className="mt-3 flex flex-wrap gap-4">
              <span className="hf-type-small flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-hf-brand" />{t("waterStats.water")}</span>
              <span className="hf-type-small flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-hf-inactive" />{t(`waterStats.factor.${factor}`)}</span>
            </div>
            <p className="hf-type-small mt-3 text-hf-black">
              {r === null ? t("waterStats.correlationNone") : t("waterStats.correlation", { value: String(r).replace(".", ",") })}
            </p>
          </div>
        )}
      </div>
    </HfScreen>
  );
}
