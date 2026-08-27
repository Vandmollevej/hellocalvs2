"use client";

import { useEffect, useMemo, useState } from "react";
import { IconChartLine } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { StatChart, type ChartSeries } from "@/components/StatChart";
import { StatCardsGrid } from "@/components/StatCardsGrid";
import { computeStatCards, STAT_WINDOW_DAYS } from "@/lib/stat-cards";
import { groupByDay, withinLastDays, type RegistrationTotals } from "@/lib/daily-totals";

const WEEK_COUNT = 6;
const DEFAULT_ACTIVE_CARD_KEYS = ["calories", "protein", "daysLogged", "goalsMet"];

type WeightEntry = {
  weightKg: number;
  weighedAt: string;
};

function weightWeeklyAverages(entries: WeightEntry[]) {
  const cutoff = Date.now() - WEEK_COUNT * 7 * 24 * 60 * 60 * 1000;
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const entry of entries) {
    const date = new Date(entry.weighedAt);
    const time = date.getTime();
    if (time < cutoff) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const existing = byDay.get(key) ?? { sum: 0, count: 0 };
    existing.sum += entry.weightKg;
    existing.count += 1;
    byDay.set(key, existing);
  }
  const days = Array.from(byDay.entries()).map(([dateKey, { sum, count }]) => ({
    dateKey,
    value: sum / count,
  }));
  return weeklyAverages(days);
}

function weeklyAverages(days: { dateKey: string; value: number }[]) {
  const now = Date.now();

  return Array.from({ length: WEEK_COUNT }, (_, weekIndex) => {
    const weeksAgo = WEEK_COUNT - 1 - weekIndex;
    const windowStart = now - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000;
    const windowEnd = now - weeksAgo * 7 * 24 * 60 * 60 * 1000;

    const daysInWeek = days.filter((day) => {
      const [y, m, d] = day.dateKey.split("-").map(Number);
      const time = new Date(y, m, d).getTime();
      return time >= windowStart && time < windowEnd;
    });

    if (daysInWeek.length === 0) return 0;
    return daysInWeek.reduce((sum, day) => sum + day.value, 0) / daysInWeek.length;
  });
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

  const kcalWeekly = useMemo(() => {
    const days = groupByDay(withinLastDays(registrations, WEEK_COUNT * 7)).map((d) => ({
      dateKey: d.dateKey,
      value: d.kcal,
    }));
    return weeklyAverages(days);
  }, [registrations]);

  const weightWeekly = useMemo(() => weightWeeklyAverages(weightEntries), [weightEntries]);

  const chartSeries = useMemo<ChartSeries[]>(
    () => [
      { key: "kcal", label: "Kalorier", color: "var(--hf-green)", values: kcalWeekly },
      { key: "weight", label: "Vægt", color: "var(--hf-gray)", values: weightWeekly },
    ],
    [kcalWeekly, weightWeekly],
  );

  const statCards = useMemo(() => {
    const days = groupByDay(withinLastDays(registrations, STAT_WINDOW_DAYS));
    return computeStatCards({ days });
  }, [registrations]);

  const displayCards = useMemo(
    () => statCards.map((c) => ({ ...c, value: loading ? "—" : c.value })),
    [statCards, loading],
  );

  return (
    <HfScreen title="Statistik" icon={<IconChartLine size={20} stroke={2} />}>
      <div className="flex flex-col gap-4 p-4">
        <StatChart
          title={`Kalorier — gennemsnit pr. uge (seneste ${WEEK_COUNT} uger)`}
          series={chartSeries}
          defaultEnabledKeys={["kcal"]}
        />

        <StatCardsGrid cards={displayCards} defaultActiveKeys={DEFAULT_ACTIVE_CARD_KEYS} />

        <p className="text-center text-xs text-hf-black opacity-60">
          Statistikken viser fakta, ikke fremgangs-badges eller streaks.
        </p>
      </div>
    </HfScreen>
  );
}
