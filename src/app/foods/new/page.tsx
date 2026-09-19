"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { IconApple, IconCarrot } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

export const OCR_DRAFT_STORAGE_KEY = "hellocal-ocr-product-draft";

export type ProductDraft = {
  name?: string;
  kcalPer100g?: string;
  proteinPer100g?: string;
  carbsPer100g?: string;
  fatPer100g?: string;
};

type FormValues = Required<ProductDraft> & { brand: string; subbrand: string };

const EMPTY_VALUES: FormValues = {
  name: "",
  kcalPer100g: "",
  proteinPer100g: "",
  carbsPer100g: "",
  fatPer100g: "",
  brand: "",
  subbrand: "",
};

const numberInputClass =
  "min-w-0 flex-1 rounded-full bg-hf-white px-3.5 py-2 text-sm text-hf-black outline-none";

function readOcrDraft(): { values: FormValues; fromOcr: boolean } {
  if (typeof window === "undefined") return { values: EMPTY_VALUES, fromOcr: false };
  const raw = sessionStorage.getItem(OCR_DRAFT_STORAGE_KEY);
  if (!raw) return { values: EMPTY_VALUES, fromOcr: false };
  sessionStorage.removeItem(OCR_DRAFT_STORAGE_KEY);
  try {
    const draft = JSON.parse(raw) as ProductDraft;
    return { values: { ...EMPTY_VALUES, ...draft }, fromOcr: true };
  } catch {
    return { values: EMPTY_VALUES, fromOcr: false };
  }
}

type IngredientCategory = "FRUIT" | "VEGETABLE" | "MEAT" | "OTHER";

function NytProduktContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forDish = searchParams.get("for") === "ret";
  // Øverst under "manuelt tilføjet" skal brugeren først vælge om det er en
  // generisk ingrediens (grønt/frugt/kød uden brand/emballage, egen
  // GenericIngredient-tabel) eller et almindeligt emballeret produkt — se
  // docs/DECISIONS.md 2026-09-19.
  const [kind, setKind] = useState<"ingredient" | "product" | null>(null);

  const [{ values: initialValues, fromOcr }] = useState(readOcrDraft);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [ingredientName, setIngredientName] = useState("");
  const [ingredientCategory, setIngredientCategory] = useState<IngredientCategory>("OTHER");
  const [ingredientSaving, setIngredientSaving] = useState(false);
  const [ingredientSaveError, setIngredientSaveError] = useState<string | null>(null);

  function update(key: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value.replace(",", ".") }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          brand: values.brand || undefined,
          subbrand: values.subbrand || undefined,
          kcalPer100g: values.kcalPer100g,
          proteinPer100g: values.proteinPer100g,
          carbsPer100g: values.carbsPer100g,
          fatPer100g: values.fatPer100g,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.message ?? t("foods.saveError"));
        return;
      }
      router.push(`/add/${data.product.id}${forDish ? "?for=ret" : ""}`);
    } catch {
      setSaveError(t("foods.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitIngredient(event: React.FormEvent) {
    event.preventDefault();
    setIngredientSaving(true);
    setIngredientSaveError(null);
    try {
      const res = await fetch("/api/generic-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ingredientName, category: ingredientCategory }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIngredientSaveError(data.message ?? t("foods.ingredientSaveError"));
        return;
      }
      router.push(`/add/${data.ingredient.id}${forDish ? "?for=ret" : ""}`);
    } catch {
      setIngredientSaveError(t("foods.ingredientSaveError"));
    } finally {
      setIngredientSaving(false);
    }
  }

  return (
    <HfScreen title={t("foods.newProductTitle")} icon={<IconApple size={20} stroke={2} />}>
      <div className="flex flex-col gap-3 p-4">
        {kind === null && (
          <div className="flex flex-col gap-2">
            <p className="px-1 text-sm font-medium text-hf-black">{t("foods.manualKindTitle")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind("ingredient")}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan p-4 text-center"
              >
                <IconCarrot size={22} color="var(--hf-black)" />
                <span className="text-sm font-semibold text-hf-black">{t("foods.manualKindIngredient")}</span>
                <span className="text-xs text-hf-black opacity-60">{t("foods.manualKindIngredientHint")}</span>
              </button>
              <button
                type="button"
                onClick={() => setKind("product")}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-hf-tan p-4 text-center"
              >
                <IconApple size={22} color="var(--hf-black)" />
                <span className="text-sm font-semibold text-hf-black">{t("foods.manualKindProduct")}</span>
                <span className="text-xs text-hf-black opacity-60">{t("foods.manualKindProductHint")}</span>
              </button>
            </div>
          </div>
        )}

        {kind === "ingredient" && (
          <form onSubmit={handleSubmitIngredient} className="flex flex-col gap-2 rounded-2xl bg-hf-tan p-4">
            <input
              value={ingredientName}
              onChange={(event) => setIngredientName(event.target.value)}
              autoComplete="off"
              aria-label={t("foods.ingredientNameLabel")}
              placeholder={t("foods.ingredientNamePlaceholder")}
              className={numberInputClass}
              required
            />
            <label className="text-xs text-hf-black opacity-70">
              {t("foods.ingredientCategoryLabel")}
              <select
                value={ingredientCategory}
                onChange={(event) => setIngredientCategory(event.target.value as IngredientCategory)}
                className={`${numberInputClass} mt-1 w-full`}
              >
                <option value="FRUIT">{t("foods.categoryFruit")}</option>
                <option value="VEGETABLE">{t("foods.categoryVegetable")}</option>
                <option value="MEAT">{t("foods.categoryMeat")}</option>
                <option value="OTHER">{t("foods.categoryOther")}</option>
              </select>
            </label>
            <p className="px-1 text-xs text-hf-black opacity-60">{t("foods.ingredientNutritionHint")}</p>

            {ingredientSaveError && (
              <p className="text-center text-xs text-hf-black opacity-70">{ingredientSaveError}</p>
            )}

            <button
              type="submit"
              disabled={ingredientSaving}
              className="hf-btn-primary mt-1 py-2.5 text-xs disabled:opacity-40"
            >
              {ingredientSaving ? t("foods.saving") : t("foods.createIngredient")}
            </button>
          </form>
        )}

        {kind === "product" && (
          <>
            {fromOcr && (
              <p className="px-1 text-xs text-hf-black opacity-70">
                {t("foods.ocrHint")}
              </p>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-2xl bg-hf-tan p-4">
              <input
                value={values.brand}
                onChange={(event) => update("brand", event.target.value)}
                autoComplete="off"
                aria-label={t("foods.brandLabel")}
                placeholder={t("foods.brandLabel")}
                className={numberInputClass}
              />
              <input
                value={values.subbrand}
                onChange={(event) => update("subbrand", event.target.value)}
                autoComplete="off"
                aria-label={t("foods.subbrandLabel")}
                placeholder={t("foods.subbrandLabel")}
                className={numberInputClass}
              />
              <input
                value={values.name}
                onChange={(event) => update("name", event.target.value)}
                autoComplete="off"
                aria-label={t("foods.productNameLabel")}
                placeholder={t("foods.productNameLabel")}
                className={numberInputClass}
                required
              />
              <div className="flex gap-2">
                <label className="flex-1 text-xs text-hf-black opacity-70">
                  {t("foods.caloriesLabel")}
                  <input
                    value={values.kcalPer100g}
                    onChange={(event) => update("kcalPer100g", event.target.value)}
                    inputMode="decimal"
                    aria-label={t("foods.caloriesAriaLabel")}
                    className={`${numberInputClass} mt-1 w-full`}
                    required
                  />
                </label>
                <label className="flex-1 text-xs text-hf-black opacity-70">
                  {t("foods.proteinLabel")}
                  <input
                    value={values.proteinPer100g}
                    onChange={(event) => update("proteinPer100g", event.target.value)}
                    inputMode="decimal"
                    aria-label={t("foods.proteinAriaLabel")}
                    className={`${numberInputClass} mt-1 w-full`}
                    required
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 text-xs text-hf-black opacity-70">
                  {t("foods.carbsLabel")}
                  <input
                    value={values.carbsPer100g}
                    onChange={(event) => update("carbsPer100g", event.target.value)}
                    inputMode="decimal"
                    aria-label={t("foods.carbsAriaLabel")}
                    className={`${numberInputClass} mt-1 w-full`}
                    required
                  />
                </label>
                <label className="flex-1 text-xs text-hf-black opacity-70">
                  {t("foods.fatLabel")}
                  <input
                    value={values.fatPer100g}
                    onChange={(event) => update("fatPer100g", event.target.value)}
                    inputMode="decimal"
                    aria-label={t("foods.fatAriaLabel")}
                    className={`${numberInputClass} mt-1 w-full`}
                    required
                  />
                </label>
              </div>

              {saveError && <p className="text-center text-xs text-hf-black opacity-70">{saveError}</p>}

              <button
                type="submit"
                disabled={saving}
                className="hf-btn-primary mt-1 py-2.5 text-xs disabled:opacity-40"
              >
                {saving ? t("foods.saving") : t("foods.createProduct")}
              </button>
            </form>
          </>
        )}
      </div>
    </HfScreen>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={null}>
      <NytProduktContent />
    </Suspense>
  );
}
