"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionSection } from "@/components/hf/AccordionSection";
import { StatChartPreviewList } from "@/components/StatChartPreviewList";
import { useStatChartRenderer } from "@/components/useStatChartRenderer";
import { withinLastDays, type RegistrationTotals } from "@/lib/daily-totals";
import type { ActivityTotals, HealthMetricTotals } from "@/lib/stat-cards";
import { nutritionSectionLabel } from "@/lib/nutrition-terminology";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  addChartsToLayout,
  BODY_MEASUREMENT_CHART_KEYS,
  DEFAULT_ACTIVE_CHART_KEYS,
  loadChartLayout,
  statChartDef,
  statChartLabel,
  type StatChartDef,
} from "@/lib/stat-charts";

// Samme opbygning som /statistics/unused-cards, men for graferne øverst på
// statistiksiden: søgning på tværs af blokkene og "+ Tilføj" på hver graf
// (én ad gangen, ingen "tilføj alle" pr. blok). Graferne vises i fuld bredde,
// som de vil se ud.

type ChartOption = { key: string; label: string };
const PREVIEW_INTRADAY_DAYS = 7;
type CategoryDef = { title: string; keys: string[] };

function categoryDefs(t: (key: string) => string, region: string): CategoryDef[] {
  return [
    { title: t("statUnusedCharts.category.energyWeight"), keys: ["caloriesAndWeight", "intradayKcal", "sleepQuality"] },
    { title: t("bodyMeasurements.title"), keys: BODY_MEASUREMENT_CHART_KEYS },
    {
      title: nutritionSectionLabel(region),
      keys: [
        "daily:protein", "daily:carbs", "daily:fat", "daily:saturatedFat", "daily:unsaturatedFat",
        "daily:transFat", "daily:cholesterol", "daily:salt",
      ],
    },
    { title: t("statUnusedCards.category.carbsFibre"), keys: ["daily:sugar", "daily:fiber"] },
    { title: t("statUnusedCards.category.sleep"), keys: ["sleep:quality", "sleep:kcal", "sleep:coffee", "sleep:sport", "sleep:device", "sleep:bodyFat"] },
    { title: t("statUnusedCards.category.minerals"), keys: ["minerals"] },
    { title: t("statUnusedCards.category.vitamins"), keys: ["vitamins"] },
  ];
}

function chartOption(def: StatChartDef, t: (key: string) => string): ChartOption {
  return { key: def.key, label: statChartLabel(def, t) };
}

export default function UnusedStatChartsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [region, setRegion] = useState("DK");
  // localStorage er usynlig for serveren: start med standardgraferne og skift efter mount.
  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => new Set(DEFAULT_ACTIVE_CHART_KEYS));
  const [query, setQuery] = useState("");
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [activities, setActivities] = useState<ActivityTotals[]>([]);
  const [metrics, setMetrics] = useState<HealthMetricTotals[]>([]);

  // Data til forhåndsvisningen af graferne.
  useEffect(() => {
    let cancelled = false;
    const load = <T,>(url: string, pick: (data: T) => void) =>
      fetch(url)
        .then(async (response) => (response.ok ? ((await response.json()) as T) : null))
        .then((data) => {
          if (!cancelled && data) pick(data);
        })
        .catch(() => undefined);
    load<{ registrations: RegistrationTotals[] }>("/api/registrations", (d) => setRegistrations(d.registrations));
    load<{ activities: ActivityTotals[] }>("/api/activities", (d) => setActivities(d.activities));
    load<{ metrics: HealthMetricTotals[] }>("/api/health-metrics", (d) => setMetrics(d.metrics));
    return () => {
      cancelled = true;
    };
  }, []);

  const previewRegistrations = useMemo(() => withinLastDays(registrations, PREVIEW_INTRADAY_DAYS), [registrations]);
  const renderChart = useStatChartRenderer({
    registrations,
    activities,
    metrics,
    intradayRegistrations: previewRegistrations,
    intradayWindowDays: PREVIEW_INTRADAY_DAYS,
  });

  useEffect(() => {
    function syncActiveKeys() {
      setActiveKeys(new Set(loadChartLayout()));
    }
    syncActiveKeys();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente profil");
        return (await response.json()) as { user: { region?: string } };
      })
      .then((data) => {
        if (!cancelled) setRegion(data.user.region ?? "DK");
      })
      .catch(() => {
        if (!cancelled) setRegion("DK");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () =>
      categoryDefs(t, region).map((category) => ({
        title: category.title,
        options: category.keys
          .filter((key) => !activeKeys.has(key))
          .map((key) => statChartDef(key))
          .filter((def): def is StatChartDef => Boolean(def))
          .map((def) => chartOption(def, t)),
      })),
    [t, region, activeKeys],
  );

  // Søgning på tværs af alle blokke: matcher grafens navn eller blokkens titel.
  const normalizedQuery = query.trim().toLocaleLowerCase("da");
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return categories.flatMap((category) => {
      const categoryMatches = category.title.toLocaleLowerCase("da").includes(normalizedQuery);
      return category.options.filter(
        (option) => categoryMatches || option.label.toLocaleLowerCase("da").includes(normalizedQuery),
      );
    });
  }, [categories, normalizedQuery]);

  function addCharts(keys: string[]) {
    addChartsToLayout(keys);
    setActiveKeys((prev) => new Set([...prev, ...keys]));
    router.back();
  }

  function renderGrid(options: ChartOption[]) {
    return (
      <StatChartPreviewList
        keys={options.map((option) => option.key)}
        renderChart={renderChart}
        onAdd={(key) => addCharts([key])}
      />
    );
  }

  return (
    <HfScreen title={t("statUnusedCharts.title")}>
      <div className="hf-page hf-page--list">
        <p className="hf-type-small text-text-secondary">{t("statUnusedCharts.hint")}</p>

        <div className="hf-search">
          <IconSearch size={16} color="var(--hf-black)" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("statUnusedCharts.searchPlaceholder")}
            aria-label={t("statUnusedCharts.searchPlaceholder")}
          />
        </div>

        {normalizedQuery && (
          <section className="flex flex-col gap-2 pb-2">
            <p className="hf-type-body hf-type-strong px-1 text-hf-black">{t("statUnusedCards.searchResults")}</p>
            {searchResults.length === 0 ? (
              <p className="hf-type-small rounded-2xl bg-hf-tan/60 p-4 text-hf-black opacity-50">
                {t("statUnusedCharts.noSearchResults")}
              </p>
            ) : (
              renderGrid(searchResults)
            )}
          </section>
        )}

        {categories.map((category, index) => (
          <AccordionSection
            key={category.title}
            title={category.title}
            count={category.options.length}
            defaultOpen={index === 0}
            bodyClassName={category.options.length === 0 ? "p-3" : "py-3"}
          >
            {category.options.length === 0 ? (
              <p className="hf-type-small rounded-2xl bg-hf-tan/60 p-4 text-hf-black opacity-50">
                {t("statUnusedCharts.noChartsLeft")}
              </p>
            ) : (
              renderGrid(category.options)
            )}
          </AccordionSection>
        ))}
      </div>
    </HfScreen>
  );
}
