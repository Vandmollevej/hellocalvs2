"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  IconArrowsSort,
  IconEye,
  IconLeaf,
  IconList,
  IconMeat,
  IconMedicalCross,
  IconUsersGroup,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionSection } from "@/components/hf/AccordionSection";
import { PersonsSlider } from "@/components/hf/PersonsSlider";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DEFAULT_RECIPE_FILTERS,
  RECIPE_ALLERGENS,
  RECIPE_DIETS,
  RECIPE_NUTRIENTS,
  RECIPE_SORTS,
  loadRecipeFilters,
  saveRecipeFilters,
  type MacroKey,
  type MacroLevel,
  type RecipeFilters,
} from "@/lib/recipe-filters";
import { MAX_RECIPE_PERSONS, portionKcalFor, type PortionProfile } from "@/lib/recipe-portions";

// Opskrifter → Delte retter → filterikonet (docs/DECISIONS.md 2026-09-25).
// Valgene gemmes med det samme; tilbagepilen fører til søgningen, som
// læser dem igen.

const SORT_KEYS = { relevance: "recipes.sortRelevance", popular: "recipes.sortPopular", date: "recipes.sortDate" };
const MACRO_OPTIONS: { key: MacroKey; level: MacroLevel }[] = [
  { key: "protein", level: "high" },
  { key: "protein", level: "low" },
  { key: "carbs", level: "high" },
  { key: "carbs", level: "low" },
  { key: "fat", level: "high" },
  { key: "fat", level: "low" },
];

function Row({ label, checked, onChange, divider = true }: { label: string; checked: boolean; onChange: (value: boolean) => void; divider?: boolean }) {
  return (
    <div className={`flex min-h-12 items-center gap-3 py-2 ${divider ? "border-b border-hf-tan-dark" : ""}`}>
      <span className="hf-type-body flex-1 text-hf-black">{label}</span>
      <Toggle checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

function toggleIn<T>(list: T[], value: T, on: boolean) {
  return on ? (list.includes(value) ? list : [...list, value]) : list.filter((v) => v !== value);
}

function RecipeFiltersContent() {
  const { t, locale } = useTranslation();
  const [filters, setFilters] = useState<RecipeFilters>(loadRecipeFilters);
  const [portionKcal, setPortionKcal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: PortionProfile }) : {}))
      .then((data) => setPortionKcal(portionKcalFor(data.user)))
      .catch(() => setPortionKcal(portionKcalFor(null)));
  }, []);

  function update(next: RecipeFilters) {
    setFilters(next);
    saveRecipeFilters(next);
  }

  function setMacro(key: MacroKey, level: MacroLevel, on: boolean) {
    const macros = { ...filters.macros };
    if (on) macros[key] = level;
    else if (macros[key] === level) delete macros[key];
    update({ ...filters, macros });
  }

  const allergens = useMemo(
    () =>
      RECIPE_ALLERGENS.map((key) => ({ key, label: t(`recipeFilters.allergens.${key}`) })).sort((a, b) =>
        a.label.localeCompare(b.label, locale),
      ),
    [t, locale],
  );

  return (
    <HfScreen title={t("recipeFilters.title")}>
      <div className="hf-page">
          <AccordionSection
            title={t("recipeFilters.personsTitle")}
            icon={<IconUsersGroup size={20} stroke={1.75} />}
            count={filters.persons}
          >
            <div className="bg-hf-cream px-4 py-2">
              <PersonsSlider
                label={t("recipeFilters.personsLabel")}
                value={filters.persons}
                max={MAX_RECIPE_PERSONS}
                onChange={(persons) => update({ ...filters, persons })}
              />
              {portionKcal !== null && (
                <p className="hf-type-small text-text-secondary pt-3">
                  {t("recipeFilters.portionHint", { kcal: portionKcal })}
                </p>
              )}
            </div>
          </AccordionSection>

          <AccordionSection title={t("recipeFilters.displayTitle")} icon={<IconEye size={20} stroke={1.75} />}>
            <div className="bg-hf-cream px-4">
              <Row
                label={t("recipeFilters.showKcal")}
                checked={filters.showKcal}
                onChange={(showKcal) => update({ ...filters, showKcal })}
              />
              <Row
                label={t("recipeFilters.showEnergySplit")}
                checked={filters.showEnergySplit}
                onChange={(showEnergySplit) => update({ ...filters, showEnergySplit })}
                divider={false}
              />
            </div>
          </AccordionSection>

          <AccordionSection title={t("recipeFilters.sortTitle")} icon={<IconArrowsSort size={20} stroke={1.75} />}>
            <div className="bg-hf-cream px-4">
              {RECIPE_SORTS.map((sort, index) => (
                <Row
                  key={sort}
                  label={t(SORT_KEYS[sort])}
                  checked={filters.sort === sort}
                  // Kun én sortering ad gangen; slås den valgte fra, gælder Relevans.
                  onChange={(on) => update({ ...filters, sort: on ? sort : "relevance" })}
                  divider={index < RECIPE_SORTS.length - 1}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title={t("recipeFilters.allergiesTitle")}
            icon={<IconMedicalCross size={20} stroke={1.75} />}
            count={filters.allergens.length || undefined}
          >
            <div className="bg-hf-cream px-4">
              {allergens.map(({ key, label }, index) => (
                <Row
                  key={key}
                  label={label}
                  checked={filters.allergens.includes(key)}
                  onChange={(on) => update({ ...filters, allergens: toggleIn(filters.allergens, key, on) })}
                  divider={index < allergens.length - 1}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title={t("recipeFilters.dietsTitle")}
            icon={<IconMeat size={20} stroke={1.75} />}
            count={filters.diets.length || undefined}
          >
            <div className="bg-hf-cream px-4">
              {RECIPE_DIETS.map((key, index) => (
                <Row
                  key={key}
                  label={t(`recipeFilters.diets.${key}`)}
                  checked={filters.diets.includes(key)}
                  onChange={(on) => update({ ...filters, diets: toggleIn(filters.diets, key, on) })}
                  divider={index < RECIPE_DIETS.length - 1}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title={t("recipeFilters.specialTitle")}
            icon={<IconLeaf size={20} stroke={1.75} />}
            count={filters.nutrients.length || undefined}
          >
            <div className="bg-hf-cream px-4">
              {RECIPE_NUTRIENTS.map((key, index) => (
                <Row
                  key={key}
                  label={t(`recipeFilters.nutrients.${key}`)}
                  checked={filters.nutrients.includes(key)}
                  onChange={(on) => update({ ...filters, nutrients: toggleIn(filters.nutrients, key, on) })}
                  divider={index < RECIPE_NUTRIENTS.length - 1}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title={t("recipeFilters.macrosTitle")}
            icon={<IconList size={20} stroke={1.75} />}
            count={MACRO_OPTIONS.filter((o) => filters.macros[o.key] === o.level).length || undefined}
          >
            <div className="bg-hf-cream px-4">
              {MACRO_OPTIONS.map(({ key, level }, index) => (
                <Row
                  key={`${key}-${level}`}
                  label={t(`recipeFilters.macros.${key}-${level}`)}
                  checked={filters.macros[key] === level}
                  onChange={(on) => setMacro(key, level, on)}
                  divider={index < MACRO_OPTIONS.length - 1}
                />
              ))}
            </div>
          </AccordionSection>

          <button
            type="button"
            // Visningsvalgene (personer, kalorier, energifordeling) bevares.
            onClick={() =>
              update({
                ...DEFAULT_RECIPE_FILTERS,
                persons: filters.persons,
                showKcal: filters.showKcal,
                showEnergySplit: filters.showEnergySplit,
              })
            }
            className="hf-btn-secondary w-full py-3"
          >
            {t("recipeFilters.reset")}
          </button>
      </div>
    </HfScreen>
  );
}

// Valgene ligger kun i browseren, så siden renderes ikke på serveren (ellers
// ville server- og klientversionen af kontakterne være forskellige).
export default dynamic(() => Promise.resolve(RecipeFiltersContent), { ssr: false });
