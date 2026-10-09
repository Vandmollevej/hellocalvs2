"use client";

import dynamic from "next/dynamic";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { RecipeFiltersBody } from "@/components/recipes/RecipeFiltersBody";

// Opskrifter → Delte retter → filterikonet (docs/DECISIONS.md 2026-09-25).
// Retter-siden åbner nu filtrene i et bundark; denne side består for gamle
// links. Indholdet er fælles (RecipeFiltersBody).
function RecipeFiltersContent() {
  const { t } = useTranslation();
  return (
    <HfScreen title={t("recipeFilters.title")}>
      <RecipeFiltersBody />
    </HfScreen>
  );
}

// Valgene ligger kun i browseren, så siden renderes ikke på serveren (ellers
// ville server- og klientversionen af kontakterne være forskellige).
export default dynamic(() => Promise.resolve(RecipeFiltersContent), { ssr: false });
