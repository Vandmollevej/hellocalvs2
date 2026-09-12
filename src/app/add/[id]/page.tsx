"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { IconChevronDown, IconBookmark, IconBookmarkFilled, IconAlertTriangle } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ForwardButton } from "@/components/ForwardButton";
import { appendDishDraftIngredient } from "@/lib/dish-draft";
import { MacroSliderBar } from "@/components/hf/MacroSliderBar";
import { AdditiveInfoModal } from "@/components/hf/AdditiveInfoModal";
import { getAdditiveInfo } from "@/lib/additives";
import { labelForAllergen } from "@/lib/allergens";
import { useTranslation } from "@/i18n/LocaleProvider";

function currentTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatDaNumber(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

function currentDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type Product = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSizeGrams?: number | null;
  servingSizeUnitSingular?: string | null;
  servingSizeUnitPlural?: string | null;
  brand: { name: string } | null;
  imageUrl?: string | null;
  ingredientsText?: string | null;
  allergens?: string[];
  additives?: string[];
  barcodes?: { code: string }[];
  createdByUserId?: string | null;
  // HelloFresh-recipe extra nutrition, per Product.servingSizeGrams — see
  // docs/DECISIONS.md 2026-08-29/2026-09-10.
  nutritionExtra?: Record<string, number> | null;
  // MyFitnessPal-style extended panel (2026-09-11), per 100g — currently only
  // populated for products sourced from Open Food Facts.
  saturatedFatPer100g?: number | null;
  unsaturatedFatPer100g?: number | null;
  transFatPer100g?: number | null;
  cholesterolPer100g?: number | null;
  vitaminAPer100g?: number | null;
  vitaminCPer100g?: number | null;
};

type ProfileUser = {
  id: string;
  showAllergens: boolean;
  allergenVisibility: Record<string, boolean> | null;
  showExtendedNutrition: boolean;
};

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; product: Product }
  | { status: "not_found" }
  | { status: "error" };

export default function AddPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forDish = searchParams.get("for") === "ret";
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [amount, setAmount] = useState(100);
  // Standard skal altid være gram (Fejlretninger/FEJLLISTE.md #1/#22): "personer"
  // er kun en mulighed, når varen faktisk har en defineret portionsstørrelse,
  // og må ikke være default-valget selv når den findes.
  const [amountUnit, setAmountUnit] = useState<"personer" | "gram">("gram");
  const [time, setTime] = useState(() => searchParams.get("time") ?? currentTimeString());
  const [date] = useState(() => searchParams.get("date") ?? currentDateString());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openAdditive, setOpenAdditive] = useState<string | null>(null);
  const [additivesOpen, setAdditivesOpen] = useState(false);
  const [extendedNutritionOpen, setExtendedNutritionOpen] = useState(false);
  const [additiveNames, setAdditiveNames] = useState<Record<string, string>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [macroOverride, setMacroOverride] = useState<{
    amount: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(async (res) => {
        if (res.status === 404) return setState({ status: "not_found" });
        if (!res.ok) return setState({ status: "error" });
        const data = await res.json();
        setState({ status: "loaded", product: data.product });
        // Dishes with a fixed serving size (e.g. HelloFresh, see
        // scripts/hellofresh-import) are counted in servings, not grams — start
        // at 1 serving instead of the usual 100 g default.
        if (data.product?.servingSizeGrams) setAmount(data.product.servingSizeGrams);
      })
      .catch(() => setState({ status: "error" }));

    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setProfile(data.user ?? null))
      .catch(() => setProfile(null));

    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data) => {
        const favorites = (data.favorites ?? []) as { product: { id: string } | null }[];
        setIsFavorite(favorites.some((favorite) => favorite.product?.id === id));
      })
      .catch(() => setIsFavorite(false));
  }, [id]);

  async function handleToggleFavorite() {
    if (favoritePending) return;
    const next = !isFavorite;
    setIsFavorite(next);
    setFavoritePending(true);
    try {
      await fetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      });
    } catch {
      setIsFavorite(!next);
    } finally {
      setFavoritePending(false);
    }
  }

  const product = state.status === "loaded" ? state.product : null;
  const factor = amount / 100;
  const servingSizeGrams = product?.servingSizeGrams ?? null;
  // Enheden ("portion"/"portioner", "person"/"personer" osv.) vises kun når
  // varen faktisk har den i databasen — UI må ikke gætte en generisk enhed
  // (se design.md-diskussion 2026-09-08).
  const servingSizeUnitSingular = product?.servingSizeUnitSingular ?? null;
  const servingSizeUnitPlural = product?.servingSizeUnitPlural ?? null;
  const hasServingUnit = Boolean(servingSizeGrams && servingSizeUnitSingular && servingSizeUnitPlural);
  const step = servingSizeGrams && amountUnit === "personer" ? servingSizeGrams : 10;

  useEffect(() => {
    const codes = product?.additives ?? [];
    if (!codes.length) return;
    let cancelled = false;
    Promise.all(codes.map((code) => getAdditiveInfo(code))).then((results) => {
      if (cancelled) return;
      setAdditiveNames((prev) => {
        const next = { ...prev };
        results.forEach((info, index) => {
          next[codes[index]] = info.internationalName || codes[index];
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [product?.additives]);

  const defaultMacros = useMemo(
    () =>
      product
        ? {
            protein: Math.round(product.proteinPer100g * factor * 10) / 10,
            carbs: Math.round(product.carbsPer100g * factor * 10) / 10,
            fat: Math.round(product.fatPer100g * factor * 10) / 10,
          }
        : { protein: 0, carbs: 0, fat: 0 },
    [product, factor]
  );

  // Overrides only apply to the amount they were set at — if the amount changes,
  // the bars automatically follow the computed default values again.
  const macros = macroOverride && macroOverride.amount === amount ? macroOverride : defaultMacros;

  // MyFitnessPal-style extended nutrition panel (2026-09-11): saturated/
  // unsaturated/trans fat, cholesterol, and vitamin A/C are real per-100g
  // Product fields (Open Food Facts-sourced products only), scaled by the
  // current amount just like the macro bars above. Sugar/fiber/salt/
  // potassium/calcium/iron come from Product.nutritionExtra instead, which is
  // per the product's own servingSizeGrams, not per 100g (see
  // scripts/hellofresh-import/agent.py) — only scaled when that's known.
  const extendedNutrition = useMemo(() => {
    if (!product) return [];
    const extraFactor = product.servingSizeGrams ? amount / product.servingSizeGrams : null;
    const extra = product.nutritionExtra ?? null;
    const fromExtra = (key: string) =>
      extraFactor !== null && extra && typeof extra[key] === "number" ? extra[key] * extraFactor : null;
    const fromPer100g = (value: number | null | undefined) =>
      typeof value === "number" ? value * factor : null;

    const rows: { key: string; value: number | null; unit: string; digits?: number }[] = [
      { key: "saturatedFat", value: fromPer100g(product.saturatedFatPer100g), unit: "g", digits: 1 },
      { key: "unsaturatedFat", value: fromPer100g(product.unsaturatedFatPer100g), unit: "g", digits: 1 },
      { key: "transFat", value: fromPer100g(product.transFatPer100g), unit: "g", digits: 2 },
      { key: "cholesterol", value: fromPer100g(product.cholesterolPer100g), unit: "mg" },
      { key: "sodium", value: fromExtra("saltG"), unit: "g", digits: 1 },
      { key: "potassium", value: fromExtra("potassiumMg"), unit: "mg" },
      { key: "fiber", value: fromExtra("fiberG"), unit: "g", digits: 1 },
      { key: "sugar", value: fromExtra("sugarG"), unit: "g", digits: 1 },
      { key: "vitaminA", value: fromPer100g(product.vitaminAPer100g), unit: "µg" },
      { key: "vitaminC", value: fromPer100g(product.vitaminCPer100g), unit: "mg" },
      { key: "calcium", value: fromExtra("calciumMg"), unit: "mg" },
      { key: "iron", value: fromExtra("ironMg"), unit: "mg", digits: 1 },
    ];

    return rows
      .filter((row): row is { key: string; value: number; unit: string; digits?: number } => row.value !== null)
      .map((row) => ({ ...row, label: t(`addProduct.nutrient.${row.key}`) }));
  }, [product, amount, factor, t]);

  const visibleAllergens = useMemo(() => {
    if (!product?.allergens?.length || !profile?.showAllergens) return [];
    return product.allergens.filter(
      (key) => !profile.allergenVisibility || profile.allergenVisibility[key] !== false
    );
  }, [product, profile]);

  function scrollToDetails() {
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleAdd() {
    setSaving(true);
    setSaveError(null);
    try {
      const [year, month, day] = date.split("-").map(Number);
      const [hours, minutes] = time.split(":").map(Number);
      const createdAt = new Date(year, month - 1, day, hours, minutes, 0, 0);

      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: id,
          amountGrams: amount,
          createdAt: createdAt.toISOString(),
          proteinSnapshot: macros.protein,
          carbsSnapshot: macros.carbs,
          fatSnapshot: macros.fat,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.message ?? t("addProduct.saveError"));
        return;
      }
      router.push("/");
    } catch {
      setSaveError(t("addProduct.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function handleAddToDish() {
    if (!product) return;
    appendDishDraftIngredient({
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      kcalPer100g: product.kcalPer100g,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
      grams: amount,
    });
    router.push("/create-dish");
  }

  return (
    <HfScreen
      title={forDish ? t("addProduct.titleForDish") : t("addProduct.title")}
      footer={
        state.status === "loaded" ? (
          <>
            {saveError && (
              <p className="mb-2 text-center text-sm text-hf-black opacity-70">{saveError}</p>
            )}
            <button
              onClick={forDish ? handleAddToDish : handleAdd}
              disabled={saving}
              className="hf-btn-primary w-full py-3.5 text-[15px] disabled:opacity-60"
            >
              {forDish ? t("addProduct.addToDish") : saving ? t("createDish.saving") : t("addProduct.add")}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="flex h-full flex-col overflow-y-auto">
        {state.status === "loading" && (
          <p className="p-4 text-center text-sm text-hf-black opacity-60">{t("addProduct.loading")}</p>
        )}

        {(state.status === "not_found" || state.status === "error") && (
          <div className="m-4 rounded-2xl bg-hf-tan p-4 text-center">
            <p className="text-sm text-hf-black opacity-70">
              {state.status === "not_found"
                ? t("addProduct.notFound")
                : t("addProduct.error")}
            </p>
          </div>
        )}

        {state.status === "loaded" && (
          <>
            <div className="flex flex-col p-4">
              {!forDish && (
                <div className="flex justify-end">
                  <ForwardButton kind="PRODUCT" itemId={state.product.id} name={state.product.name} />
                </div>
              )}
              <div className="flex flex-col items-center gap-2 pt-2 text-center">
                <div className="relative h-[190px] w-[190px]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-hf-tan">
                    {state.product.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={state.product.imageUrl}
                        alt=""
                        className="h-full w-full object-contain p-8"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    aria-label={t(isFavorite ? "search.removeFavorite" : "search.addFavorite")}
                    className="hf-favorite-button"
                  >
                    {isFavorite ? <IconBookmarkFilled size={24} /> : <IconBookmark size={24} />}
                  </button>
                  <div className="absolute -right-5 bottom-0 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/hello-cal-fruit.png"
                      alt=""
                      className="h-14 w-14 object-contain"
                    />
                  </div>
                </div>
                {!!state.product.barcodes?.length && state.product.createdByUserId !== profile?.id && (
                  <Link
                    href="/profile/report-bug"
                    className="flex items-center gap-1 self-start text-[13px] font-medium text-hf-black opacity-70"
                  >
                    <IconAlertTriangle size={16} />
                    {t("swipeableRow.reportError")}
                  </Link>
                )}
                <p className="hf-heading text-lg text-hf-black">{state.product.name}</p>
                {state.product.brand && (
                  <p className="text-sm font-bold text-hf-green">
                    {state.product.brand.name}
                  </p>
                )}
                <p className="text-sm font-bold text-hf-black">
                  {servingSizeGrams && hasServingUnit
                    ? t("addProduct.kcalPerServing", {
                        kcal: Math.round((state.product.kcalPer100g * servingSizeGrams) / 100),
                        unit: servingSizeUnitSingular as string,
                      })
                    : t("addProduct.kcalPer100g", { kcal: Math.round(state.product.kcalPer100g) })}
                </p>

                <div className="mt-2 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={scrollToDetails}
                    className="flex items-center gap-1 text-[13px] font-medium text-hf-black underline underline-offset-2"
                  >
                    {t("addProduct.details")}
                    <IconChevronDown size={15} />
                  </button>
                </div>
              </div>

              {!forDish && (
                <div className="mb-3 mt-6 flex items-center justify-between rounded-2xl bg-hf-tan px-4 py-3">
                  <span className="text-sm font-medium text-hf-black opacity-70">{t("addProduct.time")}</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="bg-transparent text-right text-sm font-bold text-hf-black"
                  />
                </div>
              )}

              {hasServingUnit && (
                <div className="mb-3 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAmountUnit("personer")}
                    className={
                      amountUnit === "personer"
                        ? "hf-btn-primary px-4 py-1.5 text-xs"
                        : "hf-btn-secondary px-4 py-1.5 text-xs"
                    }
                  >
                    <span className="capitalize">{servingSizeUnitPlural}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountUnit("gram")}
                    className={
                      amountUnit === "gram"
                        ? "hf-btn-primary px-4 py-1.5 text-xs"
                        : "hf-btn-secondary px-4 py-1.5 text-xs"
                    }
                  >
                    {t("addProduct.gramsUnit")}
                  </button>
                </div>
              )}

              <div className="mb-4 flex items-center gap-2">
                <button
                  onClick={() => setAmount((a) => Math.max(step, a - step))}
                  className="h-11 w-11 rounded-full bg-hf-tan text-lg font-bold text-hf-black"
                >
                  −
                </button>
                <div className="flex-1 rounded-2xl bg-hf-tan py-3 text-center text-hf-black">
                  {hasServingUnit && amountUnit === "personer" ? (
                    <p className="text-xl font-bold capitalize">
                      {`${Math.round(amount / (servingSizeGrams as number))} ${
                        amount === servingSizeGrams ? servingSizeUnitSingular : servingSizeUnitPlural
                      }`}
                    </p>
                  ) : (
                    <input
                      type="number"
                      inputMode="numeric"
                      min={10}
                      step={10}
                      value={amount}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) setAmount(Math.max(0, value));
                      }}
                      className="w-full bg-transparent text-center text-xl font-bold text-hf-black outline-none"
                    />
                  )}
                  <p className="text-xs opacity-70">
                    {Math.round((state.product.kcalPer100g * amount) / 100)} kcal
                  </p>
                </div>
                <button
                  onClick={() => setAmount((a) => a + step)}
                  className="h-11 w-11 rounded-full bg-hf-tan text-lg font-bold text-hf-black"
                >
                  +
                </button>
              </div>

            </div>

            <div ref={detailsRef} className="flex flex-col gap-6 border-t border-hf-tan-dark p-4">
              <div>
                <p className="hf-heading mb-4 text-[15px] text-hf-black">{t("common.macroBreakdown")}</p>
                <div className="flex flex-col gap-4">
                  <MacroSliderBar
                    label={t("common.protein")}
                    grams={macros.protein}
                    max={Math.max(30, Math.ceil(defaultMacros.protein * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, protein: value })}
                  />
                  <MacroSliderBar
                    label={t("common.carbs")}
                    grams={macros.carbs}
                    max={Math.max(40, Math.ceil(defaultMacros.carbs * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, carbs: value })}
                  />
                  <MacroSliderBar
                    label={t("common.fat")}
                    grams={macros.fat}
                    max={Math.max(20, Math.ceil(defaultMacros.fat * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, fat: value })}
                  />
                </div>
              </div>

              {!!state.product.additives?.length && (
                <div>
                  <button
                    type="button"
                    onClick={() => setAdditivesOpen((open) => !open)}
                    className="mb-3 flex w-full items-center justify-between"
                  >
                    <p className="hf-heading text-[15px] text-hf-black">{t("addProduct.additives")}</p>
                    <IconChevronDown
                      size={18}
                      className={`text-hf-black transition-transform ${additivesOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {additivesOpen && (
                  <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
                    {state.product.additives.map((code, index) => {
                      const name = additiveNames[code] ?? code.toUpperCase();
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setOpenAdditive(code)}
                          className={`flex items-center gap-3 px-4 py-3 text-left ${
                            index < (state.product.additives?.length ?? 0) - 1
                              ? "border-b border-hf-tan-dark"
                              : ""
                          }`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hf-green text-[11px] font-bold text-hf-white">
                            E
                          </span>
                          <span className="text-[13px] text-hf-black opacity-70">
                            ({code.toUpperCase()}){" "}
                            <span className="underline underline-offset-2">{name}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}

              {!!visibleAllergens.length && (
                <div>
                  <p className="hf-heading mb-2 flex items-center gap-2 text-[15px] text-hf-black">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hf-green text-[12px] font-bold text-hf-white">
                      !
                    </span>
                    {t("addProduct.allergens")}
                  </p>
                  <p className="text-[13px] text-hf-black opacity-70">
                    {visibleAllergens.map((key) => labelForAllergen(key)).join(", ")}
                  </p>
                  <p className="mt-2 text-[11px] text-hf-black opacity-50">
                    {t("addProduct.allergenDisclaimer")}
                  </p>
                </div>
              )}

              {!!state.product.ingredientsText && (
                <div>
                  <p className="hf-heading mb-2 text-[15px] text-hf-black">{t("createDish.ingredients")}</p>
                  <p className="text-[13px] leading-relaxed text-hf-black opacity-70">
                    {state.product.ingredientsText}
                  </p>
                </div>
              )}

              {/* MyFitnessPal-style extended nutrition panel (2026-09-11): only
                  shown when the user opted in (profile/settings) AND at least
                  one value actually exists for this product — never renders
                  as an empty block. Collapsed by default behind "Vis mere". */}
              {profile?.showExtendedNutrition && !!extendedNutrition.length && (
                <div>
                  <button
                    type="button"
                    onClick={() => setExtendedNutritionOpen((open) => !open)}
                    className="flex w-full items-center justify-between"
                  >
                    <p className="hf-heading text-[15px] text-hf-black">{t("addProduct.extendedNutrition")}</p>
                    <span className="flex items-center gap-1 text-[13px] font-medium text-hf-black underline underline-offset-2">
                      {extendedNutritionOpen ? t("addProduct.showLess") : t("addProduct.showMore")}
                      <IconChevronDown
                        size={15}
                        className={`transition-transform ${extendedNutritionOpen ? "rotate-180" : ""}`}
                      />
                    </span>
                  </button>
                  {extendedNutritionOpen && (
                    <div className="mt-3 flex flex-col overflow-hidden rounded-2xl bg-hf-tan">
                      {extendedNutrition.map((row, index) => (
                        <div
                          key={row.key}
                          className={`flex items-center justify-between px-4 py-2.5 text-[13px] text-hf-black ${
                            index < extendedNutrition.length - 1 ? "border-b border-hf-tan-dark" : ""
                          }`}
                        >
                          <span className="opacity-70">{row.label}</span>
                          <span className="font-medium">
                            {formatDaNumber(row.value, row.digits ?? 0)} {row.unit}
                          </span>
                        </div>
                      ))}
                      <p className="px-4 py-2.5 text-[11px] text-hf-black opacity-50">
                        {t("addProduct.extendedNutritionDisclaimer")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {openAdditive && (
        <AdditiveInfoModal code={openAdditive} onClose={() => setOpenAdditive(null)} />
      )}
    </HfScreen>
  );
}
