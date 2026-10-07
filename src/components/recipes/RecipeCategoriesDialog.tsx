"use client";

import { useState } from "react";
import { AccordionSection } from "@/components/hf/AccordionSection";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { RECIPE_CATEGORY_GROUPS, type RecipeCategoryGroup } from "@/lib/recipe-categories";
import { BottomSheet } from "@/components/hf/BottomSheet";

// Vindue efter Gem i Opret ret (docs/DECISIONS.md 2026-09-25). Retten er
// allerede gemt; LUK gemmer kategorierne en gang til, hvis nogen er valgt.
// Diæterne er forudvalgt ud fra ingredienserne.
export function RecipeCategoriesDialog({
  dishId,
  initialTags,
  onClose,
}: {
  dishId: string;
  initialTags: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [busy, setBusy] = useState(false);

  function toggle(tag: string, on: boolean) {
    setTags((current) => (on ? [...current.filter((v) => v !== tag), tag] : current.filter((v) => v !== tag)));
  }

  async function close() {
    if (tags.length > 0) {
      setBusy(true);
      await fetch(`/api/dishes/${encodeURIComponent(dishId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      }).catch(() => null);
      setBusy(false);
    }
    onClose();
  }

  const groups = Object.entries(RECIPE_CATEGORY_GROUPS) as [RecipeCategoryGroup, readonly string[]][];

  return (
    <BottomSheet ariaLabel={t("recipeCategories.title")} onClose={() => void close()}>
      <div className="flex flex-col">
        <div className="p-4 pb-2">
          <p className="hf-type-small text-text-secondary">{t("recipeCategories.intro")}</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
          {groups.map(([group, values]) => {
            const count = values.filter((v) => tags.includes(`${group}:${v}`)).length;
            return (
              <AccordionSection
                key={group}
                title={t(`recipeCategories.groups.${group}`)}
                count={count || undefined}
                defaultOpen={group === "diet"}
              >
                <div className="bg-hf-cream px-4">
                  {values.map((value, index) => {
                    const tag = `${group}:${value}`;
                    const label = t(
                      group === "diet" ? `recipeFilters.diets.${value}` : `recipeCategories.${group}.${value}`,
                    );
                    return (
                      <div
                        key={tag}
                        className={`flex min-h-12 items-center gap-3 py-2 ${
                          index < values.length - 1 ? "border-b border-hf-tan-dark" : ""
                        }`}
                      >
                        <span className="hf-type-body flex-1 text-hf-black">{label}</span>
                        <Toggle checked={tags.includes(tag)} onChange={(on) => toggle(tag, on)} ariaLabel={label} />
                      </div>
                    );
                  })}
                </div>
              </AccordionSection>
            );
          })}
        </div>
        <div className="p-4">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="hf-control hf-btn-primary w-full"
          >
            {t("recipeCategories.close")}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
