"use client";

import { useTranslation } from "@/i18n/LocaleProvider";

export type RecipeUnitMode = "measures" | "grams";

// Skift mellem køkkenmål (dl, spsk, tsk) og gram på en rets ingredienser
// (brugerens krav 2026-10-10). Omregningen bruger tabellen i
// src/lib/kitchen-conversions.ts; varer uden for tabellen beholder deres mængde.
export function RecipeUnitToggle({ mode, onChange }: { mode: RecipeUnitMode; onChange: (mode: RecipeUnitMode) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2" role="group" aria-label={t("recipeUnits.label")}>
      {(["measures", "grams"] as const).map((option) => (
        <button
          key={option}
          type="button"
          className="hf-choice"
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
        >
          {t(option === "grams" ? "recipeUnits.grams" : "recipeUnits.measures")}
        </button>
      ))}
    </div>
  );
}
