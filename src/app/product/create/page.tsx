"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconApple } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { CreateProductMediaGrid, type MediaGridValue } from "@/components/hf/CreateProductMediaGrid";
import type { ParsedNutrition } from "@/lib/product-ocr";
import { PRODUCT_DRAFT_STORAGE_KEY, type ProductCreateDraft } from "@/lib/product-draft";
import type { AlternativeServing, AnalysisIds } from "@/lib/product-analysis-types";
import { queuePendingProduct } from "@/lib/offline-product-queue";
import { useTranslation } from "@/i18n/LocaleProvider";

type FormValues = {
  brand: string;
  subbrand: string;
  name: string;
  variant: string;
  packageSizeText: string;
  kcalPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
  servingSizeGrams: string;
  servingSizeUnitSingular: string;
  servingSizeUnitPlural: string;
  ingredientsText: string;
};

const EMPTY_VALUES: FormValues = {
  brand: "",
  subbrand: "",
  name: "",
  variant: "",
  packageSizeText: "",
  kcalPer100g: "",
  proteinPer100g: "",
  carbsPer100g: "",
  fatPer100g: "",
  servingSizeGrams: "",
  servingSizeUnitSingular: "",
  servingSizeUnitPlural: "",
  ingredientsText: "",
};

type DraftState = {
  form: FormValues;
  media: MediaGridValue;
  analysisIds: AnalysisIds;
  marketRegion?: string;
  gs1Regions?: string[];
  alternativeServings?: AlternativeServing[];
};

function readDraft(): DraftState {
  const empty: DraftState = {
    form: EMPTY_VALUES,
    media: {
      barcodeValue: "",
      sideImages: [undefined, undefined, undefined] as [string?, string?, string?],
    },
    analysisIds: {},
  };
  if (typeof window === "undefined") return empty;

  const raw = sessionStorage.getItem(PRODUCT_DRAFT_STORAGE_KEY);
  if (!raw) return empty;
  sessionStorage.removeItem(PRODUCT_DRAFT_STORAGE_KEY);

  try {
    const draft = JSON.parse(raw) as ProductCreateDraft;
    return {
      form: {
        brand: draft.brand ?? "",
        subbrand: draft.subbrand ?? "",
        name: draft.name ?? "",
        variant: draft.variant ?? "",
        packageSizeText: draft.packageSizeText ?? "",
        kcalPer100g: draft.kcalPer100g ?? "",
        proteinPer100g: draft.proteinPer100g ?? "",
        carbsPer100g: draft.carbsPer100g ?? "",
        fatPer100g: draft.fatPer100g ?? "",
        servingSizeGrams: draft.servingSizeGrams ?? "",
        servingSizeUnitSingular: "",
        servingSizeUnitPlural: "",
        ingredientsText: draft.ingredientsText ?? "",
      },
      media: {
        barcodeValue: draft.barcodeValue ?? "",
        barcodeImage: draft.barcodeImage,
        nutritionImage: draft.nutritionImage,
        ingredientsImage: draft.ingredientsImage,
        mainImage: draft.mainImage,
        sideImages: draft.sideImages ?? [undefined, undefined, undefined],
      },
      analysisIds: draft.analysisIds ?? {},
      marketRegion: draft.marketRegion,
      gs1Regions: draft.gs1Regions,
      alternativeServings: draft.alternativeServings,
    };
  } catch {
    return empty;
  }
}

function OpretProduktContent() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromFailedAdd = searchParams.get("fromFailedAdd") === "1";
  const [initial] = useState(readDraft);
  const [form, setForm] = useState<FormValues>(initial.form);
  const [media, setMedia] = useState<MediaGridValue>(initial.media);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [region, setRegion] = useState(initial.marketRegion ?? "DK");

  // Hvis draften allerede fastfrøs en markedsregion ved stregkode-scanning
  // (docs/DECISIONS.md, 2026-09-17), bruges den i stedet for et nyt
  // profil-opslag, så senere billeder ikke kan ændre sprogsignalet.
  useEffect(() => {
    if (initial.marketRegion) return;
    let cancelled = false;
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { region?: string } } | null) => {
        if (!cancelled && data?.user?.region) setRegion(data.user.region);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial.marketRegion]);

  function update(key: keyof FormValues, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyExtractedNutrition(values: ParsedNutrition) {
    setForm((prev) => ({
      ...prev,
      kcalPer100g: String(values.kcalPer100g),
      proteinPer100g: String(values.proteinPer100g),
      carbsPer100g: String(values.carbsPer100g),
      fatPer100g: String(values.fatPer100g),
    }));
  }

  function applyExtractedIngredients(text: string) {
    setForm((prev) => ({ ...prev, ingredientsText: text }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    const body = {
      brand: form.brand || undefined,
      subbrand: form.subbrand || undefined,
      name: form.name,
      variant: form.variant || undefined,
      packageSizeText: form.packageSizeText || undefined,
      kcalPer100g: form.kcalPer100g,
      proteinPer100g: form.proteinPer100g,
      carbsPer100g: form.carbsPer100g,
      fatPer100g: form.fatPer100g,
      servingSizeGrams: form.servingSizeGrams || undefined,
      servingSizeUnitSingular: form.servingSizeUnitSingular || undefined,
      servingSizeUnitPlural: form.servingSizeUnitPlural || undefined,
      ingredientsText: form.ingredientsText || undefined,
      barcode: media.barcodeValue || undefined,
      imageUrl: media.mainImage,
      extraImages: [media.sideImages[0], media.sideImages[1], media.sideImages[2]].filter(
        (image): image is string => Boolean(image),
      ),
      // AI-prediction/correction ground truth (docs/DECISIONS.md, 2026-09-17):
      // /api/products kobler disse analyse-rækker til det oprettede produkt
      // og gemmer formens endelige værdier som correction.
      analysisIds: initial.analysisIds,
      marketRegion: region,
      gs1Regions: initial.gs1Regions ?? [],
      // Alternative kalorievisninger (per glas/skive/stk. osv.) fundet af AI'en
      // på selve emballagen — ikke redigerbare i denne formular, sendes
      // videre uændret (docs/DECISIONS.md 2026-09-19).
      alternativeServings: initial.alternativeServings ?? [],
    };

    // Offline (or the device only thinks it's offline): the same JSON body
    // that would otherwise POST straight to /api/products is queued on the
    // device instead (src/lib/offline-product-queue.ts) and replayed
    // automatically once the browser reports a connection again — there is
    // no product id yet, so there's nothing to navigate to, unlike the
    // normal success path below.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await queuePendingProduct(body);
      setSaving(false);
      setSavedOffline(true);
      return;
    }

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveError(data.message ?? t("productCreate.saveError"));
        return;
      }
      router.push(`/add/${data.product.id}`);
    } catch {
      // fetch threw — most likely a real network failure, so queue it
      // instead of showing a dead-end error.
      await queuePendingProduct(body);
      setSavedOffline(true);
    } finally {
      setSaving(false);
    }
  }

  if (savedOffline) {
    return (
      <HfScreen title={t("productCreate.title")} icon={<IconApple size={20} stroke={2} />} onBack={() => router.back()}>
        <div className="flex flex-col gap-4 p-4">
          <div
            className="hf-type-body-sm rounded-[8px] p-4 text-center"
            style={{ background: "var(--hf-color-brand)", color: "var(--hf-color-white)" }}
          >
            {t("productCreate.savedOffline")}
          </div>
          <button type="button" onClick={() => router.push("/foods")} className="hf-btn-primary h-12">
            <span className="hf-type-button">{t("common.continue")}</span>
          </button>
        </div>
      </HfScreen>
    );
  }

  return (
    <HfScreen
      title={t("productCreate.title")}
      icon={<IconApple size={20} stroke={2} />}
      onBack={() => router.back()}
    >
      <div className="flex flex-col gap-4 p-4">
        {fromFailedAdd && (
          <div
            className="hf-type-body-sm rounded-[8px] p-4 text-center"
            style={{ background: "var(--hf-color-brand)", color: "var(--hf-color-white)" }}
          >
            {t("productCreate.failedAddBanner")}
          </div>
        )}

        {fromFailedAdd && (
          <div>
            <div
              className="hf-type-body-sm rounded-[8px] border-2 p-4 text-center"
              style={{
                background: "#FDF3D3",
                borderColor: "var(--hf-color-brand)",
                color: "var(--hf-color-text)",
              }}
            >
              {t("productCreate.pointsBanner")}
            </div>
            <p className="hf-type-caption mt-1 text-center" style={{ color: "var(--hf-color-text-secondary)" }}>
              *<Link href="/betingelser#pointsystem" className="underline">{t("productCreate.readTerms")}</Link>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CreateProductMediaGrid
            value={media}
            onChange={setMedia}
            region={region}
            uiLang={locale}
            onNutritionExtracted={applyExtractedNutrition}
            onIngredientsExtracted={applyExtractedIngredients}
          />

          <TextField
            variant="standard"
            value={media.barcodeValue}
            onChange={(event) => setMedia((prev) => ({ ...prev, barcodeValue: event.target.value }))}
            inputMode="numeric"
            label={t("productCreate.barcodeLabel")}
            placeholder={t("productCreate.barcodePlaceholder")}
          />

          <div className="flex flex-col gap-3 rounded-[8px] p-4" style={{ background: "var(--hf-color-card)" }}>
            <TextField
              variant="standard"
              value={form.brand}
              onChange={(event) => update("brand", event.target.value)}
              autoComplete="off"
              label={t("productCreate.brandLabel")}
              placeholder={t("productCreate.brandPlaceholder")}
            />
            <TextField
              variant="standard"
              value={form.subbrand}
              onChange={(event) => update("subbrand", event.target.value)}
              autoComplete="off"
              label={t("productCreate.subbrandLabel")}
              placeholder={t("productCreate.subbrandPlaceholder")}
            />
            <TextField
              variant="standard"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              autoComplete="off"
              label={t("productCreate.productNameLabel")}
              placeholder={t("productCreate.productNamePlaceholder")}
              required
            />
            <TextField
              variant="standard"
              value={form.variant}
              onChange={(event) => update("variant", event.target.value)}
              autoComplete="off"
              label={t("productCreate.variantLabel")}
              placeholder={t("productCreate.variantPlaceholder")}
            />
            <TextField
              variant="standard"
              value={form.packageSizeText}
              onChange={(event) => update("packageSizeText", event.target.value)}
              autoComplete="off"
              label={t("productCreate.packageSizeLabel")}
              placeholder={t("productCreate.packageSizePlaceholder")}
            />

            <div className="flex gap-3">
              <TextField
                variant="standard"
                className="flex-1"
                value={form.kcalPer100g}
                onChange={(event) => update("kcalPer100g", event.target.value)}
                inputMode="decimal"
                label={t("productCreate.caloriesLabel")}
                required
              />
              <TextField
                variant="standard"
                className="flex-1"
                value={form.proteinPer100g}
                onChange={(event) => update("proteinPer100g", event.target.value)}
                inputMode="decimal"
                label={t("productCreate.proteinLabel")}
                required
              />
            </div>

            <div className="flex gap-3">
              <TextField
                variant="standard"
                className="flex-1"
                value={form.carbsPer100g}
                onChange={(event) => update("carbsPer100g", event.target.value)}
                inputMode="decimal"
                label={t("productCreate.carbsLabel")}
                required
              />
              <TextField
                variant="standard"
                className="flex-1"
                value={form.fatPer100g}
                onChange={(event) => update("fatPer100g", event.target.value)}
                inputMode="decimal"
                label={t("productCreate.fatLabel")}
                required
              />
            </div>

            <TextField
              variant="standard"
              value={form.servingSizeGrams}
              onChange={(event) => update("servingSizeGrams", event.target.value)}
              inputMode="decimal"
              label={t("productCreate.servingSizeLabel")}
            />

            {form.servingSizeGrams && (
              <div className="flex gap-3">
                <TextField
                  variant="standard"
                  className="flex-1"
                  value={form.servingSizeUnitSingular}
                  onChange={(event) => update("servingSizeUnitSingular", event.target.value)}
                  label={t("productCreate.servingSizeUnitSingularLabel")}
                  placeholder={t("productCreate.servingSizeUnitSingularPlaceholder")}
                />
                <TextField
                  variant="standard"
                  className="flex-1"
                  value={form.servingSizeUnitPlural}
                  onChange={(event) => update("servingSizeUnitPlural", event.target.value)}
                  label={t("productCreate.servingSizeUnitPluralLabel")}
                  placeholder={t("productCreate.servingSizeUnitPluralPlaceholder")}
                />
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="hf-type-label">{t("productCreate.ingredientsLabel")}</span>
              <textarea
                value={form.ingredientsText}
                onChange={(event) => update("ingredientsText", event.target.value)}
                rows={3}
                className="hf-type-input w-full rounded-[8px] border bg-hf-cream px-4 py-3 outline-none"
                style={{ borderColor: "var(--hf-color-field-border)" }}
              />
            </label>
          </div>

          {saveError && <p className="hf-type-caption text-center">{saveError}</p>}

          <button type="submit" disabled={saving} className="hf-btn-primary h-12 disabled:opacity-40">
            <span className="hf-type-button">{saving ? t("productCreate.saving") : t("productCreate.createProduct")}</span>
          </button>
        </form>
      </div>
    </HfScreen>
  );
}

export default function OpretProduktPage() {
  return (
    <Suspense fallback={null}>
      <OpretProduktContent />
    </Suspense>
  );
}
