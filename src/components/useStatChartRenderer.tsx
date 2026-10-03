"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatChart, type ChartSeries } from "@/components/StatChart";
import { SleepInsightChart } from "@/components/SleepInsightChart";
import { IntradayKcalChart } from "@/components/IntradayKcalChart";
import { BodyMeasurementChart } from "@/components/BodyMeasurementChart";
import type { BodyMeasurementSex } from "@/lib/body-measurements";
import type { BodyMeasurementSeriesEntry } from "@/lib/body-measurement-series";
import { kgToLb, useUnits } from "@/lib/units";
import { buildSleepStatDays, sleepPeriodDays } from "@/lib/sleep-stats";
import { groupByDay, type RegistrationTotals } from "@/lib/daily-totals";
import type { ActivityTotals, HealthMetricTotals } from "@/lib/stat-cards";
import { DAILY_KCAL_GOAL, WEIGHT_GOAL_KG } from "@/lib/goals";
import { makeBudgetLookup, type BudgetSnapshot } from "@/lib/daily-budget";
import {
  dailyChartLabel,
  NUTRIENT_GROUP_DEFAULT_SERIES,
  nutrientGroupMembers,
  statChartDef,
  statChartLabel,
} from "@/lib/stat-charts";
import { computeTrendWeight, type WeightSample, type MealSample } from "@/lib/weight-trend";
import { fetchSleepQuality, localDateKey } from "@/lib/sleep-quality";
import { useTranslation } from "@/i18n/LocaleProvider";

// Tegner graferne i statistikmodulet ud fra deres nÃ¸gle (src/lib/stat-charts.ts).
// Delt af statistiksiden og "TilfÃ¸j til statistik", sÃ¥ en graf ser ens ud,
// fÃ¸r og efter den er tilfÃ¸jet. VÃ¦gt, sÃ¸vnkvalitet og kaloriemÃ¥l hentes her;
// registreringer/aktiviteter/sundhedsdata har siderne i forvejen.

const DAY_COUNT = 7;

// Serier under vægten i "Kalorier og vægt" (kun når integrationens opsætning
// har fedtprocent m.m. slået til). Samme HealthMetricType-navne som
// integrationerne skriver (src/lib/goal-composition.ts). Farver: grafernes
// tilladte undtagelser i design.md §3 + familie-blå til væske.
const BODY_COMPOSITION_SERIES = [
  { type: "BODY_FAT_PERCENT", labelKey: "statistics.bodyFat", unit: "%", color: "var(--hf-red-muted)" },
  { type: "MUSCLE_MASS_KG", labelKey: "statistics.muscleMass", unit: "kg", color: "var(--hf-green-muted)" },
  { type: "BODY_WATER_PERCENT", labelKey: "statistics.bodyWater", unit: "%", color: "var(--hf-color-watch)" },
] as const;

type WeightEntry = {
  weightKg: number;
  weighedAt: string;
  timeOfDay: WeightSample["timeOfDay"];
};

// Grafernes tilladte farver (design.md Â§3: grafer-undtagelsen). Efter de syv
// farver gentages de med stiplet linje.
const GROUP_COLORS = [
  "var(--hf-green)",
  "var(--hf-black)",
  "var(--hf-red-muted)",
  "var(--hf-green-light)",
  "var(--hf-gray)",
  "var(--hf-lime)",
  "var(--hf-green-muted)",
];

function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Ã‰n vÃ¦rdi pr. dag for de seneste `dayCount` dage (i dag inklusive). */
function dailySeries(days: { dateKey: string; value: number }[], dayCount: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (dayCount - 1 - i));
    const key = dateKeyFromDate(date);
    return days.find((d) => d.dateKey === key)?.value ?? 0;
  });
}

function averageByDay(points: { dateKey: string; value: number }[]) {
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const point of points) {
    const existing = byDay.get(point.dateKey) ?? { sum: 0, count: 0 };
    existing.sum += point.value;
    existing.count += 1;
    byDay.set(point.dateKey, existing);
  }
  return Array.from(byDay.entries()).map(([dateKey, { sum, count }]) => ({ dateKey, value: sum / count }));
}

function useChartExtras(enabled: boolean) {
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [sleepEntries, setSleepEntries] = useState<{ date: string; rating: number }[]>([]);
  const [budgetSnapshots, setBudgetSnapshots] = useState<BudgetSnapshot[]>([]);
  // Kropsmål-graferne (body:*): hentes for sig, så en fejl her ikke tømmer resten.
  const [bodyEntries, setBodyEntries] = useState<BodyMeasurementSeriesEntry[]>([]);
  const [bodyLoading, setBodyLoading] = useState(true);
  // Køn styrer kun, hvilke tegninger Kropsmål-graferne viser.
  const [sex, setSex] = useState<BodyMeasurementSex | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - (DAY_COUNT - 1));
    fetch("/api/weight-entries")
      .then(async (response) => (response.ok ? ((await response.json()) as { entries: WeightEntry[] }) : null))
      .then((data) => {
        if (!cancelled && data) setWeightEntries(data.entries ?? []);
      })
      .catch(() => undefined);
    fetchSleepQuality(localDateKey(from), localDateKey(today))
      .then((entries) => {
        if (!cancelled) setSleepEntries(entries);
      })
      .catch(() => undefined);
    // KaloriemÃ¥l pr. dato â€” kun fremadrettet (src/lib/daily-budget.ts).
    fetch("/api/daily-budgets")
      .then(async (response) => (response.ok ? ((await response.json()) as { snapshots: BudgetSnapshot[] }) : null))
      .then((data) => {
        if (!cancelled && data) setBudgetSnapshots(data.snapshots ?? []);
      })
      .catch(() => undefined);
    fetch("/api/profile")
      .then(async (response) => (response.ok ? ((await response.json()) as { user: { sex?: BodyMeasurementSex | null } }) : null))
      .then((data) => {
        if (!cancelled && data) setSex(data.user.sex ?? null);
      })
      .catch(() => undefined);
    fetch("/api/body-measurements")
      .then(async (response) => (response.ok ? ((await response.json()) as { entries: BodyMeasurementSeriesEntry[] }) : null))
      .then((data) => {
        if (!cancelled && data) setBodyEntries(data.entries ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setBodyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { weightEntries, sleepEntries, budgetSnapshots, bodyEntries, bodyLoading, sex };
}

export function useStatChartRenderer({
  registrations,
  activities,
  metrics,
  intradayRegistrations,
  intradayWindowDays,
  enabled = true,
  bodyCompositionEnabled = false,
}: {
  registrations: RegistrationTotals[];
  activities: ActivityTotals[];
  metrics: HealthMetricTotals[];
  /** Registreringerne i den valgte periode (dagsprofilen fÃ¸lger periodevalget). */
  intradayRegistrations: RegistrationTotals[];
  intradayWindowDays: number;
  /** False mens siden endnu kun er et skelet: så hentes ingen data. */
  enabled?: boolean;
  /** Fedt, muskel og kropsvand som valgbare serier under vægten. */
  bodyCompositionEnabled?: boolean;
}) {
  const { t } = useTranslation();
  const { weightEntries, sleepEntries, budgetSnapshots, bodyEntries, bodyLoading, sex } = useChartExtras(enabled);
  // Grafen vises i kg eller pund (stone er for groft til en akse).
  const { weight: weightUnit } = useUnits();
  const chartWeightUnit = weightUnit === "kg" ? "kg" : "lb";
  const toChartWeight = useCallback((kg: number) => (weightUnit === "kg" ? kg : kgToLb(kg)), [weightUnit]);

  const allDays = useMemo(() => groupByDay(registrations), [registrations]);

  const kcalDaily = useMemo(
    () => dailySeries(allDays.map((d) => ({ dateKey: d.dateKey, value: d.kcal })), DAY_COUNT),
    [allDays],
  );

  const kcalGoalDaily = useMemo(() => {
    const lookup = makeBudgetLookup(budgetSnapshots, DAILY_KCAL_GOAL);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAY_COUNT }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (DAY_COUNT - 1 - i));
      return lookup(date);
    });
  }, [budgetSnapshots]);

  const weightDaily = useMemo(
    () =>
      dailySeries(
        averageByDay(weightEntries.map((e) => ({ dateKey: dateKeyFromDate(new Date(e.weighedAt)), value: e.weightKg }))),
        DAY_COUNT,
      ),
    [weightEntries],
  );

  const weightTrendDaily = useMemo(() => {
    const samples: WeightSample[] = weightEntries.map((entry) => ({
      weightKg: entry.weightKg,
      weighedAt: entry.weighedAt,
      timeOfDay: entry.timeOfDay,
    }));
    const meals: MealSample[] = registrations.map((r) => ({ createdAt: r.createdAt }));
    const points = computeTrendWeight(samples, meals);
    return points
      ? dailySeries(averageByDay(points.map((p) => ({ dateKey: p.dateKey, value: p.trendKg }))), DAY_COUNT)
      : null;
  }, [weightEntries, registrations]);

  // Dagsgennemsnit pr. kropssammensætnings-mål fra smartvægt/sundhedsapp.
  const bodyCompositionSeries = useMemo<ChartSeries[]>(() => {
    if (!bodyCompositionEnabled) return [];
    return BODY_COMPOSITION_SERIES.flatMap(({ type, labelKey, unit, color }) => {
      const points = metrics
        .filter((metric) => metric.type === type)
        .map((metric) => ({ dateKey: dateKeyFromDate(new Date(metric.recordedAt)), value: metric.value }));
      if (points.length === 0) return [];
      const values = dailySeries(averageByDay(points), DAY_COUNT);
      return [{ key: type, label: t(labelKey), color, unit, values, showPointStatus: true }];
    });
  }, [bodyCompositionEnabled, metrics, t]);

  const chartSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: "kcal",
        label: t("statistics.calories"),
        color: "var(--hf-green)",
        unit: "kcal",
        values: kcalDaily,
        goal: kcalGoalDaily[kcalGoalDaily.length - 1] ?? DAILY_KCAL_GOAL,
        goals: kcalGoalDaily,
        colorByGoal: true,
      },
      {
        key: "weight",
        label: t("statistics.weight"),
        color: "var(--hf-gray)",
        unit: chartWeightUnit,
        values: weightDaily.map(toChartWeight),
        goal: toChartWeight(WEIGHT_GOAL_KG),
        showPointStatus: true,
      },
      ...(weightTrendDaily
        ? [
            {
              key: "weightTrend",
              label: t("statistics.trendWeight"),
              color: "var(--hf-black)",
              unit: chartWeightUnit,
              values: weightTrendDaily.map(toChartWeight),
              dashed: true,
            } satisfies ChartSeries,
          ]
        : []),
      ...bodyCompositionSeries,
    ],
    [kcalDaily, kcalGoalDaily, weightDaily, weightTrendDaily, bodyCompositionSeries, t, chartWeightUnit, toChartWeight],
  );

  const sleepChartSeries = useMemo<ChartSeries[]>(() => {
    const sleepDaily = dailySeries(
      sleepEntries.map((entry) => {
        const [y, m, d] = entry.date.split("-").map(Number);
        return { dateKey: dateKeyFromDate(new Date(y, m - 1, d)), value: entry.rating };
      }),
      DAY_COUNT,
    );
    return [
      { key: "sleepQuality", label: t("statistics.sleepQuality"), color: "var(--hf-black)", unit: "1â€“5", values: sleepDaily },
      { key: "kcal", label: t("statistics.calories"), color: "var(--hf-green)", unit: "kcal", values: kcalDaily },
    ];
  }, [sleepEntries, kcalDaily, t]);

  // SÃ¸vnstatistikkens grafer: altid de seneste 7 dage som de Ã¸vrige grafer.
  const sleepStatDays = useMemo(
    () => buildSleepStatDays({ days: sleepPeriodDays("last7"), ratings: sleepEntries, registrations, activities, metrics }),
    [sleepEntries, registrations, activities, metrics],
  );

  return useCallback(
    (key: string) => {
      const def = statChartDef(key);
      if (!def) return null;
      if (def.kind === "caloriesAndWeight") {
        return <StatChart title={statChartLabel(def, t)} series={chartSeries} defaultEnabledKeys={["kcal"]} />;
      }
      if (def.kind === "sleepQuality") {
        return (
          <StatChart
            title={statChartLabel(def, t)}
            series={sleepChartSeries}
            defaultEnabledKeys={["sleepQuality", "kcal"]}
            storageKey="hellocal.statistik.sleepSeries"
          />
        );
      }
      if (def.kind === "sleepInsight") {
        return <SleepInsightChart kind={def.insight} days={sleepStatDays} />;
      }
      if (def.kind === "intradayKcal") {
        return <IntradayKcalChart registrations={intradayRegistrations} windowDays={intradayWindowDays} />;
      }
      if (def.kind === "bodyMeasurement") {
        return <BodyMeasurementChart field={def.field} entries={bodyEntries} sex={sex} loading={bodyLoading} />;
      }
      if (def.kind === "nutrientGroup") {
        // Alle mineraler/vitaminer kan krydses af i grafens dropdown.
        const series = nutrientGroupMembers(def.group).map(
          (member, index): ChartSeries => ({
            key: member.key,
            label: dailyChartLabel(member.key),
            color: GROUP_COLORS[index % GROUP_COLORS.length],
            dashed: index >= GROUP_COLORS.length,
            unit: member.unit,
            values: dailySeries(
              allDays.map((d) => ({ dateKey: d.dateKey, value: d.nutrients[member.key] ?? 0 })),
              DAY_COUNT,
            ),
          }),
        );
        return (
          <StatChart
            title={statChartLabel(def, t)}
            storageKey={`hellocal.statistik.series.${def.key}`}
            defaultEnabledKeys={NUTRIENT_GROUP_DEFAULT_SERIES[def.group]}
            series={series}
          />
        );
      }
      const label = statChartLabel(def, t);
      const values = dailySeries(
        allDays.map((d) => ({ dateKey: d.dateKey, value: d[def.field] })),
        DAY_COUNT,
      );
      return (
        <StatChart
          title={label}
          storageKey={`hellocal.statistik.series.${def.key}`}
          defaultEnabledKeys={[def.field]}
          series={[{ key: def.field, label, color: "var(--hf-green)", unit: def.unit, values }]}
        />
      );
    },
    [t, chartSeries, sleepChartSeries, sleepStatDays, intradayRegistrations, intradayWindowDays, allDays, bodyEntries, sex, bodyLoading],
  );
}
