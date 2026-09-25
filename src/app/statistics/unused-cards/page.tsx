"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionSection } from "@/components/hf/AccordionSection";
import { StatCardIcon } from "@/components/StatCardIcon";
import {
  activeStatKeys,
  computeStatCards,
  addDividerToLayout,
  addHeaderToLayout,
  addStatCardToLayout,
  DEFAULT_ACTIVE_STAT_KEYS,
  FOOD_SOURCE_STAT_KEYS,
  SPORT_STAT_KEY_PREFIX,
  STAT_WINDOW_DAYS,
  type ActivityTotals,
  type HealthMetricTotals,
  type StatCardValue,
  type StatGridLayoutItem,
} from "@/lib/stat-cards";
import { nutritionSectionLabel } from "@/lib/nutrition-terminology";
import { groupByDay, withinLastDays, type RegistrationTotals } from "@/lib/daily-totals";
import type { IntegrationCardStatus } from "@/lib/integrations";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useSourceRegistrations } from "@/lib/use-source-registrations";
import { registrationsWithinLastDays } from "@/lib/food-classification";

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

type CategoryDef = { title: string; keys: string[]; includeSportCards?: boolean };

// Groups the known stat cards (src/lib/stat-cards.ts) into fixed categories.
// Categories with no matching cards in this codebase are still shown, but with a
// message saying no data exists yet — no new stat types are invented here.
function categoryDefs(t: (key: string) => string, region: string): CategoryDef[] {
  return [
    // Fat breakdown/cholesterol are the MyFitnessPal-style extended panel
    // (2026-09-11, Open Food Facts-sourced products only, see
    // src/lib/openFoodFacts.ts) — grouped here since they're macro-related.
    // Title is the region's own consumer wording (e.g. "Næringsindhold" in
    // Denmark), not a fixed "Makroer"/"energyMacros" label, per
    // src/lib/nutrition-terminology.ts.
    {
      title: nutritionSectionLabel(region),
      keys: ["calories", "protein", "carbs", "fat", "saturatedFat", "unsaturatedFat", "transFat", "cholesterol", "salt"],
    },
    // Sugar/fiber come from Product.nutritionExtra (HelloFresh recipes only,
    // see docs/DECISIONS.md 2026-08-29) — real data, not invented.
    { title: t("statUnusedCards.category.carbsFibre"), keys: ["sugar", "fiber"] },
    // Mineraler = only periodic-table elements; salt (not an element) lives
    // under Næringsindhold above. Vitamins are their own separate group.
    {
      title: t("statUnusedCards.category.minerals"),
      keys: [
        "calcium", "chloride", "chromium", "fluoride", "phosphorus", "iron",
        "iodine", "potassium", "copper", "magnesium", "manganese", "molybdenum",
        "sodium", "selenium", "zinc",
      ],
    },
    {
      title: t("statUnusedCards.category.vitamins"),
      keys: [
        "vitaminA", "vitaminB1", "vitaminB2", "vitaminB3", "vitaminB5", "vitaminB6",
        "vitaminB7", "vitaminB9", "vitaminB12", "vitaminC", "vitaminD", "vitaminE",
        "vitaminK",
      ],
    },
    // G3: kød, fisk, sukkerholdige drikke og alkohol (totaler for perioden).
    { title: "Kød, fisk og drikke", keys: FOOD_SOURCE_STAT_KEYS },
    { title: t("statUnusedCards.category.allergensAdditives"), keys: ["allergens", "additives"] },
    {
      // Sport types are dynamic (one per sport the user actually has data
      // for, plus five pinned types even before there's any data), and only
      // present when at least one real integration is CONNECTED — see
      // computeStatCards()/SPORT_STAT_KEY_PREFIX in src/lib/stat-cards.ts.
      title: t("statUnusedCards.category.sportActivity"),
      keys: [
        "steps", "distanceKm", "burned", "exerciseMinutes", "standMinutes", "floorsClimbed",
        "activeZoneMinutes", "heartRate", "restingHeartRate", "restingHeartRateMinutes",
        "heartRateMin", "heartRateMax", "hrv", "vo2Max", "heartRateRecovery",
        "respiratoryRate", "spo2", "temperature", "stress", "edaResponses", "cardioLoad",
      ],
      includeSportCards: true,
    },
    {
      title: t("statUnusedCards.category.sleep"),
      keys: [
        "sleepDuration", "sleepInBed", "sleepBedtime", "sleepWakeTime", "sleepAwake",
        "sleepRem", "sleepLight", "sleepDeep", "sleepScore", "sleepEfficiency", "sleepAwakenings",
      ],
    },
    { title: t("statUnusedCards.category.other"), keys: ["water", "daysLogged", "goalsMet"] },
  ];
}

export default function UnusedStatCardsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [activities, setActivities] = useState<ActivityTotals[]>([]);
  const [metrics, setMetrics] = useState<HealthMetricTotals[]>([]);
  const [hasConnectedIntegration, setHasConnectedIntegration] = useState(false);
  const [region, setRegion] = useState("DK");
  const [loading, setLoading] = useState(true);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => activeStatKeys(DEFAULT_LAYOUT));
  const { registrations: sourceRegistrations, loading: sourcesLoading } = useSourceRegistrations();
  const [query, setQuery] = useState("");

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
        return (await response.json()) as { user: { region?: string } };
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
        setRegion(profileData.user.region ?? "DK");
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrations([]);
          setActivities([]);
          setHasConnectedIntegration(false);
          setMetrics([]);
          setRegion("DK");
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
      sources: sourcesLoading
        ? undefined
        : registrationsWithinLastDays(sourceRegistrations, STAT_WINDOW_DAYS),
    });
  }, [registrations, activities, metrics, hasConnectedIntegration, sourceRegistrations, sourcesLoading]);

  const cardByKey = useMemo(() => new Map(allCards.map((c) => [c.key, c])), [allCards]);

  const categories = useMemo(
    () =>
      categoryDefs(t, region).map((category) => {
        const categoryCards = category.keys
          .map((key) => cardByKey.get(key))
          .filter((c): c is StatCardValue => Boolean(c));
        const sportCards = category.includeSportCards
          ? allCards.filter((c) => c.key.startsWith(SPORT_STAT_KEY_PREFIX))
          : [];
        const cards = [...categoryCards, ...sportCards].filter((c) => !activeKeys.has(c.key));
        return { title: category.title, cards };
      }),
    [t, region, cardByKey, allCards, activeKeys],
  );

  // Søgning på tværs af alle blokke: matcher kortets navn eller blokkens titel.
  const normalizedQuery = query.trim().toLocaleLowerCase("da");
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    const seen = new Set<string>();
    const results: StatCardValue[] = [];
    for (const category of categories) {
      const categoryMatches = category.title.toLocaleLowerCase("da").includes(normalizedQuery);
      for (const card of category.cards) {
        if (seen.has(card.key)) continue;
        if (categoryMatches || card.label.toLocaleLowerCase("da").includes(normalizedQuery)) {
          seen.add(card.key);
          results.push(card);
        }
      }
    }
    return results;
  }, [categories, normalizedQuery]);

  function addCard(key: string) {
    addStatCardToLayout(DEFAULT_LAYOUT, key);
    setActiveKeys((prev) => new Set(prev).add(key));
    router.back();
  }

  function addAllCards(cards: StatCardValue[]) {
    for (const card of cards) addStatCardToLayout(DEFAULT_LAYOUT, card.key);
    setActiveKeys((prev) => new Set([...prev, ...cards.map((card) => card.key)]));
    router.back();
  }

  function renderCardGrid(cards: StatCardValue[]) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => addCard(card.key)}
            className="rounded-2xl bg-hf-tan p-4 text-left active:opacity-80"
          >
            <p className="text-xs text-hf-black opacity-60">{card.label}</p>
            <p className="hf-heading mt-1 flex items-center gap-1.5 text-xl text-hf-black">
              <StatCardIcon icon={card.icon} iconSrc={card.iconSrc} />
              {loading ? "—" : card.value}
            </p>
          </button>
        ))}
      </div>
    );
  }

  function addHeader() {
    addHeaderToLayout(DEFAULT_LAYOUT);
    router.back();
  }

  function addDivider() {
    addDividerToLayout(DEFAULT_LAYOUT);
    router.back();
  }

  return (
    <HfScreen
      title={t("statUnusedCards.title")}
    >
      <div className="flex flex-col gap-2 p-4">
        <p className="text-xs text-hf-black opacity-60">
          {t("statUnusedCards.hint")}
        </p>

        <div className="hf-search">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("statUnusedCards.searchPlaceholder")}
            aria-label={t("statUnusedCards.searchPlaceholder")}
          />
        </div>

        <button
          type="button"
          onClick={addHeader}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-hf-black/30 text-sm font-semibold text-hf-black opacity-80 active:opacity-100"
        >
          {t("statUnusedCards.addHeading")}
        </button>

        <button
          type="button"
          onClick={addDivider}
          className="flex min-h-11 w-full items-center gap-3 text-sm font-semibold text-hf-black active:opacity-60"
        >
          <span aria-hidden className="h-0.5 flex-1 bg-hf-black" />
          {t("statUnusedCards.addDivider")}
          <span aria-hidden className="h-0.5 flex-1 bg-hf-black" />
        </button>

        {normalizedQuery && (
          <section className="flex flex-col gap-2 pb-2">
            <p className="px-1 text-sm font-semibold text-hf-black">
              {t("statUnusedCards.searchResults")}
            </p>
            {searchResults.length === 0 ? (
              <p className="rounded-2xl bg-hf-tan/60 p-3 text-xs text-hf-black opacity-50">
                {t("statUnusedCards.noSearchResults")}
              </p>
            ) : (
              renderCardGrid(searchResults)
            )}
          </section>
        )}

        {categories.map((category, index) => (
          // Only the first group (Næringsindhold) starts open.
          <AccordionSection
            key={category.title}
            title={category.title}
            count={category.cards.length}
            defaultOpen={index === 0}
            action={
              category.cards.length > 0 ? (
                <button
                  type="button"
                  onClick={() => addAllCards(category.cards)}
                  aria-label={`${t("statUnusedCards.addAll")} ${category.title}`}
                  className="shrink-0 py-3 pr-4 pl-1 text-sm font-semibold text-hf-black active:opacity-60"
                >
                  {t("statUnusedCards.addAll")}
                </button>
              ) : undefined
            }
          >
            {category.cards.length === 0 ? (
              <p className="rounded-2xl bg-hf-tan/60 p-3 text-xs text-hf-black opacity-50">
                {t("statUnusedCards.noCardsYet")}
              </p>
            ) : (
              renderCardGrid(category.cards)
            )}
          </AccordionSection>
        ))}

      </div>
    </HfScreen>
  );
}
