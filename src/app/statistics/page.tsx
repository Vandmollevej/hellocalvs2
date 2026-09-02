"use client";

import { useEffect, useMemo, useState } from "react";
import { IconChartLine } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { StatChart, type ChartSeries } from "@/components/StatChart";
import { StatCardsGrid } from "@/components/StatCardsGrid";
import { StatPeriodPicker } from "@/components/StatPeriodPicker";
import { IntradayKcalChart } from "@/components/IntradayKcalChart";
import {
  computeStatCards,
  DEFAULT_ACTIVE_STAT_KEYS,
  type ActivityTotals,
  type HealthMetricTotals,
} from "@/lib/stat-cards";
import { groupByDay, type RegistrationTotals } from "@/lib/daily-totals";
import { DAILY_KCAL_GOAL, WEIGHT_GOAL_KG } from "@/lib/goals";
import { DEFAULT_STAT_SELECTION, filterDaysInRange, selectionRange, type StatPeriodSelection } from "@/lib/stat-periods";
import type { IntegrationCardStatus } from "@/lib/integrations";
import { computeTrendWeight, type WeightSample, type MealSample } from "@/lib/weight-trend";

const DAY_COUNT = 7;

type WeightEntry = {
  weightKg: number;
  weighedAt: string;
  timeOfDay: WeightSample["timeOfDay"];
};

function filterActivitiesInRange(activities: ActivityTotals[], range: { start: Date; end: Date }) {
  return activities.filter((activity) => {
    const time = new Date(activity.startedAt).getTime();
    return time >= range.start.getTime() && time < range.end.getTime();
  });
}

function filterActivitiesInRangeRegistrations(
  registrations: RegistrationTotals[],
  range: { start: Date; end: Date },
) {
  return registrations.filter((registration) => {
    const time = new Date(registration.createdAt).getTime();
    return time >= range.start.getTime() && time < range.end.getTime();
  });
}

function dateKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Én værdi pr. dag for de seneste `dayCount` dage (i dag inklusive). */
function dailySeries(days: { dateKey: string; value: number }[], dayCount: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: dayCount }, (_, i) => {
    const dayOffset = dayCount - 1 - i;
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const key = dateKeyFromDate(date);
    return days.find((d) => d.dateKey === key)?.value ?? 0;
  });
}

function weightByDay(entries: WeightEntry[]) {
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const entry of entries) {
    const key = dateKeyFromDate(new Date(entry.weighedAt));
    const existing = byDay.get(key) ?? { sum: 0, count: 0 };
    existing.sum += entry.weightKg;
    existing.count += 1;
    byDay.set(key, existing);
  }
  return Array.from(byDay.entries()).map(([dateKey, { sum, count }]) => ({
    dateKey,
    value: sum / count,
  }));
}

function trendByDay(points: { dateKey: string; trendKg: number }[]) {
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const point of points) {
    const existing = byDay.get(point.dateKey) ?? { sum: 0, count: 0 };
    existing.sum += point.trendKg;
    existing.count += 1;
    byDay.set(point.dateKey, existing);
  }
  return Array.from(byDay.entries()).map(([dateKey, { sum, count }]) => ({
    dateKey,
    value: sum / count,
  }));
}

export default function StatisticsPage() {
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [activities, setActivities] = useState<ActivityTotals[]>([]);
  const [metrics, setMetrics] = useState<HealthMetricTotals[]>([]);
  const [hasConnectedIntegration, setHasConnectedIntegration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [periodSelection, setPeriodSelection] = useState<StatPeriodSelection>(DEFAULT_STAT_SELECTION);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/registrations").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente registreringer");
        return (await response.json()) as { registrations: RegistrationTotals[] };
      }),
      fetch("/api/weight-entries").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente vejninger");
        return (await response.json()) as { entries: WeightEntry[] };
      }),
      fetch("/api/activities").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente aktiviteter");
        return (await response.json()) as { activities: ActivityTotals[] };
      }),
      fetch("/api/integrations").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente integrationer");
        return (await response.json()) as { integrations: IntegrationCardStatus[] };
      }),
      fetch("/api/health-metrics").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente sundhedsdata");
        return (await response.json()) as { metrics: HealthMetricTotals[] };
      }),
    ])
      .then(([registrationData, weightData, activityData, integrationData, metricData]) => {
        if (cancelled) return;
        setRegistrations(registrationData.registrations);
        setWeightEntries(weightData.entries);
        setActivities(activityData.activities);
        setHasConnectedIntegration(
          integrationData.integrations.some((i) => i.connectable && i.status === "CONNECTED"),
        );
        setMetrics(metricData.metrics);
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrations([]);
          setWeightEntries([]);
          setActivities([]);
          setHasConnectedIntegration(false);
          setMetrics([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const allDays = useMemo(() => groupByDay(registrations), [registrations]);

  const kcalDaily = useMemo(
    () => dailySeries(allDays.map((d) => ({ dateKey: d.dateKey, value: d.kcal })), DAY_COUNT),
    [allDays],
  );

  const weightDaily = useMemo(() => dailySeries(weightByDay(weightEntries), DAY_COUNT), [weightEntries]);

  const trendPoints = useMemo(() => {
    const samples: WeightSample[] = weightEntries.map((entry) => ({
      weightKg: entry.weightKg,
      weighedAt: entry.weighedAt,
      timeOfDay: entry.timeOfDay,
    }));
    const meals: MealSample[] = registrations.map((r) => ({ createdAt: r.createdAt }));
    return computeTrendWeight(samples, meals);
  }, [weightEntries, registrations]);

  const weightTrendDaily = useMemo(
    () => (trendPoints ? dailySeries(trendByDay(trendPoints), DAY_COUNT) : null),
    [trendPoints],
  );

  const chartSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: "kcal",
        label: "Kalorier",
        color: "var(--hf-green)",
        unit: "kcal",
        values: kcalDaily,
        goal: DAILY_KCAL_GOAL,
        colorByGoal: true,
      },
      {
        key: "weight",
        label: "Vægt",
        color: "var(--hf-gray)",
        unit: "kg",
        values: weightDaily,
        goal: WEIGHT_GOAL_KG,
        showPointStatus: true,
      },
      ...(weightTrendDaily
        ? [
            {
              key: "weightTrend",
              label: "Trendvægt (AI-estimat)",
              color: "var(--hf-black)",
              unit: "kg",
              values: weightTrendDaily,
              dashed: true,
            } satisfies ChartSeries,
          ]
        : []),
    ],
    [kcalDaily, weightDaily, weightTrendDaily],
  );

  const activePeriodRange = useMemo(() => selectionRange(periodSelection), [periodSelection]);

  const activePeriodDays = useMemo(
    () => Math.max(1, Math.round((activePeriodRange.end.getTime() - activePeriodRange.start.getTime()) / 86400000)),
    [activePeriodRange],
  );

  // Ét globalt periodevalg (StatPeriodPicker) gælder for både statistik-kortene og
  // dagsprofilen herunder — ikke længere ét periodevalg pr. kort (swipe er fjernet).
  const statCards = useMemo(() => {
    const days = filterDaysInRange(allDays, activePeriodRange);
    const cards = computeStatCards({
      days,
      activities: hasConnectedIntegration ? filterActivitiesInRange(activities, activePeriodRange) : undefined,
      metrics: metrics.filter((m) => {
        const time = new Date(m.recordedAt).getTime();
        return time >= activePeriodRange.start.getTime() && time < activePeriodRange.end.getTime();
      }),
    });
    return cards.map((c) => ({ ...c, value: loading ? "—" : c.value }));
  }, [allDays, activities, hasConnectedIntegration, metrics, loading, activePeriodRange]);

  const recentRegistrations = useMemo(
    () => filterActivitiesInRangeRegistrations(registrations, activePeriodRange),
    [registrations, activePeriodRange],
  );

  return (
    <HfScreen title="Statistik" icon={<IconChartLine size={20} stroke={2} />}>
      <div className="flex flex-col gap-4 p-4">
        <StatChart title="Kalorier og vægt" series={chartSeries} defaultEnabledKeys={["kcal"]} />

        <IntradayKcalChart registrations={recentRegistrations} windowDays={activePeriodDays} />

        <div className="flex flex-col gap-3 border-t border-hf-tan-dark pt-4">
          <div className="flex items-center justify-end">
            <StatPeriodPicker selection={periodSelection} onChange={setPeriodSelection} />
          </div>

          <StatCardsGrid cards={statCards} defaultActiveKeys={DEFAULT_ACTIVE_STAT_KEYS} />
        </div>
      </div>
    </HfScreen>
  );
}
