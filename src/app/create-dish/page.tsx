"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconCamera,
  IconListNumbers,
  IconPhoto,
  IconSearch,
  IconX,
  IconSoup,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { PasteTextSheet, ScanSheet, type ImportResult } from "@/components/recipes/RecipeImportSheets";
import {
  readDishDraft,
  removeDishDraftIngredient,
  clearDishDraft,
  readDishDraftDetails,
  appendDishDraftIngredient,
  writeDishDraftDetails,
  type DishDraftDetails,
  type DishDraftIngredient,
} from "@/lib/dish-draft";
import { RecipeImagesPicker } from "@/components/recipes/RecipeImagesPicker";
import { ProductPhotoDropZone } from "@/components/recipes/ProductPhotoDropZone";
import { RecipeStepsEditor, isEmptyStep } from "@/components/recipes/RecipeStepsEditor";
import { RecipeCategoriesDialog } from "@/components/recipes/RecipeCategoriesDialog";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useInWebShell } from "@/components/web/WebShell";
import { isPrivateIngredientId } from "@/lib/private-ingredient-ids";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export default function CreateDishPage() {
  const { t, locale } = useTranslation();
  const inWebShell = useInWebShell();
  const router = useRouter();
  // Navn, billeder og fremgangsmåde gemmes i kladden, så de overlever
  // turen ud efter ingredienser (docs/DECISIONS.md 2026-09-25).
  const [details, setDetails] = useState<DishDraftDetails>(readDishDraftDetails);
  const { name, images, steps, showImages, showSteps } = details;
  // Vindue med kategorier efter Gem.
  const [savedDish, setSavedDish] = useState<{ id: string; tags: string[] } | null>(null);
  // Deling spørges om i et vindue efter oprettelsen (brugerens krav 2026-10-07);
  // den kan stadig slås til senere under retten.
  const [sharePrompt, setSharePrompt] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Indsæt tekst / Scan: arket, der er åbent, og hvad robotten ikke kunne placere.
  const [sheet, setSheet] = useState<"none" | "paste" | "scan">("none");
  const [importNote, setImportNote] = useState<{ missing: string[]; nutrition: string | null } | null>(null);
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

  async function answerShare(share: boolean) {
    if (share && savedDish) {
      setSharing(true);
      const shareRes = await fetch(`/api/dishes/${encodeURIComponent(savedDish.id)}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shared: true, language: locale === "en" ? "en" : "da" }),
      }).catch(() => null);
      setSharing(false);
      // Retten er gemt privat; delingen kan slås til senere under retten.
      if (!shareRes?.ok) setSaveError(t("createDish.shareError"));
    }
    setSharePrompt(false);
  }

  // Robotten har fundet titel, ingredienser, trin og næring: sæt dem ind.
  function applyImport(result: ImportResult) {
    const missing: string[] = [];
    for (const ingredient of result.ingredients) {
      if (ingredient.product && ingredient.grams) {
        appendDishDraftIngredient({
          productId: ingredient.product.id,
          name: ingredient.product.name,
          imageUrl: ingredient.product.imageUrl,
          kcalPer100g: ingredient.product.kcalPer100g,
          proteinPer100g: ingredient.product.proteinPer100g,
          carbsPer100g: ingredient.product.carbsPer100g,
          fatPer100g: ingredient.product.fatPer100g,
          grams: ingredient.grams,
        });
      } else {
        missing.push(ingredient.raw);
      }
    }
    setIngredients(readDishDraft());
    // Første billede øverst som titlen; flere billeder hører til trinene.
    const pageImages = result.pageImages ?? [];
    const nextImages = result.image ? [result.image, ...images] : images;
    const nextSteps = result.steps.map((text, index) => ({ title: "", text, image: pageImages[index] ?? null }));
    updateDetails({
      name: result.title || name,
      images: nextImages,
      showImages: nextImages.length > 0 || showImages,
      steps: nextSteps.length > 0 ? nextSteps : steps,
      showSteps: nextSteps.length > 0 || showSteps,
    });
    const n = result.nutrition;
    setImportNote({
      missing,
      nutrition: n
        ? [
            n.kcal !== null && `${n.kcal} kcal`,
            n.protein !== null && `${n.protein} g protein`,
            n.carbs !== null && `${n.carbs} g kulhydrat`,
            n.fat !== null && `${n.fat} g fedt`,
          ]
            .filter(Boolean)
            .join(" · ")
        : null,
    });
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
      // Retten er gemt; først spørges der om deling, derefter om kategorier.
      if (data.dish?.id) {
        setSavedDish({ id: data.dish.id, tags: Array.isArray(data.suggestedTags) ? data.suggestedTags : [] });
        setSharePrompt(!hasPrivateIngredient);
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
            <p className="hf-type-body text-text-secondary mb-2 text-center">{saveError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving || savedDish !== null}
            className="hf-control hf-btn-primary w-full disabled:opacity-60"
          >
            {saving ? t("createDish.saving") : t("createDish.saveDish")}
          </button>
        </>
      }
    >
      <div className="hf-page">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          aria-label={t("createDish.nameAriaLabel")}
          placeholder={t("createDish.namePlaceholder")}
          className="hf-type-body hf-field min-w-0 rounded-full bg-hf-tan px-4 text-hf-black outline-none"
        />

        {/* Tre veje ind: Manuelt (som før), Indsæt tekst og Scan. */}
        <div role="group" className="grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-pressed={sheet === "none"}
            onClick={() => setSheet("none")}
            className="hf-type-small hf-type-strong rounded-full border border-hf-black bg-hf-black px-2 py-3 text-hf-white"
          >
            {t("createDish.modeManual")}
          </button>
          <button
            type="button"
            onClick={() => setSheet("paste")}
            className="hf-type-small hf-type-strong rounded-full border border-hf-black bg-hf-white px-2 py-3 text-hf-black"
          >
            {t("createDish.modeText")}
          </button>
          <button
            type="button"
            onClick={() => setSheet("scan")}
            className="hf-type-small hf-type-strong rounded-full border border-hf-black bg-hf-white px-2 py-3 text-hf-black"
          >
            {t("createDish.modeScan")}
          </button>
        </div>

        {importNote && (
          <div className="hf-card">
            <p className="hf-type-small hf-type-strong text-hf-black">{t("createDish.importDone")}</p>
            {importNote.nutrition && (
              <p className="hf-type-small text-text-secondary">
                {t("createDish.importNutrition")}: {importNote.nutrition}
              </p>
            )}
            {importNote.missing.length > 0 && (
              <>
                <p className="hf-type-small hf-type-strong mt-2 text-hf-black">{t("createDish.importMissing")}</p>
                <ul className="hf-type-small text-text-secondary list-disc pl-5">
                  {importNote.missing.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div>
          <p className="hf-type-small hf-type-strong mb-2 text-hf-black">{t("createDish.ingredients")}</p>
          {ingredients.length === 0 ? (
            <div className="hf-card text-center">
              <p className="hf-type-body text-text-secondary">{t("createDish.noIngredientsYet")}</p>
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
                    <p className="hf-type-body hf-type-strong text-hf-black">{ingredient.name}</p>
                    <p className="hf-type-small text-text-secondary">
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
          <div className="hf-card">
            <p className="hf-type-small hf-type-strong text-hf-black">{t("createDish.total")}</p>
            <p className="hf-type-body text-hf-black">
              {t("createDish.gramsKcal", { grams: round(totals.grams), kcal: round(totals.kcal) })}
            </p>
            <p className="hf-type-small text-text-secondary">
              {t("createDish.macrosSummary", {
                protein: round(totals.protein, 1),
                carbs: round(totals.carbs, 1),
                fat: round(totals.fat, 1),
              })}
            </p>
          </div>
        )}

        <div>
          <p className="hf-type-small hf-type-strong mb-2 text-hf-black">{t("createDish.addIngredient")}</p>
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
                <SkeletonScreen className="px-4">
                  <SkeletonMediaRows rows={4} />
                </SkeletonScreen>
              )}
              {searchState === "error" && (
                <p className="hf-type-body text-text-secondary px-4 py-4 text-center">
                  {t("createDish.noResults")}
                </p>
              )}
              {searchState === "ready" && results.length === 0 && (
                <p className="hf-type-body text-text-secondary px-4 py-4 text-center">
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
                    <span className="hf-type-body hf-type-strong flex-1 text-hf-black">{product.name}</span>
                    {product.isPrivate && (
                      <span className="hf-type-small hf-type-strong text-text-secondary">{t("createDish.ownTag")}</span>
                    )}
                  </Link>
                ))}
            </div>
          )}

          {/* Nye varer oprettes kun ved scanning — ingen manuel formular (DECISIONS 2026-10-02). */}
          <div className="mt-4">
            {inWebShell ? (
              <ProductPhotoDropZone returnSuffix="?for=ret" />
            ) : (
              <a
                href="/camera?mode=product&for=ret"
                className="flex flex-col items-center gap-2 rounded-2xl bg-hf-tan py-3 text-center"
              >
                <IconCamera size={20} color="var(--hf-black)" />
                <span className="hf-type-small hf-type-strong text-hf-black">{t("createDish.scan")}</span>
              </a>
            )}
          </div>
          <Link
            href="/ingredients/new?for=ret"
            className="hf-type-small hf-type-strong text-text-secondary mt-2 block text-center underline underline-offset-2"
          >
            {t("createDish.createOwnIngredient")}
          </Link>
        </div>

        {showImages && (
          <div>
            <p className="hf-type-small hf-type-strong mb-2 text-hf-black">{t("recipeImages.title")}</p>
            <RecipeImagesPicker images={images} onChange={(next) => updateDetails({ images: next })} />
          </div>
        )}

        {showSteps && (
          <div>
            <p className="hf-type-small hf-type-strong mb-1 text-hf-black">{t("recipeSteps.title")}</p>
            <p className="hf-type-small text-text-secondary">{t("recipeSteps.hint")}</p>
            <RecipeStepsEditor steps={steps} onChange={(next) => updateDetails({ steps: next })} />
          </div>
        )}

        {(!showImages || !showSteps) && (
          <div className="grid grid-cols-2 gap-2">
            {!showImages && (
              <button
                type="button"
                onClick={() => updateDetails({ showImages: true })}
                className={`flex flex-col items-center gap-2 rounded-2xl bg-hf-tan py-3 text-center ${
                  showSteps ? "col-span-2" : ""
                }`}
              >
                <IconPhoto size={20} color="var(--hf-black)" />
                <span className="hf-type-small hf-type-strong text-hf-black">{t("recipeImages.addButton")}</span>
              </button>
            )}
            {!showSteps && (
              <button
                type="button"
                onClick={() => updateDetails({ showSteps: true })}
                className={`flex flex-col items-center gap-2 rounded-2xl bg-hf-tan py-3 text-center ${
                  showImages ? "col-span-2" : ""
                }`}
              >
                <IconListNumbers size={20} color="var(--hf-black)" />
                <span className="hf-type-small hf-type-strong text-hf-black">{t("recipeSteps.addButton")}</span>
              </button>
            )}
          </div>
        )}
      </div>
      {sheet === "paste" && <PasteTextSheet onClose={() => setSheet("none")} onResult={applyImport} />}
      {sheet === "scan" && <ScanSheet onClose={() => setSheet("none")} onResult={applyImport} />}
      {savedDish && sharePrompt && (
        <BottomSheet title={t("createDish.shareQuestionTitle")} onClose={() => void answerShare(false)}>
          <div className="hf-page">
            <p className="hf-type-body text-hf-black">{t("createDish.shareQuestionBody")}</p>
            <button
              type="button"
              disabled={sharing}
              onClick={() => void answerShare(true)}
              className="hf-control hf-btn-primary w-full disabled:opacity-60"
            >
              {t("createDish.shareYes")}
            </button>
            <BottomSheetCloseButton className="hf-control hf-btn-secondary w-full">
              {t("createDish.shareNo")}
            </BottomSheetCloseButton>
          </div>
        </BottomSheet>
      )}
      {savedDish && !sharePrompt && (
        <RecipeCategoriesDialog dishId={savedDish.id} initialTags={savedDish.tags} onClose={finish} />
      )}
    </HfScreen>
  );
}
