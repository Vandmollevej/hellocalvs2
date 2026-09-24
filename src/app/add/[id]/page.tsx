"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  IconChevronDown,
  IconBookmark,
  IconBookmarkFilled,
  IconAlertTriangle,
  IconLock,
  IconLockOpen,
  IconRefresh,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ForwardButton } from "@/components/ForwardButton";
import { appendDishDraftIngredient } from "@/lib/dish-draft";
import { selectRawContextImageUrl } from "@/lib/image-tags";
import { MacroSliderBar } from "@/components/hf/MacroSliderBar";
import { AdditiveInfoModal } from "@/components/hf/AdditiveInfoModal";
import { TimeSection } from "@/components/hf/TimeSection";
import { getAdditiveInfo } from "@/lib/additives";
import { labelForAllergen } from "@/lib/allergens";
import { useTranslation } from "@/i18n/LocaleProvider";
import { isAlternativeServingConfident } from "@/lib/alternative-servings";
import type { AlternativeServing } from "@/lib/product-analysis-types";
import { fromDisplayAmount, getProductDisplayUnit, toDisplayAmount } from "@/lib/product-display-unit";
import { localApi } from "@/lib/vault/local-api";

const PHOTO_AWARD_TYPE_KEY: Record<string, "photoAward.photoTypeBarcode" | "photoAward.photoTypeNutrition" | "photoAward.photoTypeIngredients"> = {
  BARCODE: "photoAward.photoTypeBarcode",
  NUTRITION: "photoAward.photoTypeNutrition",
  INGREDIENTS: "photoAward.photoTypeIngredients",
};

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
  // Produktkategori + pakningsstørrelse bestemmer mængdeenheden (drikkevare =
  // ml/cl, ellers g), se src/lib/product-display-unit.ts.
  productCategory?: string | null;
  packageSizeText?: string | null;
  imageUrl?: string | null;
  // Tagged image variants (Multiple/Raw), see src/lib/image-tags.ts and
  // docs/DECISIONS.md 2026-09-19. Empty when the product/ingredient has no
  // tagged alternates.
  images?: { url: string; tags: string[] }[];
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
  // Alternative kalorievisninger fra emballagen (per glas/skive/stk. osv.),
  // se docs/DECISIONS.md 2026-09-19 — kun vist når AI'en var sikker nok.
  alternativeServings?: AlternativeServing[] | null;
  // Generisk, ikke-scannet ingrediens (grønt/frugt/kød uden brand, se
  // docs/DECISIONS.md 2026-09-19) — flag sat af /api/products/[id]'s fallback
  // til GenericIngredient. Bruges kun til at vælge registrerings-feltet
  // (genericIngredientId i stedet for productId) og skjule favorit-knappen,
  // som ikke understøtter ingredienser endnu.
  isGenericIngredient?: boolean;
  hasKnownNutrition?: boolean;
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
  // Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): åbne Awards
  // brugeren kan optjene points ved at indsende et bedre billede af dette
  // produkt. Aldrig vist for et produkt uden nogen enabled+OPEN award.
  const [photoAwards, setPhotoAwards] = useState<{ id: string; photoType: string; points: number }[]>([]);
  const [macroOverride, setMacroOverride] = useState<{
    amount: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  // UI-only edit lock (docs/DECISIONS.md 2026-09-22): energifordeling starts
  // read-only on every page load; the snapshot taken at unlock is what the
  // reset button restores. Never persisted.
  const [isProductEditingUnlocked, setIsProductEditingUnlocked] = useState(false);
  const [macroOverrideSnapshot, setMacroOverrideSnapshot] = useState<typeof macroOverride>(null);
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

    localApi("/api/profile")
      .then((res) => res.json())
      .then((data) => setProfile(data.user ?? null))
      .catch(() => setProfile(null));

    localApi("/api/favorites")
      .then((res) => res.json())
      .then((data) => {
        const favorites = (data.favorites ?? []) as { product: { id: string } | null }[];
        setIsFavorite(favorites.some((favorite) => favorite.product?.id === id));
      })
      .catch(() => setIsFavorite(false));

    fetch(`/api/products/${id}/photo-awards`)
      .then((res) => res.json())
      .then((data) => setPhotoAwards(data.awards ?? []))
      .catch(() => setPhotoAwards([]));
  }, [id]);

  async function handleToggleFavorite() {
    if (favoritePending) return;
    const next = !isFavorite;
    setIsFavorite(next);
    setFavoritePending(true);
    try {
      await localApi("/api/favorites", {
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
  // Når varen tilføjes til en opskrift/ret (for=ret), vis den rå-varen
  // (Multiple/Raw-tags, se src/lib/image-tags.ts) i stedet for
  // standardbilledet, som ofte viser det tilberedte/emballerede produkt.
  const displayImageUrl = product
    ? forDish
      ? selectRawContextImageUrl(product.imageUrl, product.images)
      : (product.imageUrl ?? null)
    : null;
  const factor = amount / 100;
  const servingSizeGrams = product?.servingSizeGrams ?? null;
  // Enheden ("portion"/"portioner", "person"/"personer" osv.) vises kun når
  // varen faktisk har den i databasen — UI må ikke gætte en generisk enhed
  // (se design.md-diskussion 2026-09-08).
  const servingSizeUnitSingular = product?.servingSizeUnitSingular ?? null;
  const servingSizeUnitPlural = product?.servingSizeUnitPlural ?? null;
  const hasServingUnit = Boolean(servingSizeGrams && servingSizeUnitSingular && servingSizeUnitPlural);
  const step = servingSizeGrams && amountUnit === "personer" ? servingSizeGrams : 10;
  // Enheden følger produktets registrerede kategori og skifter aldrig ved
  // +/−; amount er altid i basisenheden (g/ml), cl er kun visning.
  const displayUnit = getProductDisplayUnit(product);
  const displayAmount = toDisplayAmount(amount, displayUnit);
  const baseUnitLabel =
    displayUnit === "cl"
      ? t("addProduct.centilitresUnit")
      : displayUnit === "ml"
        ? t("addProduct.millilitresUnit")
        : t("addProduct.gramsUnit");

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

  // Alternative kalorievisninger fra emballagen (per glas/skive/stk. osv.,
  // docs/DECISIONS.md 2026-09-19), vist under standard-Per-100g-tallet — kun
  // dem AI'en var sikker nok på; usikre fund vises aldrig som fakta her, de
  // går i stedet til admin (se src/lib/alternative-servings-review.ts).
  const confidentAlternativeServings = useMemo(
    () => (product?.alternativeServings ?? []).filter(isAlternativeServingConfident),
    [product],
  );

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

  function handleToggleEditLock() {
    if (!isProductEditingUnlocked) setMacroOverrideSnapshot(macroOverride);
    setIsProductEditingUnlocked((unlocked) => !unlocked);
  }

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

      const res = await localApi("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(product?.isGenericIngredient ? { genericIngredientId: id } : { productId: id }),
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
      // Tilberedning/opskrift viser rå-varen, når et "Raw"-tagget billede
      // findes, i stedet for standardbilledet (som ofte er det tilberedte/
      // emballerede produkt) — se src/lib/image-tags.ts.
      imageUrl: selectRawContextImageUrl(product.imageUrl, product.images),
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
            {!forDish && photoAwards.length > 0 && (
              <Link
                href={`/add/${id}/photo-award`}
                className="block bg-hf-black px-4 py-3 text-center text-[13px] font-medium text-hf-white"
              >
                {photoAwards.length === 1
                  ? t("photoAward.bannerSingle", {
                      points: photoAwards[0].points,
                      photoType: t(PHOTO_AWARD_TYPE_KEY[photoAwards[0].photoType]),
                    })
                  : t("photoAward.bannerMultiple", {
                      points: photoAwards.reduce((sum, award) => sum + award.points, 0),
                    })}
              </Link>
            )}
            <div className="flex flex-col p-4">
              {!forDish && (
                <div className="flex justify-end">
                  <ForwardButton kind="PRODUCT" itemId={state.product.id} name={state.product.name} />
                </div>
              )}
              <div className="flex flex-col items-center gap-2 pt-2 text-center">
                <div className="relative h-[190px] w-[190px] min-h-[190px] min-w-[190px] max-h-[190px] max-w-[190px] shrink-0 overflow-visible">
                  <div className="flex h-[190px] w-[190px] min-h-[190px] min-w-[190px] items-center justify-center overflow-hidden rounded-full bg-hf-tan">
                    {displayImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displayImageUrl}
                        alt=""
                        className="block h-full w-full max-h-full max-w-full object-contain p-8"
                      />
                    ) : (
                      <div aria-hidden="true" className="h-full w-full" />
                    )}
                  </div>
                  {!state.product.isGenericIngredient && (
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      aria-label={t(isFavorite ? "search.removeFavorite" : "search.addFavorite")}
                      className="hf-favorite-button"
                    >
                      {isFavorite ? <IconBookmarkFilled size={24} /> : <IconBookmark size={24} />}
                    </button>
                  )}
                  {/* Logo sits on top of the product circle: its bottom-left
                      corner at the circle's bottom point, spanning one radius
                      to the right. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/hello-cal-fruit.png"
                    alt=""
                    className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-[95px] w-[95px] object-contain object-left-bottom"
                  />
                </div>
                {!!state.product.barcodes?.length && state.product.createdByUserId !== profile?.id && (
                  <Link
                    href={`/profile/report-bug?productId=${id}`}
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
                  {state.product.isGenericIngredient && state.product.hasKnownNutrition === false
                    ? t("addProduct.nutritionUnknown")
                    : servingSizeGrams && hasServingUnit
                    ? t("addProduct.kcalPerServing", {
                        kcal: Math.round((state.product.kcalPer100g * servingSizeGrams) / 100),
                        unit: servingSizeUnitSingular as string,
                      })
                    : displayUnit === "g"
                    ? t("addProduct.kcalPer100g", { kcal: Math.round(state.product.kcalPer100g) })
                    : t("addProduct.kcalPer100ml", { kcal: Math.round(state.product.kcalPer100g) })}
                </p>
                {!!confidentAlternativeServings.length && (
                  <div className="mt-1 flex flex-col items-center gap-0.5">
                    {confidentAlternativeServings.map((serving: AlternativeServing, index: number) => (
                      <p key={`${serving.label}-${index}`} className="text-xs text-hf-black opacity-60">
                        {t("addProduct.alternativeServing", { label: serving.label, kcal: Math.round(serving.kcal as number) })}
                      </p>
                    ))}
                  </div>
                )}

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
                <TimeSection value={time} onChange={setTime} className="mb-3 mt-6" />
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
                    {baseUnitLabel}
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
                    <label className="flex items-baseline justify-center text-xl font-bold text-hf-black">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={displayUnit === "cl" ? 1 : 10}
                        step={displayUnit === "cl" ? 1 : 10}
                        value={displayAmount}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isFinite(value)) setAmount(Math.max(0, fromDisplayAmount(value, displayUnit)));
                        }}
                        style={{ width: `${Math.max(1, String(displayAmount).length) + 0.5}ch` }}
                        className="bg-transparent text-right outline-none"
                      />
                      <span>&nbsp;{displayUnit}</span>
                    </label>
                  )}
                  <p className="text-xs opacity-70">
                    {state.product.isGenericIngredient && state.product.hasKnownNutrition === false
                      ? t("addProduct.nutritionUnknown")
                      : `${Math.round((state.product.kcalPer100g * amount) / 100)} kcal`}
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
                <div className="mb-4 flex items-center justify-between">
                  <p className="hf-heading text-[15px] text-hf-black">{t("common.macroBreakdown")}</p>
                  <div className="-my-3 -mr-3 flex items-center">
                    {isProductEditingUnlocked && (
                      <button
                        type="button"
                        onClick={() => setMacroOverride(macroOverrideSnapshot)}
                        aria-label={t("addProduct.resetChanges")}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-hf-black"
                      >
                        <IconRefresh size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleEditLock}
                      aria-label={t(isProductEditingUnlocked ? "addProduct.lockEditing" : "addProduct.unlockEditing")}
                      aria-pressed={isProductEditingUnlocked}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-hf-black"
                    >
                      {isProductEditingUnlocked ? <IconLockOpen size={20} /> : <IconLock size={20} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <MacroSliderBar
                    label={t("common.protein")}
                    grams={macros.protein}
                    max={Math.max(30, Math.ceil(defaultMacros.protein * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, protein: value })}
                    disabled={!isProductEditingUnlocked}
                  />
                  <MacroSliderBar
                    label={t("common.carbs")}
                    grams={macros.carbs}
                    max={Math.max(40, Math.ceil(defaultMacros.carbs * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, carbs: value })}
                    disabled={!isProductEditingUnlocked}
                  />
                  <MacroSliderBar
                    label={t("common.fat")}
                    grams={macros.fat}
                    max={Math.max(20, Math.ceil(defaultMacros.fat * 2))}
                    onChange={(value) => setMacroOverride({ ...macros, amount, fat: value })}
                    disabled={!isProductEditingUnlocked}
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
