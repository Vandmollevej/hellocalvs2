"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconChevronUp, IconPlus } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { TrendIcon } from "@/components/BottomNav";
import { StatChart, type ChartSeries } from "@/components/StatChart";
import { StatCardsGrid } from "@/components/StatCardsGrid";
import { StatChartsSection } from "@/components/StatChartsSection";
import { StatPeriodPicker } from "@/components/StatPeriodPicker";
import { SleepInsightChart } from "@/components/SleepInsightChart";
import { BodyMeasurementChart } from "@/components/BodyMeasurementChart";
import type { BodyMeasurementSex } from "@/lib/body-measurements";
import type { BodyMeasurementSeriesEntry } from "@/lib/body-measurement-series";
import { buildSleepStatDays, sleepPeriodDays } from "@/lib/sleep-stats";
import { IntradayKcalChart } from "@/components/IntradayKcalChart";
import { TopSinnersCard } from "@/components/TopSinnersCard";
import { filterRegistrationsInRange, SINNERS_ENABLED } from "@/lib/food-classification";
import { useSourceRegistrations } from "@/lib/use-source-registrations";
import {
  computeStatCards,
  DEFAULT_ACTIVE_STAT_KEYS,
  type ActivityTotals,
  type HealthMetricTotals,
} from "@/lib/stat-cards";
import { groupByDay, type RegistrationTotals } from "@/lib/daily-totals";
import { DAILY_KCAL_GOAL, WEIGHT_GOAL_KG } from "@/lib/goals";
import { kgToLb, useUnits } from "@/lib/units";
import { makeBudgetLookup, type BudgetSnapshot } from "@/lib/daily-budget";
import { DEFAULT_STAT_SELECTION, filterDaysInRange, selectionRange, type StatPeriodSelection } from "@/lib/stat-periods";
import type { IntegrationCardStatus } from "@/lib/integrations";
import { dailyChartLabel, statChartDef } from "@/lib/stat-charts";
import { computeTrendWeight, type WeightSample, type MealSample } from "@/lib/weight-trend";
import { useTranslation } from "@/i18n/LocaleProvider";
import { fetchSleepQuality, localDateKey } from "@/lib/sleep-quality";
import {
  DEFAULT_STAT_SECTION_ORDER,
  loadSectionOrder,
  moveSection,
  saveSectionOrder,
  type StatSectionKey,
} from "@/lib/stat-sections";

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
  const { t } = useTranslation();
  // Grafen vises i kg eller pund (stone er for groft til en akse).
  const { weight: weightUnit } = useUnits();
  const chartWeightUnit = weightUnit === "kg" ? "kg" : "lb";
  const toChartWeight = useCallback((kg: number) => (weightUnit === "kg" ? kg : kgToLb(kg)), [weightUnit]);
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [activities, setActivities] = useState<ActivityTotals[]>([]);
  const [metrics, setMetrics] = useState<HealthMetricTotals[]>([]);
  const [hasConnectedIntegration, setHasConnectedIntegration] = useState(false);
  // Kaloriemål pr. dato — kun fremadrettet (src/lib/daily-budget.ts).
  const [budgetSnapshots, setBudgetSnapshots] = useState<BudgetSnapshot[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily-budgets")
      .then(async (response) => (response.ok ? ((await response.json()) as { snapshots: BudgetSnapshot[] }) : null))
      .then((data) => {
        if (!cancelled && data) setBudgetSnapshots(data.snapshots ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
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
  const [warnOnRecommendedLimits, setWarnOnRecommendedLimits] = useState(false);
  const [autoExpandUncertainty, setAutoExpandUncertainty] = useState(false);
  const [loading, setLoading] = useState(true);
  // Brugeren vælger selv, om Grafer eller Kort står øverst. localStorage er
  // usynlig for serveren: render standarden først og skift efter mount.
  const [sectionOrder, setSectionOrder] = useState<StatSectionKey[]>(DEFAULT_STAT_SECTION_ORDER);
  const [periodSelection, setPeriodSelection] = useState<StatPeriodSelection>(DEFAULT_STAT_SELECTION);
  // "Tilføj" vises kun mens en sektion er i redigeringstilstand (blokkene
  // vibrerer) — eller er tom, så indhold altid kan tilføjes igen.
  const [showAddChart, setShowAddChart] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const showAdd = showAddChart || showAddCard;
  // G3: registreringer med klassifikation til kød/drikke-kortene og "Største syndere".
  const { registrations: sourceRegistrations, loading: sourcesLoading } = useSourceRegistrations();
  // Oplevelse af søvn (docs/DECISIONS.md 2026-09-26): 1–5 per day, plotted
  // next to the calorie intake.
  const [sleepEntries, setSleepEntries] = useState<{ date: string; rating: number }[]>([]);
  // Kropsmål-graferne (body:*): hentes for sig, så en fejl her ikke tømmer
  // resten af statistikken. Køn styrer kun, hvilke tegninger der vises.
  const [bodyEntries, setBodyEntries] = useState<BodyMeasurementSeriesEntry[]>([]);
  const [bodyLoading, setBodyLoading] = useState(true);
  const [sex, setSex] = useState<BodyMeasurementSex | null>(null);

  useEffect(() => {
    let cancelled = false;
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
  }, []);

  useEffect(() => {
    function syncSectionOrder() {
      setSectionOrder(loadSectionOrder());
    }
    syncSectionOrder();
  }, []);

  function onMoveSection(key: StatSectionKey, delta: -1 | 1) {
    setSectionOrder((prev) => {
      const next = moveSection(prev, key, delta);
      saveSectionOrder(next);
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - (DAY_COUNT - 1));
    fetchSleepQuality(localDateKey(from), localDateKey(today))
      .then((entries) => {
        if (!cancelled) setSleepEntries(entries);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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
      fetch("/api/profile").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente profil");
        return (await response.json()) as {
          user: { warnOnRecommendedLimits?: boolean; autoExpandUncertainty?: boolean; sex?: BodyMeasurementSex | null };
        };
      }),
    ])
      .then(([registrationData, weightData, activityData, integrationData, metricData, profileData]) => {
        if (cancelled) return;
        setRegistrations(registrationData.registrations);
        setWeightEntries(weightData.entries);
        setActivities(activityData.activities);
        setHasConnectedIntegration(
          integrationData.integrations.some((i) => i.connectable && i.status === "CONNECTED"),
        );
        setMetrics(metricData.metrics);
        setWarnOnRecommendedLimits(Boolean(profileData.user.warnOnRecommendedLimits));
        setAutoExpandUncertainty(Boolean(profileData.user.autoExpandUncertainty));
        setSex(profileData.user.sex ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrations([]);
          setWeightEntries([]);
          setActivities([]);
          setHasConnectedIntegration(false);
          setMetrics([]);
          setWarnOnRecommendedLimits(false);
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
    ],
    [kcalDaily, kcalGoalDaily, weightDaily, weightTrendDaily, t, chartWeightUnit, toChartWeight],
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
      {
        key: "sleepQuality",
        label: t("statistics.sleepQuality"),
        color: "var(--hf-black)",
        unit: "1–5",
        values: sleepDaily,
      },
      {
        key: "kcal",
        label: t("statistics.calories"),
        color: "var(--hf-green)",
        unit: "kcal",
        values: kcalDaily,
      },
    ];
  }, [sleepEntries, kcalDaily, t]);

  // Søvnstatistikkens grafer, når de er tilføjet her: altid de seneste 7 dage
  // som de øvrige grafer.
  const sleepStatDays = useMemo(
    () => buildSleepStatDays({ days: sleepPeriodDays("last7"), ratings: sleepEntries, registrations, activities, metrics }),
    [sleepEntries, registrations, activities, metrics],
  );

  const activePeriodRange = useMemo(() => selectionRange(periodSelection), [periodSelection]);

  const activePeriodDays = useMemo(
    () => Math.max(1, Math.round((activePeriodRange.end.getTime() - activePeriodRange.start.getTime()) / 86400000)),
    [activePeriodRange],
  );

  const periodSources = useMemo(
    () => filterRegistrationsInRange(sourceRegistrations, activePeriodRange),
    [sourceRegistrations, activePeriodRange],
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
      sources: sourcesLoading ? undefined : periodSources,
    });
    return cards.map((c) => ({ ...c, value: loading ? "—" : c.value, loading }));
  }, [allDays, activities, hasConnectedIntegration, metrics, loading, activePeriodRange, sourcesLoading, periodSources]);

  const recentRegistrations = useMemo(
    () => filterActivitiesInRangeRegistrations(registrations, activePeriodRange),
    [registrations, activePeriodRange],
  );

  const renderChart = useCallback(
    (key: string) => {
      const def = statChartDef(key);
      if (!def) return null;
      if (def.kind === "caloriesAndWeight") {
        return (
          <StatChart title={t("statistics.caloriesAndWeightChart")} series={chartSeries} defaultEnabledKeys={["kcal"]} />
        );
      }
      if (def.kind === "sleepQuality") {
        return (
          <StatChart
            title={t("statistics.sleepQualityChart")}
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
        return <IntradayKcalChart registrations={recentRegistrations} windowDays={activePeriodDays} />;
      }
      if (def.kind === "bodyMeasurement") {
        return <BodyMeasurementChart field={def.field} entries={bodyEntries} sex={sex} loading={bodyLoading} />;
      }
      const label = dailyChartLabel(def.field);
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
    [t, chartSeries, sleepChartSeries, sleepStatDays, recentRegistrations, activePeriodDays, allDays, bodyEntries, sex, bodyLoading],
  );

  function renderSectionHeader(key: StatSectionKey, title: string) {
    const index = sectionOrder.indexOf(key);
    return (
      <div className="flex items-center justify-between gap-2">
        <h2 className="hf-type-body-lg hf-heading text-hf-black">{title}</h2>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onMoveSection(key, -1)}
            disabled={index <= 0}
            aria-label={t("statSections.moveUp")}
            className="flex size-8 items-center justify-center text-hf-black disabled:opacity-25"
          >
            <IconChevronUp size={18} stroke={2} />
          </button>
          <button
            type="button"
            onClick={() => onMoveSection(key, 1)}
            disabled={index >= sectionOrder.length - 1}
            aria-label={t("statSections.moveDown")}
            className="flex size-8 items-center justify-center text-hf-black disabled:opacity-25"
          >
            <IconChevronDown size={18} stroke={2} />
          </button>
        </div>
      </div>
    );
  }

  function renderSection(key: StatSectionKey) {
    if (key === "charts") {
      return (
        <>
          {renderSectionHeader(key, t("statSections.chartsHeading"))}
          <StatChartsSection renderChart={renderChart} onShowAddChange={setShowAddChart} />
        </>
      );
    }
    return (
      <>
        {renderSectionHeader(key, t("statSections.cardsHeading"))}
        <div className="relative z-40">
          <StatPeriodPicker selection={periodSelection} onChange={setPeriodSelection} />
        </div>
        <StatCardsGrid
          cards={statCards}
          defaultActiveKeys={DEFAULT_ACTIVE_STAT_KEYS}
          highlightRecommendedLimits={warnOnRecommendedLimits}
          autoExpandUncertainty={autoExpandUncertainty}
          onShowAddChange={setShowAddCard}
        />
        {SINNERS_ENABLED && <TopSinnersCard registrations={periodSources} loading={sourcesLoading} />}
      </>
    );
  }

  return (
    <HfScreen title={t("statistics.title")} icon={<TrendIcon color="currentColor" size={20} />}>
      <div className="hf-page">
        {/* Ét samlet "Tilføj" øverst: grafer og kort vælges på samme side.
            Kun synlig i redigeringstilstand (eller når en sektion er tom). */}
        {showAdd && (
          <div className="flex justify-end">
            <Link
              href="/statistics/unused-cards"
              className="hf-type-small hf-type-strong flex min-h-8 items-center gap-1 text-hf-black"
            >
              <IconPlus size={14} stroke={2.5} />
              {t("statSections.add")}
            </Link>
          </div>
        )}

        {sectionOrder.map((key, index) => (
          <section
            key={key}
            className={`flex flex-col gap-4 ${index > 0 ? "border-t border-hf-tan-dark pt-4" : ""}`}
          >
            {renderSection(key)}
          </section>
        ))}
      </div>
    </HfScreen>
  );
}
