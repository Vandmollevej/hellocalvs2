"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconCamera,
  IconHandClick,
  IconInfoCircle,
  IconListNumbers,
  IconPhoto,
  IconSearch,
  IconX,
  IconSoup,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import {
  readDishDraft,
  removeDishDraftIngredient,
  clearDishDraft,
  readDishDraftDetails,
  writeDishDraftDetails,
  type DishDraftDetails,
  type DishDraftIngredient,
} from "@/lib/dish-draft";
import { RecipeImagesPicker } from "@/components/recipes/RecipeImagesPicker";
import { RecipeStepsEditor, isEmptyStep } from "@/components/recipes/RecipeStepsEditor";
import { RecipeCategoriesDialog } from "@/components/recipes/RecipeCategoriesDialog";
import { useTranslation } from "@/i18n/LocaleProvider";
import { isPrivateIngredientId } from "@/lib/private-ingredient-ids";

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export default function CreateDishPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  // Navn, billeder og fremgangsmåde gemmes i kladden, så de overlever
  // turen ud efter ingredienser (docs/DECISIONS.md 2026-09-25).
  const [details, setDetails] = useState<DishDraftDetails>(readDishDraftDetails);
  const { name, images, steps, showImages, showSteps } = details;
  // Vindue med kategorier efter Gem.
  const [savedDish, setSavedDish] = useState<{ id: string; tags: string[] } | null>(null);
  // Deling starter slået til (docs/DECISIONS.md 2026-09-24).
  const [shared, setShared] = useState(true);
  const [showShareInfo, setShowShareInfo] = useState(false);
  const [ingredients, setIngredients] = useState<DishDraftIngredient[]>(readDishDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; imageUrl?: string | null; isPrivate?: boolean }[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearchState("loading");
      try {
        const [res, own] = await Promise.all([
          fetch(`/api/products?q=${encodeURIComponent(query)}`, { signal: controller.signal }),
          // Egne ingredienser (kun i boksen) vises øverst — aldrig for andre.
          fetch(`/api/private-ingredients?q=${encodeURIComponent(query)}`).catch(() => null),
        ]);
        if (!res.ok) throw new Error("offline");
        const data = await res.json();
        const ownData = own?.ok ? await own.json() : { ingredients: [] };
        setResults([
          ...(ownData.ingredients ?? []).map((i: { id: string; name: string }) => ({ ...i, isPrivate: true })),
          ...(data.products ?? []),
        ]);
        setSearchState("ready");
      } catch {
        setSearchState("error");
        setResults([]);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  const hasPrivateIngredient = ingredients.some((i) => isPrivateIngredientId(i.productId));

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

  function updateDetails(patch: Partial<DishDraftDetails>) {
    setDetails((current) => {
      const next = { ...current, ...patch };
      writeDishDraftDetails(next);
      return next;
    });
  }

  function setName(value: string) {
    updateDetails({ name: value });
  }

  function finish() {
    router.push("/profile/recipes?tab=mine");
  }

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
          images,
          steps: steps.filter((step) => !isEmptyStep(step)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.message ?? t("createDish.saveError"));
        return;
      }
      clearDishDraft();
      if (shared && !hasPrivateIngredient && data.dish?.id) {
        const shareRes = await fetch(`/api/dishes/${encodeURIComponent(data.dish.id)}/share`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shared: true, language: locale === "en" ? "en" : "da" }),
        }).catch(() => null);
        if (!shareRes?.ok) {
          // Retten er gemt privat; delingen kan slås til senere under Mine retter.
          setSaveError(t("createDish.shareError"));
        }
      }
      // Retten er gemt; vinduet giver mulighed for at vælge kategorier.
      if (data.dish?.id) {
        setSavedDish({ id: data.dish.id, tags: Array.isArray(data.suggestedTags) ? data.suggestedTags : [] });
      } else {
        finish();
      }
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
            disabled={saving || savedDish !== null}
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
          <div className="flex items-center gap-3 rounded-2xl bg-hf-tan px-4 py-3">
            <span className="flex-1 text-[14px] font-medium text-hf-black">{t("createDish.shareLabel")}</span>
            <button
              type="button"
              onClick={() => setShowShareInfo((open) => !open)}
              aria-label={t("createDish.shareInfoAria")}
              aria-expanded={showShareInfo}
              className="-my-2 flex h-11 w-8 shrink-0 items-center justify-center text-hf-black"
            >
              <IconInfoCircle size={20} />
            </button>
            <Toggle checked={shared && !hasPrivateIngredient} onChange={setShared} disabled={hasPrivateIngredient} />
          </div>
          {hasPrivateIngredient && (
            <p className="mt-2 px-1 text-[13px] text-hf-black opacity-60">{t("createDish.shareBlockedPrivate")}</p>
          )}
          {showShareInfo && (
            <p className="mt-2 rounded-[8px] border border-hf-gray-light bg-hf-white px-3 py-2 text-[13px] text-hf-black">
              {t("createDish.shareInfo")}
            </p>
          )}
        </div>

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
                      {isPrivateIngredientId(ingredient.productId)
                        ? t("createDish.kcalUnknown", { grams: ingredient.grams })
                        : t("createDish.gramsKcal", {
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
          <div className="hf-search">
            <IconSearch size={16} color="var(--hf-black)" />
            <input
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                if (!value.trim()) {
                  setSearchState("idle");
                  setResults([]);
                }
              }}
              placeholder={t("createDish.searchPlaceholder")}
            />
          </div>

          {query.trim() && (
            <div className="mt-2 overflow-hidden rounded-[8px] bg-hf-tan">
              {searchState === "loading" && (
                <p className="px-4 py-4 text-center text-sm text-hf-black opacity-60">
                  {t("createDish.searching")}
                </p>
              )}
              {searchState === "error" && (
                <p className="px-4 py-4 text-center text-sm text-hf-black opacity-60">
                  {t("createDish.noResults")}
                </p>
              )}
              {searchState === "ready" && results.length === 0 && (
                <p className="px-4 py-4 text-center text-sm text-hf-black opacity-60">
                  {t("createDish.noResults")}
                </p>
              )}
              {searchState === "ready" &&
                results.slice(0, 6).map((product, index) => (
                  <Link
                    key={product.id}
                    href={
                      product.isPrivate
                        ? `/ingredients/new?for=ret&use=${encodeURIComponent(product.id)}`
                        : `/add/${product.id}?for=ret`
                    }
                    className={`flex items-center gap-2.5 px-4 py-3 ${
                      index < Math.min(results.length, 6) - 1 ? "border-b border-hf-tan-dark" : ""
                    }`}
                  >
                    <div className="h-9 w-9 flex-shrink-0">
                      {product.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt="" className="h-full w-full object-contain" />
                      )}
                    </div>
                    <span className="flex-1 text-[14px] font-medium text-hf-black">{product.name}</span>
                    {product.isPrivate && (
                      <span className="text-xs font-medium text-hf-black opacity-60">{t("createDish.ownTag")}</span>
                    )}
                  </Link>
                ))}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href="/camera?mode=product&for=ret"
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
          <Link
            href="/ingredients/new?for=ret"
            className="mt-2 block text-center text-xs font-medium text-hf-black underline underline-offset-2 opacity-70"
          >
            {t("createDish.createOwnIngredient")}
          </Link>
        </div>

        {showImages && (
          <div>
            <p className="mb-2 text-xs font-bold text-hf-black">{t("recipeImages.title")}</p>
            <RecipeImagesPicker images={images} onChange={(next) => updateDetails({ images: next })} />
          </div>
        )}

        {showSteps && (
          <div>
            <p className="mb-1 text-xs font-bold text-hf-black">{t("recipeSteps.title")}</p>
            <p className="text-[12px] text-hf-black opacity-60">{t("recipeSteps.hint")}</p>
            <RecipeStepsEditor steps={steps} onChange={(next) => updateDetails({ steps: next })} />
          </div>
        )}

        {(!showImages || !showSteps) && (
          <div className="grid grid-cols-2 gap-2">
            {!showImages && (
              <button
                type="button"
                onClick={() => updateDetails({ showImages: true })}
                className={`flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan py-3 text-center ${
                  showSteps ? "col-span-2" : ""
                }`}
              >
                <IconPhoto size={20} color="var(--hf-black)" />
                <span className="text-xs font-medium text-hf-black">{t("recipeImages.addButton")}</span>
              </button>
            )}
            {!showSteps && (
              <button
                type="button"
                onClick={() => updateDetails({ showSteps: true })}
                className={`flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan py-3 text-center ${
                  showImages ? "col-span-2" : ""
                }`}
              >
                <IconListNumbers size={20} color="var(--hf-black)" />
                <span className="text-xs font-medium text-hf-black">{t("recipeSteps.addButton")}</span>
              </button>
            )}
          </div>
        )}
      </div>
      {savedDish && (
        <RecipeCategoriesDialog dishId={savedDish.id} initialTags={savedDish.tags} onClose={finish} />
      )}
    </HfScreen>
  );
}
