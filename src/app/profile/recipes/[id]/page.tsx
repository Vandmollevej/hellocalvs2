"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { IconBookmark, IconBookmarkFilled, IconInfoCircle, IconSoup } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { PersonsSlider } from "@/components/hf/PersonsSlider";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { loadRecipeFilters, saveRecipeFilters } from "@/lib/recipe-filters";
import { MAX_RECIPE_PERSONS, portionKcalFor, scaleFactorFor, type PortionProfile } from "@/lib/recipe-portions";

// En ret fra Indstillinger → Opskrifter (docs/DECISIONS.md 2026-09-24).
// kind=own: brugerens egen ret fra boksen, med deling til/fra.
// kind=shared: en andens delte ret — favorit, egen kopi og "Anmeld" (kun
// indtil admin har godkendt retten). Der vises aldrig noget om udgiveren.
// Mængderne vises justeret til det valgte antal personer à brugerens
// anbefalede servering (src/lib/recipe-portions.ts, DECISIONS 2026-09-25);
// den gemte ret ændres ikke.

type Ingredient = { key: string; name: string; grams: number; imageUrl: string | null; kcal: number; protein: number; carbs: number; fat: number };
type Step = { title: string; text: string; image: string | null };
type View = { name: string; ingredients: Ingredient[]; images: string[]; steps: Step[] };

type OwnDish = {
  name: string;
  sharedRecipeId?: string | null;
  images?: string[];
  steps?: Step[] | null;
  ingredients: {
    id: string;
    grams: number;
    product: { name: string; imageUrl: string | null; kcalPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number };
  }[];
};
type SharedRecipe = {
  id: string;
  name: string;
  canReport: boolean;
  images?: string[];
  steps?: Step[];
  ingredients: {
    productId: string;
    name: string;
    grams: number;
    imageUrl: string | null;
    kcalPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  }[];
};

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function scaled(grams: number, per100: { kcal: number; protein: number; carbs: number; fat: number }) {
  const f = grams / 100;
  return { kcal: per100.kcal * f, protein: per100.protein * f, carbs: per100.carbs * f, fat: per100.fat * f };
}

function RecipeDetailContent() {
  const { t, locale } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const kind = useSearchParams().get("kind") === "own" ? "own" : "shared";

  const [view, setView] = useState<View | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Egen ret
  const [shared, setShared] = useState(false);
  const [showShareInfo, setShowShareInfo] = useState(false);
  // Delt ret
  const [isFavorite, setIsFavorite] = useState(false);
  const [canReport, setCanReport] = useState(false);
  // Justering til antal personer
  const [persons, setPersons] = useState(() => loadRecipeFilters().persons);
  const [portionKcal, setPortionKcal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: PortionProfile }) : {}))
      .then((data) => setPortionKcal(portionKcalFor(data.user)))
      .catch(() => setPortionKcal(portionKcalFor(null)));
  }, []);

  function changePersons(next: number) {
    setPersons(next);
    saveRecipeFilters({ ...loadRecipeFilters(), persons: next });
  }

  useEffect(() => {
    const url =
      kind === "own" ? `/api/dishes/${encodeURIComponent(id)}` : `/api/shared-recipes/${encodeURIComponent(id)}`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("missing");
        if (kind === "own") {
          const { dish } = (await res.json()) as { dish: OwnDish };
          setShared(Boolean(dish.sharedRecipeId));
          setView({
            name: dish.name,
            images: dish.images ?? [],
            steps: Array.isArray(dish.steps) ? dish.steps : [],
            ingredients: dish.ingredients.map((i) => ({
              key: i.id,
              name: i.product.name,
              grams: i.grams,
              imageUrl: i.product.imageUrl ?? null,
              ...scaled(i.grams, {
                kcal: i.product.kcalPer100g,
                protein: i.product.proteinPer100g,
                carbs: i.product.carbsPer100g,
                fat: i.product.fatPer100g,
              }),
            })),
          });
        } else {
          const data = (await res.json()) as { recipe: SharedRecipe; isFavorite: boolean };
          setIsFavorite(data.isFavorite);
          setCanReport(data.recipe.canReport);
          setView({
            name: data.recipe.name,
            images: data.recipe.images ?? [],
            steps: data.recipe.steps ?? [],
            ingredients: data.recipe.ingredients.map((i, index) => ({
              key: `${i.productId}-${index}`,
              name: i.name,
              grams: i.grams,
              imageUrl: i.imageUrl,
              ...scaled(i.grams, { kcal: i.kcalPer100g, protein: i.proteinPer100g, carbs: i.carbsPer100g, fat: i.fatPer100g }),
            })),
          });
        }
        setState("ready");
      })
      .catch(() => setState("missing"));
  }, [id, kind]);

  async function changeSharing(next: boolean) {
    setBusy(true);
    setNotice(null);
    setShared(next);
    const res = await fetch(`/api/dishes/${encodeURIComponent(id)}/share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shared: next, language: locale === "en" ? "en" : "da" }),
    }).catch(() => null);
    if (!res?.ok) {
      setShared(!next);
      setNotice(t("recipeDetail.shareError"));
    }
    setBusy(false);
  }

  async function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    const res = await fetch("/api/recipe-favorites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: id }),
    }).catch(() => null);
    if (!res?.ok) setIsFavorite(!next);
  }

  async function saveCopy() {
    setBusy(true);
    const res = await fetch(`/api/shared-recipes/${encodeURIComponent(id)}/copy`, { method: "POST" }).catch(
      () => null
    );
    setNotice(t(res?.ok ? "recipeDetail.copySaved" : "recipeDetail.copyError"));
    setBusy(false);
  }

  async function report() {
    setBusy(true);
    const res = await fetch(`/api/shared-recipes/${encodeURIComponent(id)}/report`, { method: "POST" }).catch(
      () => null
    );
    if (res?.ok) setCanReport(false);
    setNotice(t(res?.ok ? "recipeDetail.reported" : "recipeDetail.reportError"));
    setBusy(false);
  }

  const baseKcal = (view?.ingredients ?? []).reduce((sum, i) => sum + i.kcal, 0);
  const factor = portionKcal === null ? 1 : scaleFactorFor(baseKcal, portionKcal, persons);
  const ingredients = (view?.ingredients ?? []).map((i) => ({
    ...i,
    grams: i.grams * factor,
    kcal: i.kcal * factor,
    protein: i.protein * factor,
    carbs: i.carbs * factor,
    fat: i.fat * factor,
  }));
  const totals = ingredients.reduce(
    (acc, i) => ({
      grams: acc.grams + i.grams,
      kcal: acc.kcal + i.kcal,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }),
    { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <HfScreen
      title={view?.name ?? t("recipes.title")}
      icon={<IconSoup size={20} stroke={2} />}
      footer={
        state === "ready" && kind === "shared" ? (
          <button type="button" onClick={saveCopy} disabled={busy} className="hf-btn-primary w-full py-3.5 text-[15px] disabled:opacity-60">
            {t("recipeDetail.saveCopy")}
          </button>
        ) : undefined
      }
    >
      <div className="hf-page">
        {state === "loading" && (
          <p className="py-8 text-center text-sm text-hf-black opacity-60">{t("recipeDetail.loading")}</p>
        )}
        {state === "missing" && (
          <p className="py-8 text-center text-sm text-hf-black opacity-60">{t("recipeDetail.notFound")}</p>
        )}

        {state === "ready" && view && (
          <>
            {notice && <p className="rounded-[8px] bg-hf-tan px-4 py-3 text-[13px] text-hf-black">{notice}</p>}

            {view.images.length > 0 && (
              <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4">
                {view.images.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={image}
                    src={image}
                    alt=""
                    className={`aspect-[4/3] shrink-0 snap-center rounded-2xl object-cover ${
                      view.images.length === 1 ? "w-full" : "w-[85%]"
                    }`}
                  />
                ))}
              </div>
            )}

            {kind === "own" && (
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
                  <Toggle checked={shared} onChange={changeSharing} disabled={busy} />
                </div>
                {showShareInfo && (
                  <p className="mt-2 rounded-[8px] border border-hf-gray-light bg-hf-white px-3 py-2 text-[13px] text-hf-black">
                    {t("createDish.shareInfo")}
                  </p>
                )}
              </div>
            )}

            {kind === "shared" && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className="flex h-11 items-center gap-2 text-[14px] font-semibold text-hf-black"
                >
                  {isFavorite ? <IconBookmarkFilled size={20} /> : <IconBookmark size={20} />}
                  {t(isFavorite ? "recipeDetail.removeFavorite" : "recipeDetail.addFavorite")}
                </button>
                {canReport && (
                  <button
                    type="button"
                    onClick={report}
                    disabled={busy}
                    className="flex h-11 items-center text-[12px] text-hf-black underline opacity-70 disabled:opacity-40"
                  >
                    {t("recipeDetail.report")}
                  </button>
                )}
              </div>
            )}

            {portionKcal !== null && baseKcal > 0 && (
              <div className="rounded-2xl bg-hf-tan px-4 py-3">
                <PersonsSlider
                  label={t("recipeFilters.personsTitle")}
                  value={persons}
                  max={MAX_RECIPE_PERSONS}
                  onChange={changePersons}
                />
                <p className="pt-3 text-[12px] text-hf-black opacity-60">
                  {t("recipeFilters.kcalPerServing", { kcal: round(totals.kcal / persons) })}
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-bold text-hf-black">{t("recipeDetail.ingredients")}</p>
              <div className="overflow-hidden rounded-2xl bg-hf-tan">
                {ingredients.map((ingredient) => (
                  <div
                    key={ingredient.key}
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
                        {t("recipeDetail.gramsKcal", { grams: round(ingredient.grams), kcal: round(ingredient.kcal) })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hf-card">
              <p className="text-xs font-bold text-hf-black">{t("recipeDetail.total")}</p>
              <p className="text-sm text-hf-black">
                {t("recipeDetail.gramsKcal", { grams: round(totals.grams), kcal: round(totals.kcal) })}
              </p>
              <p className="text-xs text-hf-black opacity-60">
                {t("recipeDetail.macrosSummary", {
                  protein: round(totals.protein, 1),
                  carbs: round(totals.carbs, 1),
                  fat: round(totals.fat, 1),
                })}
              </p>
            </div>

            {view.steps.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold text-hf-black">{t("recipeSteps.title")}</p>
                <div className="overflow-hidden rounded-2xl bg-hf-tan">
                  {view.steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-3 border-b border-hf-tan-dark px-4 py-3 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-hf-black opacity-60">
                          {t("recipeSteps.stepNumber", { number: index + 1 })}
                        </p>
                        {step.title && <p className="text-[14px] font-semibold text-hf-black">{step.title}</p>}
                        {step.text && <p className="whitespace-pre-line text-[13px] text-hf-black">{step.text}</p>}
                      </div>
                      {step.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={step.image} alt="" className="h-16 w-16 shrink-0 rounded-[8px] object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </HfScreen>
  );
}

export default function RecipeDetailPage() {
  return (
    <Suspense fallback={null}>
      <RecipeDetailContent />
    </Suspense>
  );
}
