"use client";

import { useEffect, useMemo, useState } from "react";
import { IconChartLine } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { StatChart, type ChartSeries } from "@/components/StatChart";
import { StatCardsGrid } from "@/components/StatCardsGrid";
import { computeStatCards, DEFAULT_ACTIVE_STAT_KEYS, type StatCardValue } from "@/lib/stat-cards";
import { groupByDay, type RegistrationTotals } from "@/lib/daily-totals";
import { DAILY_KCAL_GOAL, WEIGHT_GOAL_KG } from "@/lib/goals";
import { STAT_PERIODS, periodRange, filterDaysInRange, type StatPeriodKey } from "@/lib/stat-periods";

const DAY_COUNT = 7;

type WeightEntry = {
  weightKg: number;
  weighedAt: string;
};

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

export default function StatistikPage() {
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
    ])
      .then(([registrationData, weightData]) => {
        if (cancelled) return;
        setRegistrations(registrationData.registrations);
        setWeightEntries(weightData.entries);
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrations([]);
          setWeightEntries([]);
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

  const chartSeries = useMemo<ChartSeries[]>(
    () => [
      {
        key: "kcal",
        label: "Kalorier",
        color: "var(--hf-green)",
        unit: "kcal",
        values: kcalDaily,
        goal: DAILY_KCAL_GOAL,
      },
      {
        key: "weight",
        label: "Vægt",
        color: "var(--hf-gray)",
        unit: "kg",
        values: weightDaily,
        goal: WEIGHT_GOAL_KG,
      },
    ],
    [kcalDaily, weightDaily],
  );

  const cardsByPeriod = useMemo(() => {
    const map = {} as Record<StatPeriodKey, StatCardValue[]>;
    for (const { key } of STAT_PERIODS) {
      const days = filterDaysInRange(allDays, periodRange(key));
      const cards = computeStatCards({ days });
      map[key] = cards.map((c) => ({ ...c, value: loading ? "—" : c.value }));
    }
    return map;
  }, [allDays, loading]);

  return (
    <HfScreen title="Statistik" icon={<IconChartLine size={20} stroke={2} />}>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <StatChart title="Kalorier og vægt" series={chartSeries} defaultEnabledKeys={["kcal"]} />
          <p className="text-center text-xs font-normal text-hf-black opacity-50">Seneste 7 dage</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-hf-tan-dark pt-4">
          <StatCardsGrid cardsByPeriod={cardsByPeriod} defaultActiveKeys={DEFAULT_ACTIVE_STAT_KEYS} />

          <p className="text-center text-xs font-normal text-hf-black opacity-50">
            Swipe i bokse for at skifte visning
          </p>
        </div>
      </div>
    </HfScreen>
  );
}
