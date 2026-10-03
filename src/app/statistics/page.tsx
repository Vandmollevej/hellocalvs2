"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconChevronUp, IconPlus } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { TrendIcon } from "@/components/BottomNav";
import { StatCardsGrid } from "@/components/StatCardsGrid";
import { StatChartsSection } from "@/components/StatChartsSection";
import { useStatChartRenderer } from "@/components/useStatChartRenderer";
import { StatPeriodPicker } from "@/components/StatPeriodPicker";
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
import { DEFAULT_STAT_SELECTION, filterDaysInRange, selectionRange, type StatPeriodSelection } from "@/lib/stat-periods";
import type { IntegrationCardStatus } from "@/lib/integrations";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DEFAULT_STAT_SECTION_ORDER,
  loadSectionOrder,
  moveSection,
  saveSectionOrder,
  type StatSectionKey,
} from "@/lib/stat-sections";

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

export default function StatisticsPage() {
  const { t } = useTranslation();
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [activities, setActivities] = useState<ActivityTotals[]>([]);
  const [metrics, setMetrics] = useState<HealthMetricTotals[]>([]);
  const [hasConnectedIntegration, setHasConnectedIntegration] = useState(false);
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
  useEffect(() => {
    function syncSectionOrder() {
      setSectionOrder(loadSectionOrder());
    }
    syncSectionOrder();
  }, []);

  // Sektionsoverskrifterne ("Grafer"/"Kort") med op/ned-pile hører kun til
  // redigeringstilstanden (langt tryk på en graf eller et kort). I almindelig
  // visning står indholdet uden overskrifter.
  const [editingSections, setEditingSections] = useState<Record<StatSectionKey, boolean>>({
    charts: false,
    cards: false,
  });
  const onChartsEditModeChange = useCallback((editing: boolean) => {
    setEditingSections((prev) => (prev.charts === editing ? prev : { ...prev, charts: editing }));
  }, []);
  const onCardsEditModeChange = useCallback((editing: boolean) => {
    setEditingSections((prev) => (prev.cards === editing ? prev : { ...prev, cards: editing }));
  }, []);
  const showSectionHeaders = editingSections.charts || editingSections.cards;

  function onMoveSection(key: StatSectionKey, delta: -1 | 1) {
    setSectionOrder((prev) => {
      const next = moveSection(prev, key, delta);
      saveSectionOrder(next);
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/registrations").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente registreringer");
        return (await response.json()) as { registrations: RegistrationTotals[] };
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
          user: { warnOnRecommendedLimits?: boolean; autoExpandUncertainty?: boolean };
        };
      }),
    ])
      .then(([registrationData, activityData, integrationData, metricData, profileData]) => {
        if (cancelled) return;
        setRegistrations(registrationData.registrations);
        setActivities(activityData.activities);
        setHasConnectedIntegration(
          integrationData.integrations.some((i) => i.connectable && i.status === "CONNECTED"),
        );
        setMetrics(metricData.metrics);
        setWarnOnRecommendedLimits(Boolean(profileData.user.warnOnRecommendedLimits));
        setAutoExpandUncertainty(Boolean(profileData.user.autoExpandUncertainty));
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrations([]);
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

  const renderChart = useStatChartRenderer({
    registrations,
    activities,
    metrics,
    intradayRegistrations: recentRegistrations,
    intradayWindowDays: activePeriodDays,
  });

  function renderSectionHeader(key: StatSectionKey, title: string) {
    if (!showSectionHeaders) return null;
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
