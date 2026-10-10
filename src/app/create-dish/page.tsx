"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconCamera,
  IconMinus,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardText,
  IconPencil,
  IconSearch,
  IconX,
  IconSoup,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import {
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetDots,
} from "@/components/hf/BottomSheet";
import { PersonsSlider } from "@/components/hf/PersonsSlider";
import { MAX_RECIPE_PERSONS } from "@/lib/recipe-portions";
import {
  PasteTextSheet,
  ScanSheet,
  type ImportResult,
} from "@/components/recipes/RecipeImportSheets";
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
import { stepDuration } from "@/lib/activity-duration";
import { RecipeStepPage } from "@/components/recipes/RecipeStepPage";
import { RecipeImagesPicker } from "@/components/recipes/RecipeImagesPicker";
import { ProductPhotoDropZone } from "@/components/recipes/ProductPhotoDropZone";
import {
  EMPTY_STEP,
  type StepDraft,
  isEmptyStep,
} from "@/components/recipes/RecipeStepsEditor";
import { RecipeCategoriesDialog } from "@/components/recipes/RecipeCategoriesDialog";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useConnectionMessage } from "@/lib/use-online-status";
import { useInWebShell } from "@/components/web/WebShell";
import { isPrivateIngredientId } from "@/lib/private-ingredient-ids";
import { SkeletonMediaRows, SkeletonScreen } from "@/components/hf/Skeleton";

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export default function CreateDishPage() {
  const { t, locale } = useTranslation();
  const connectionMessage = useConnectionMessage();
  const inWebShell = useInWebShell();
  const router = useRouter();
  // Navn, billeder og fremgangsmåde gemmes i kladden, så de overlever
  // turen ud efter ingredienser (docs/DECISIONS.md 2026-09-25).
  const [details, setDetails] =
    useState<DishDraftDetails>(readDishDraftDetails);
  const { name, images, steps, showImages, showSteps } = details;
  // Vindue med kategorier efter Gem.
  const [savedDish, setSavedDish] = useState<{
    id: string;
    tags: string[];
  } | null>(null);
  // Deling spørges om i et vindue efter oprettelsen (brugerens krav 2026-10-07);
  // den kan stadig slås til senere under retten.
  const [sharePrompt, setSharePrompt] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Indsæt tekst / Scan: arket, der er åbent, og hvad robotten ikke kunne placere.
  const [servings, setServings] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"none" | "paste" | "scan">("none");
  const [importNote, setImportNote] = useState<{
    missing: string[];
    nutrition: string | null;
  } | null>(null);
  const [ingredients, setIngredients] =
    useState<DishDraftIngredient[]>(readDishDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Flowets første trin: tre knapper midt på skærmen. Springes over, når der
  // allerede er en kladde (fx ved retur fra en vare).
  const [started, setStarted] = useState(
    () =>
      details.name.trim() !== "" ||
      ingredients.length > 0 ||
      details.steps.length > 0 ||
      details.images.length > 0,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; imageUrl?: string | null }[]
  >([]);
  const [searchState, setSearchState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSearchState("loading");
      try {
        const res = await fetch(
          `/api/products?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("offline");
        const data = await res.json();
        setResults(data.products ?? []);
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

  const hasPrivateIngredient = ingredients.some((i) =>
    isPrivateIngredientId(i.productId),
  );

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
        { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [ingredients],
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
      const shareRes = await fetch(
        `/api/dishes/${encodeURIComponent(savedDish.id)}/share`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shared: true,
            language: locale === "en" ? "en" : "da",
          }),
        },
      ).catch(() => null);
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
    if (result.servings) setServings(result.servings);
    // Første billede øverst som titlen; flere billeder hører til trinene.
    const pageImages = result.pageImages ?? [];
    const nextImages = result.image ? [result.image, ...images] : images;
    const nextSteps = result.steps.map((text, index) => ({
      title: result.stepTitles?.[index] ?? "",
      text,
      image: pageImages[index] || null,
    }));
    updateDetails({
      name: result.title || name,
      description: result.description || details.description,
      durationMinutes: result.durationMinutes ?? details.durationMinutes,
      images: nextImages,
      showImages: nextImages.length > 0 || showImages,
      steps: nextSteps.length > 0 ? nextSteps : steps,
      showSteps: nextSteps.length > 0 || showSteps,
    });
    setPage(1);
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
      setPage(pageKinds.findIndex((entry) => entry.kind === "title"));
      return;
    }
    if (ingredients.length === 0) {
      setSaveError(t("createDish.ingredientRequired"));
      setPage(pageKinds.findIndex((entry) => entry.kind === "ingredients"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          servings,
          description: details.description.trim(),
          durationMinutes: details.durationMinutes,
          ingredients: ingredients.map((i) => ({
            productId: i.productId,
            grams: i.grams,
          })),
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
        setSavedDish({
          id: data.dish.id,
          tags: Array.isArray(data.suggestedTags) ? data.suggestedTags : [],
        });
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

  // Siderne i flowet: 0 = ingredienser, derefter ét trin pr. side, til sidst billeder.
  const [page, setPage] = useState(0);
  // Indsæt tekst / Scan opskrift: importen er side 1, titlen kommer først på side 2.
  const [importMode, setImportMode] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const stepList = steps.length ? steps : [EMPTY_STEP];
  type PageKind =
    | { kind: "import" | "title" | "ingredients" | "images" }
    | { kind: "step"; index: number };
  const pageKinds: PageKind[] = [
    ...(importMode ? [{ kind: "import" as const }] : []),
    { kind: "title" },
    { kind: "ingredients" },
    ...stepList.map((_, index) => ({ kind: "step" as const, index })),
    { kind: "images" },
  ];
  const totalPages = pageKinds.length;
  const current = pageKinds[Math.min(page, totalPages - 1)];

  function goTo(next: number) {
    setPage(Math.min(Math.max(next, 0), totalPages - 1));
  }

  function updateStep(index: number, next: StepDraft) {
    updateDetails({
      steps: stepList.map((step, i) => (i === index ? next : step)),
    });
  }

  function addStepAfter() {
    const at = page - 1;
    updateDetails({
      steps: [
        ...stepList.slice(0, at + 1),
        EMPTY_STEP,
        ...stepList.slice(at + 1),
      ],
    });
    setPage(page + 1);
  }

  function removeStep() {
    const at = current.kind === "step" ? current.index : 0;
    updateDetails({ steps: stepList.filter((_, i) => i !== at) });
    setPage(page - 1);
  }

  const startOptions = [
    {
      key: "text",
      label: t("createDish.modeText"),
      icon: <IconClipboardText size={28} />,
      sheet: "paste" as const,
    },
    {
      key: "scan",
      label: t("createDish.modeScan"),
      icon: <IconCamera size={28} />,
      sheet: "scan" as const,
    },
    {
      key: "manual",
      label: t("createDish.modeManual"),
      icon: <IconPencil size={28} />,
      sheet: "none" as const,
    },
  ];

  return (
    <HfScreen
      title={t("createDish.title")}
      icon={<IconSoup size={20} stroke={2} />}
    >
      {/* Alle flows er helsides popups (docs/REGLER.md). */}
      <BottomSheet
        size="full"
        title={t("createDish.title")}
        onClose={() => router.back()}
        headerAction={
          started ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || savedDish !== null}
              className="hf-type-body hf-type-strong rounded-full bg-hf-black px-4 py-2 text-hf-white disabled:opacity-40"
            >
              {saving ? t("createDish.saving") : t("createDish.done")}
            </button>
          ) : undefined
        }
        footer={
          started ? (
            <>
              {saveError && (
                <p className="hf-type-body text-text-secondary mb-2 text-center">
                  {saveError}
                </p>
              )}
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => goTo(page - 1)}
                  disabled={page === 0}
                  aria-label={t("createDish.pageBack")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-hf-tan text-hf-black disabled:opacity-30"
                >
                  <IconChevronLeft size={22} />
                </button>
                <BottomSheetDots
                  count={totalPages}
                  active={page}
                  label={t("createDish.pageDots", {
                    current: page + 1,
                    total: totalPages,
                  })}
                  onSelect={goTo}
                />
                <button
                  type="button"
                  onClick={() => goTo(page + 1)}
                  disabled={page === totalPages - 1}
                  aria-label={t("createDish.pageNext")}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-hf-tan text-hf-black disabled:opacity-30"
                >
                  <IconChevronRight size={22} />
                </button>
              </div>
            </>
          ) : undefined
        }
      >
        {!started ? (
          <div className="hf-page flex min-h-[50vh] flex-col items-center justify-center gap-3">
            {startOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setImportMode(option.sheet !== "none");
                  setSheet(option.sheet);
                  setStarted(true);
                }}
                className="flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl bg-hf-tan py-5 text-hf-black"
              >
                {option.icon}
                <span className="hf-type-body hf-type-strong">
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div
            className="hf-page"
            onTouchStart={(event) => {
              swipeStart.current = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY,
              };
            }}
            onTouchEnd={(event) => {
              const from = swipeStart.current;
              swipeStart.current = null;
              if (!from) return;
              const dx = event.changedTouches[0].clientX - from.x;
              const dy = event.changedTouches[0].clientY - from.y;
              // Slide tilbage: et tydeligt vandret stryg mod højre.
              if (dx > 80 && Math.abs(dx) > Math.abs(dy) * 2) goTo(page - 1);
            }}
          >
            {current.kind === "import" && (
              <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
                {startOptions
                  .filter((option) => option.sheet !== "none")
                  .map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSheet(option.sheet)}
                      className="flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl bg-hf-tan py-5 text-hf-black"
                    >
                      {option.icon}
                      <span className="hf-type-body hf-type-strong">
                        {option.label}
                      </span>
                    </button>
                  ))}
              </div>
            )}

            {current.kind === "title" && (
              <>
                <p className="hf-type-small hf-type-strong text-hf-black">
                  {t("createDish.pageTitle")}
                </p>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  aria-label={t("createDish.nameAriaLabel")}
                  placeholder={t("createDish.namePlaceholder")}
                  className="hf-type-body hf-field min-w-0 rounded-full bg-hf-tan px-4 text-hf-black outline-none"
                />
                <textarea
                  value={details.description}
                  onChange={(event) =>
                    updateDetails({ description: event.target.value })
                  }
                  placeholder={t("createDish.descriptionPlaceholder")}
                  aria-label={t("createDish.descriptionPlaceholder")}
                  rows={5}
                  className="hf-type-body resize-none rounded-card bg-hf-tan px-4 py-3 text-hf-black outline-none"
                />
                <div className="flex items-center justify-between rounded-2xl bg-hf-tan px-4 py-3">
                  <span className="hf-type-body text-hf-black">
                    {t("createDish.durationLabel")}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateDetails({
                          durationMinutes: details.durationMinutes
                            ? details.durationMinutes <= 5
                              ? null
                              : stepDuration(details.durationMinutes, -1)
                            : null,
                        })
                      }
                      aria-label="-"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-hf-white text-hf-black"
                    >
                      <IconMinus size={16} />
                    </button>
                    <input
                      value={details.durationMinutes ?? ""}
                      onChange={(event) => {
                        const value = Number.parseInt(
                          event.target.value.replace(/\D/g, ""),
                          10,
                        );
                        updateDetails({
                          durationMinutes:
                            Number.isFinite(value) && value > 0
                              ? Math.min(value, 5999)
                              : null,
                        });
                      }}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={t("createDish.durationLabel")}
                      className="hf-type-body w-16 rounded-card bg-hf-white py-2 text-center text-hf-black outline-none"
                    />
                    <span className="hf-type-small text-text-secondary">
                      {t("createDish.minutes")}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateDetails({
                          durationMinutes: stepDuration(
                            details.durationMinutes ?? 0,
                            1,
                          ),
                        })
                      }
                      aria-label="+"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-hf-white text-hf-black"
                    >
                      <IconPlus size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}

            {current.kind === "ingredients" && (
              <>
                {importNote && (
                  <div className="hf-card">
                    <p className="hf-type-small hf-type-strong text-hf-black">
                      {t("createDish.importDone")}
                    </p>
                    {importNote.nutrition && (
                      <p className="hf-type-small text-text-secondary">
                        {t("createDish.importNutrition")}:{" "}
                        {importNote.nutrition}
                      </p>
                    )}
                    {importNote.missing.length > 0 && (
                      <>
                        <p className="hf-type-small hf-type-strong mt-2 text-hf-black">
                          {t("createDish.importMissing")}
                        </p>
                        <ul className="hf-type-small text-text-secondary list-disc pl-5">
                          {importNote.missing.map((line, index) => (
                            <li key={index}>{line}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                <div className="rounded-2xl bg-hf-tan px-4 py-3">
                  <PersonsSlider
                    label={t("createDish.servings")}
                    value={servings ?? 4}
                    max={MAX_RECIPE_PERSONS}
                    onChange={setServings}
                  />
                </div>

                <div>
                  <p className="hf-type-small hf-type-strong mb-2 text-hf-black">
                    {t("createDish.ingredients")}
                  </p>
                  {ingredients.length === 0 ? (
                    <div className="hf-card text-center">
                      <p className="hf-type-body text-text-secondary">
                        {t("createDish.noIngredientsYet")}
                      </p>
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
                              <img
                                src={ingredient.imageUrl}
                                alt=""
                                className="h-full w-full object-contain"
                              />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="hf-type-body hf-type-strong text-hf-black">
                              {ingredient.name}
                            </p>
                            <p className="hf-type-small text-text-secondary">
                              {isPrivateIngredientId(ingredient.productId)
                                ? t("createDish.kcalUnknown", {
                                    grams: ingredient.grams,
                                  })
                                : t("createDish.gramsKcal", {
                                    grams: ingredient.grams,
                                    kcal: round(
                                      (ingredient.kcalPer100g *
                                        ingredient.grams) /
                                        100,
                                    ),
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
                    <p className="hf-type-small hf-type-strong text-hf-black">
                      {t("createDish.total")}
                    </p>
                    <p className="hf-type-body text-hf-black">
                      {t("createDish.gramsKcal", {
                        grams: round(totals.grams),
                        kcal: round(totals.kcal),
                      })}
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
                  <p className="hf-type-small hf-type-strong mb-2 text-hf-black">
                    {t("createDish.addIngredient")}
                  </p>
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
                    <div className="mt-2 overflow-hidden bg-hf-tan rounded-card">
                      {searchState === "loading" && (
                        <SkeletonScreen className="px-4">
                          <SkeletonMediaRows rows={4} />
                        </SkeletonScreen>
                      )}
                      {searchState === "error" && (
                        <p className="hf-type-body text-text-secondary px-4 py-4 text-center">
                          {connectionMessage(t("createDish.noResults"))}
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
                            href={`/add/${product.id}?for=ret`}
                            className={`flex items-center gap-2.5 px-4 py-3 ${
                              index < Math.min(results.length, 6) - 1
                                ? "border-b border-hf-tan-dark"
                                : ""
                            }`}
                          >
                            <div className="h-9 w-9 flex-shrink-0">
                              {product.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.imageUrl}
                                  alt=""
                                  className="h-full w-full object-contain"
                                />
                              )}
                            </div>
                            <span className="hf-type-body hf-type-strong flex-1 text-hf-black">
                              {product.name}
                            </span>
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
                        <span className="hf-type-small hf-type-strong text-hf-black">
                          {t("createDish.scan")}
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}

            {current.kind === "step" && (
              <RecipeStepPage
                key={page}
                index={current.index}
                step={stepList[current.index]}
                canRemove={stepList.length > 1}
                onChange={(next) => updateStep(current.index, next)}
                onAddAfter={addStepAfter}
                onRemove={removeStep}
              />
            )}

            {current.kind === "images" && (
              <div>
                <p className="hf-type-small hf-type-strong mb-2 text-hf-black">
                  {t("recipeImages.title")}
                </p>
                <RecipeImagesPicker
                  images={images}
                  onChange={(next) => updateDetails({ images: next })}
                />
              </div>
            )}
          </div>
        )}
      </BottomSheet>
      {sheet === "paste" && (
        <PasteTextSheet
          onClose={() => setSheet("none")}
          onResult={applyImport}
        />
      )}
      {sheet === "scan" && (
        <ScanSheet onClose={() => setSheet("none")} onResult={applyImport} />
      )}
      {savedDish && sharePrompt && (
        <BottomSheet
          title={t("createDish.shareQuestionTitle")}
          onClose={() => void answerShare(false)}
        >
          <div className="hf-page">
            <p className="hf-type-body text-hf-black">
              {t("createDish.shareQuestionBody")}
            </p>
            <button
              type="button"
              disabled={sharing}
              onClick={() => void answerShare(true)}
              className="hf-control hf-btn-primary w-full"
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
        <RecipeCategoriesDialog
          dishId={savedDish.id}
          initialTags={savedDish.tags}
          onClose={finish}
        />
      )}
    </HfScreen>
  );
}
