"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionSection } from "@/components/hf/AccordionSection";
import { TrendIcon } from "@/components/BottomNav";
import { nutritionSectionLabel } from "@/lib/nutrition-terminology";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  addChartsToLayout,
  dailyChartLabel,
  DEFAULT_ACTIVE_CHART_KEYS,
  loadChartLayout,
  statChartDef,
  type StatChartDef,
} from "@/lib/stat-charts";

// Samme opbygning som /statistics/unused-cards, men for graferne øverst på
// statistiksiden: søgning på tværs af blokkene og "+ Tilføj" pr. blok.

type ChartOption = { key: string; label: string; subtitle: string };
type CategoryDef = { title: string; keys: string[] };

function categoryDefs(t: (key: string) => string, region: string): CategoryDef[] {
  return [
    { title: t("statUnusedCharts.category.energyWeight"), keys: ["caloriesAndWeight", "intradayKcal"] },
    {
      title: nutritionSectionLabel(region),
      keys: [
        "daily:protein", "daily:carbs", "daily:fat", "daily:saturatedFat", "daily:unsaturatedFat",
        "daily:transFat", "daily:cholesterol", "daily:salt",
      ],
    },
    { title: t("statUnusedCards.category.carbsFibre"), keys: ["daily:sugar", "daily:fiber"] },
    { title: t("statUnusedCards.category.minerals"), keys: ["daily:potassium", "daily:calcium", "daily:iron"] },
    { title: t("statUnusedCards.category.vitamins"), keys: ["daily:vitaminA", "daily:vitaminC"] },
  ];
}

function chartOption(def: StatChartDef, t: (key: string) => string): ChartOption {
  if (def.kind === "caloriesAndWeight") {
    return { key: def.key, label: t("statistics.caloriesAndWeightChart"), subtitle: t("statChart.last7Days") };
  }
  if (def.kind === "intradayKcal") {
    return { key: def.key, label: t("statUnusedCharts.intradayKcal"), subtitle: t("statUnusedCharts.dayProfile") };
  }
  return { key: def.key, label: dailyChartLabel(def.field), subtitle: t("statChart.last7Days") };
}

export default function UnusedStatChartsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [region, setRegion] = useState("DK");
  // localStorage er usynlig for serveren: start med standardgraferne og skift efter mount.
  const [activeKeys, setActiveKeys] = useState<Set<string>>(() => new Set(DEFAULT_ACTIVE_CHART_KEYS));
  const [query, setQuery] = useState("");

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
      <div className="grid grid-cols-2 gap-4">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => addCharts([option.key])}
            className="rounded-2xl bg-hf-tan p-4 text-left active:opacity-80"
          >
            <p className="hf-type-small text-text-secondary">{option.subtitle}</p>
            <p className="hf-type-body hf-heading mt-1 flex items-center gap-1.5 text-hf-black">
              <TrendIcon color="currentColor" size={16} />
              {option.label}
            </p>
          </button>
        ))}
      </div>
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
            action={
              category.options.length > 0 ? (
                <button
                  type="button"
                  onClick={() => addCharts(category.options.map((option) => option.key))}
                  aria-label={`${t("statUnusedCards.addAll")} ${category.title}`}
                  className="hf-type-body hf-type-strong shrink-0 py-3 pr-4 pl-1 text-hf-black active:opacity-60"
                >
                  {t("statUnusedCards.addAll")}
                </button>
              ) : undefined
            }
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
