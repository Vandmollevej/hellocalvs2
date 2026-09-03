"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBarcode, IconCamera, IconHandClick, IconX, IconSoup } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import {
  readDishDraft,
  removeDishDraftIngredient,
  clearDishDraft,
  type DishDraftIngredient,
} from "@/lib/dish-draft";
import { useTranslation } from "@/i18n/LocaleProvider";

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export default function CreateDishPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<DishDraftIngredient[]>(readDishDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      ingredients.reduce(
        (acc, ingredient) => {
          const factor = ingredient.grams / 100;
          acc.grams += ingredient.grams;
          acc.kcal += ingredient.kcalPer100g * factor;
          acc.protein += ingredient.proteinPer100g * factor;
          acc.carbs += ingredient.carbsPer100g * factor;
          acc.fat += ingredient.fatPer100g * factor;
          return acc;
        },
        { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [ingredients]
  );

  function handleRemove(index: number) {
    removeDishDraftIngredient(index);
    setIngredients(readDishDraft());
  }

  async function handleSave() {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError(t("createDish.nameRequired"));
      return;
    }
    if (ingredients.length === 0) {
      setSaveError(t("createDish.ingredientRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ingredients: ingredients.map((i) => ({ productId: i.productId, grams: i.grams })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.message ?? t("createDish.saveError"));
        return;
      }
      clearDishDraft();
      router.push("/foods");
    } catch {
      setSaveError(t("createDish.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen
      title={t("createDish.title")}
      icon={<IconSoup size={20} stroke={2} />}
      footer={
        <>
          {saveError && (
            <p className="mb-2 text-center text-sm text-hf-black opacity-70">{saveError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="hf-btn-primary w-full py-3.5 text-[15px] disabled:opacity-60"
          >
            {saving ? t("createDish.saving") : t("createDish.saveDish")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          aria-label={t("createDish.nameAriaLabel")}
          placeholder={t("createDish.namePlaceholder")}
          className="min-w-0 rounded-full bg-hf-tan px-4 py-2.5 text-sm text-hf-black outline-none"
        />

        <div>
          <p className="mb-2 text-xs font-bold text-hf-black">{t("createDish.ingredients")}</p>
          {ingredients.length === 0 ? (
            <div className="rounded-2xl bg-hf-tan p-4 text-center">
              <p className="text-sm text-hf-black opacity-60">{t("createDish.noIngredientsYet")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-hf-tan">
              {ingredients.map((ingredient, index) => (
                <div
                  key={`${ingredient.productId}-${index}`}
                  className="flex items-center gap-2.5 border-b border-hf-tan-dark px-4 py-3 last:border-b-0"
                >
                  <div className="h-9 w-9 flex-shrink-0">
                    {ingredient.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ingredient.imageUrl} alt="" className="h-full w-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-hf-black">{ingredient.name}</p>
                    <p className="text-xs text-hf-black opacity-60">
                      {t("createDish.gramsKcal", {
                        grams: ingredient.grams,
                        kcal: round((ingredient.kcalPer100g * ingredient.grams) / 100),
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    aria-label={t("createDish.removeIngredient")}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-hf-white text-hf-black"
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {ingredients.length > 0 && (
          <div className="rounded-2xl bg-hf-tan p-4">
            <p className="mb-1 text-xs font-bold text-hf-black">{t("createDish.total")}</p>
            <p className="text-sm text-hf-black">
              {t("createDish.gramsKcal", { grams: round(totals.grams), kcal: round(totals.kcal) })}
            </p>
            <p className="text-xs text-hf-black opacity-60">
              {t("createDish.macrosSummary", {
                protein: round(totals.protein, 1),
                carbs: round(totals.carbs, 1),
                fat: round(totals.fat, 1),
              })}
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-bold text-hf-black">{t("createDish.addIngredient")}</p>
          <div className="grid grid-cols-3 gap-2">
            <a
              href="/search?for=ret"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan py-3 text-center"
            >
              <IconBarcode size={20} color="var(--hf-black)" />
              <span className="text-xs font-medium text-hf-black">{t("createDish.search")}</span>
            </a>
            <a
              href="/camera?mode=produkt&for=ret"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan py-3 text-center"
            >
              <IconCamera size={20} color="var(--hf-black)" />
              <span className="text-xs font-medium text-hf-black">{t("createDish.scan")}</span>
            </a>
            <a
              href="/foods/new?for=ret"
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan py-3 text-center"
            >
              <IconHandClick size={20} color="var(--hf-black)" />
              <span className="text-xs font-medium text-hf-black">{t("createDish.manually")}</span>
            </a>
          </div>
        </div>

      </div>
    </HfScreen>
  );
}
