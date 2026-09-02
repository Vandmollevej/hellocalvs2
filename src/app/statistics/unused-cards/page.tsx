"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import {
  activeStatKeys,
  computeStatCards,
  addStatCardToLayout,
  DEFAULT_ACTIVE_STAT_KEYS,
  SPORT_STAT_KEY_PREFIX,
  STAT_WINDOW_DAYS,
  type ActivityTotals,
  type HealthMetricTotals,
  type StatCardValue,
  type StatGridLayoutItem,
} from "@/lib/stat-cards";
import { groupByDay, withinLastDays, type RegistrationTotals } from "@/lib/daily-totals";
import type { IntegrationCardStatus } from "@/lib/integrations";

function withinLastDaysActivities(activities: ActivityTotals[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return activities.filter((activity) => new Date(activity.startedAt).getTime() >= cutoff);
}

function withinLastDaysMetrics(metrics: HealthMetricTotals[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return metrics.filter((metric) => new Date(metric.recordedAt).getTime() >= cutoff);
}

const DEFAULT_LAYOUT: StatGridLayoutItem[] = DEFAULT_ACTIVE_STAT_KEYS.map((key) => ({
  type: "stat" as const,
  key,
}));

// Groups the known stat cards (src/lib/stat-cards.ts) into fixed categories.
// Categories with no matching cards in this codebase are still shown, but with a
// message saying no data exists yet — no new stat types are invented here.
const CATEGORY_KEYS: { title: string; keys: string[] | "dynamic-sport" }[] = [
  { title: "Energi og makrofordeling", keys: ["calories", "protein", "carbs", "fat"] },
  { title: "Kulhydrattyper og fibre", keys: [] },
  { title: "Vitaminer", keys: [] },
  { title: "Mineraler", keys: [] },
  { title: "Aktivitet og øvrige data", keys: ["steps", "water", "burned", "daysLogged", "goalsMet"] },
  // Sport types are dynamic (one per sport the user actually has data for),
  // and only present when at least one real integration is CONNECTED — see
  // computeStatCards()/SPORT_STAT_KEY_PREFIX in src/lib/stat-cards.ts.
  { title: "Sport og aktivitet", keys: "dynamic-sport" },
];

export default function UnusedStatCardsPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [activities, setActivities] = useState<ActivityTotals[]>([]);
  const [metrics, setMetrics] = useState<HealthMetricTotals[]>([]);
  const [hasConnectedIntegration, setHasConnectedIntegration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => activeStatKeys(DEFAULT_LAYOUT));

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
    ])
      .then(([registrationData, activityData, integrationData, metricData]) => {
        if (cancelled) return;
        setRegistrations(registrationData.registrations);
        setActivities(activityData.activities);
        setHasConnectedIntegration(
          integrationData.integrations.some((i) => i.connectable && i.status === "CONNECTED"),
        );
        setMetrics(metricData.metrics);
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrations([]);
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

  const allCards = useMemo(() => {
    const days = groupByDay(withinLastDays(registrations, STAT_WINDOW_DAYS));
    const recentActivities = withinLastDaysActivities(activities, STAT_WINDOW_DAYS);
    const recentMetrics = withinLastDaysMetrics(metrics, STAT_WINDOW_DAYS);
    return computeStatCards({
      days,
      activities: hasConnectedIntegration ? recentActivities : undefined,
      metrics: recentMetrics,
    });
  }, [registrations, activities, metrics, hasConnectedIntegration]);

  const cardByKey = useMemo(() => new Map(allCards.map((c) => [c.key, c])), [allCards]);

  function addCard(key: string) {
    addStatCardToLayout(DEFAULT_LAYOUT, key);
    setActiveKeys((prev) => new Set(prev).add(key));
    router.back();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Ubrugte statistik-kort" onBack={() => router.back()} />

      <div className="flex flex-col gap-5 p-4">
        <p className="text-xs text-hf-black opacity-60">
          Tryk på et kort for at tilføje det til din statistikside.
        </p>

        {CATEGORY_KEYS.map((category) => {
          const cards =
            category.keys === "dynamic-sport"
              ? allCards.filter((c) => c.key.startsWith(SPORT_STAT_KEY_PREFIX) && !activeKeys.has(c.key))
              : category.keys
                  .map((key) => cardByKey.get(key))
                  .filter((c): c is StatCardValue => Boolean(c))
                  .filter((c) => !activeKeys.has(c.key));

          return (
            <section key={category.title} className="flex flex-col gap-2">
              <p className="hf-heading text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
                {category.title}
              </p>

              {cards.length === 0 ? (
                <p className="rounded-2xl bg-hf-tan/60 p-3 text-xs text-hf-black opacity-50">
                  Ingen kort her endnu.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {cards.map((card) => {
                    const CardIcon = card.icon;
                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() => addCard(card.key)}
                        className="rounded-2xl bg-hf-tan p-4 text-left active:opacity-80"
                      >
                        <p className="text-xs text-hf-black opacity-60">{card.label}</p>
                        <p className="hf-heading mt-1 flex items-center gap-1.5 text-xl text-hf-black">
                          <CardIcon size={17} stroke={2} />
                          {loading ? "—" : card.value}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
