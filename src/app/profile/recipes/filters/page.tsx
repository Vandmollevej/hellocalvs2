"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { HfScreen } from "@/components/HfScreen";
import { RecipeFilterPanel } from "@/components/recipes/RecipeFilterPanel";
import { useTranslation } from "@/i18n/LocaleProvider";
import { loadRecipeFilters, saveRecipeFilters, type RecipeFilters } from "@/lib/recipe-filters";

// Selvstændig filterside (bevaret til gamle links); Retter-siden bruger
// samme panel i en popup. Valgene gemmes med det samme.
function RecipeFiltersContent() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<RecipeFilters>(loadRecipeFilters);

  function update(next: RecipeFilters) {
    setFilters(next);
    saveRecipeFilters(next);
  }

  return (
    <HfScreen title={t("recipeFilters.title")}>
      <RecipeFilterPanel filters={filters} onChange={update} />
    </HfScreen>
  );
}

// Valgene ligger kun i browseren, så siden renderes ikke på serveren (ellers
// ville server- og klientversionen af kontakterne være forskellige).
export default dynamic(() => Promise.resolve(RecipeFiltersContent), { ssr: false });
