"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { useScanPosition } from "@/components/scan/ScanLocation";
import { TextField } from "@/components/hf/TextField";
import { ActionButton } from "@/components/hf/ActionButton";
import { CreateProductMediaGrid, type MediaGridValue } from "@/components/hf/CreateProductMediaGrid";
import type { ParsedNutrition } from "@/lib/product-ocr";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Opret vare" i Oprettelses-appen (docs/OPRETTELSES-APP.md): de samme fire
// bokse (produktbillede, stregkode, energi, indhold) og felter som Hello Cals
// opret-produkt-side, sort "Opret"-knap nederst. Kommer medarbejderen fra en
// vare på hyldebilledet (?item=…), knyttes den oprettede vare til den, så
// overlayet straks viser grønt flueben.

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
  ingredientsText: string;
};

const EMPTY_FORM: FormValues = {
  brand: "",
  subbrand: "",
  name: "",
  variant: "",
  packageSizeText: "",
  kcalPer100g: "",
  proteinPer100g: "",
  carbsPer100g: "",
  fatPer100g: "",
  ingredientsText: "",
};

const EMPTY_MEDIA: MediaGridValue = { barcodeValue: "", sideImages: [undefined, undefined, undefined] };

function OpretContent() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const itemId = useSearchParams().get("item");
  const position = useScanPosition();
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [media, setMedia] = useState<MediaGridValue>(EMPTY_MEDIA);
  const [frontAnalysisId, setFrontAnalysisId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ kind: string; payable: boolean } | null>(null);
  // Tidspunktet for det første foto i denne oprettelse (≠ oprettelsestidspunktet).
  const firstPhotoAt = useRef<string | null>(null);
  const analyzedFront = useRef<string | null>(null);

  function update(key: keyof FormValues, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleMedia(next: MediaGridValue) {
    if (!firstPhotoAt.current && (next.mainImage || next.barcodeImage || next.nutritionImage || next.ingredientsImage)) {
      firstPhotoAt.current = new Date().toISOString();
    }
    setMedia(next);
  }

  // Forsidefotoet læses af den samme AI-forsideanalyse som Hello Cals guidede
  // flow (kræver stregkoden først, docs/DECISIONS.md 2026-09-17).
  useEffect(() => {
    const photo = media.mainImage;
    const barcode = media.barcodeValue.replace(/\D/g, "");
    if (!photo || !barcode || analyzedFront.current === photo) return;
    analyzedFront.current = photo;
    fetch("/api/ai/analyze-product-front", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo, barcode, marketRegion: "DK" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { analysisId: string | null; result: ProductFrontAnalysis | null } | null) => {
        if (!data) return;
        if (data.analysisId) setFrontAnalysisId(data.analysisId);
        const result = data.result;
        if (!result) return;
        setForm((prev) => ({
          ...prev,
          brand: prev.brand || result.brand || "",
          subbrand: prev.subbrand || result.subbrand || "",
          name: prev.name || result.productName || "",
          variant: prev.variant || result.variant || "",
          packageSizeText: prev.packageSizeText || result.packageSizeText || "",
        }));
      })
      .catch(() => {});
  }, [media.mainImage, media.barcodeValue]);

  function applyNutrition(values: ParsedNutrition) {
    setForm((prev) => ({
      ...prev,
      kcalPer100g: String(values.kcalPer100g),
      proteinPer100g: String(values.proteinPer100g),
      carbsPer100g: String(values.carbsPer100g),
      fatPer100g: String(values.fatPer100g),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!position) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/scan/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: form.brand || undefined,
          subbrand: form.subbrand || undefined,
          name: form.name,
          variant: form.variant || undefined,
          packageSizeText: form.packageSizeText || undefined,
          kcalPer100g: form.kcalPer100g,
          proteinPer100g: form.proteinPer100g,
          carbsPer100g: form.carbsPer100g,
          fatPer100g: form.fatPer100g,
          ingredientsText: form.ingredientsText || undefined,
          barcode: media.barcodeValue || undefined,
          imageUrl: media.mainImage,
          extraImages: media.sideImages.filter((image): image is string => Boolean(image)),
          analysisIds: frontAnalysisId ? { front: frontAnalysisId } : {},
          marketRegion: "DK",
          hasNutritionPhoto: Boolean(media.nutritionImage),
          shelfPhotoItemId: itemId ?? undefined,
          ...position,
          capturedAt: firstPhotoAt.current ?? new Date().toISOString(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; kind?: string; payable?: boolean };
      if (!response.ok) {
        setError(data.message ?? "Varen kunne ikke oprettes");
        return;
      }
      setDone({ kind: data.kind ?? "NEW_PRODUCT", payable: data.payable ?? true });
    } catch {
      setError("Ingen forbindelse — prøv igen");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="hf-type-body-sm rounded-[8px] p-4 text-center" style={{ background: "var(--hf-color-brand)", color: "var(--hf-color-white)" }}>
          {done.kind === "SUPPLEMENT" ? "Varen fandtes allerede og er nu suppleret." : "Varen er oprettet og kan ses i Hello Cal."}
          {!done.payable && " Du oprettede selv varen tidligere, så suppleringen tæller ikke med i afregningen."}
        </div>
        <ActionButton className="h-12" onClick={() => router.push("/scan")}>
          <span className="hf-type-button">Tilbage til hylden</span>
        </ActionButton>
        <ActionButton
          variant="secondary"
          className="h-12"
          onClick={() => {
            setDone(null);
            setForm(EMPTY_FORM);
            setMedia(EMPTY_MEDIA);
            setFrontAnalysisId(null);
            firstPhotoAt.current = null;
            router.replace("/scan/opret");
          }}
        >
          <span className="hf-type-button">Opret endnu en vare</span>
        </ActionButton>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <CreateProductMediaGrid
        value={media}
        onChange={handleMedia}
        region="DK"
        uiLang={locale}
        onNutritionExtracted={applyNutrition}
        onIngredientsExtracted={(text) => update("ingredientsText", text)}
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
        <TextField variant="standard" value={form.brand} onChange={(e) => update("brand", e.target.value)} label={t("productCreate.brandLabel")} autoComplete="off" />
        <TextField variant="standard" value={form.subbrand} onChange={(e) => update("subbrand", e.target.value)} label={t("productCreate.subbrandLabel")} autoComplete="off" />
        <TextField variant="standard" value={form.name} onChange={(e) => update("name", e.target.value)} label={t("productCreate.productNameLabel")} autoComplete="off" required />
        <TextField variant="standard" value={form.variant} onChange={(e) => update("variant", e.target.value)} label={t("productCreate.variantLabel")} autoComplete="off" />
        <TextField variant="standard" value={form.packageSizeText} onChange={(e) => update("packageSizeText", e.target.value)} label={t("productCreate.packageSizeLabel")} autoComplete="off" />
        <div className="flex gap-3">
          <TextField variant="standard" className="flex-1" value={form.kcalPer100g} onChange={(e) => update("kcalPer100g", e.target.value)} inputMode="decimal" label={t("productCreate.caloriesLabel")} required />
          <TextField variant="standard" className="flex-1" value={form.proteinPer100g} onChange={(e) => update("proteinPer100g", e.target.value)} inputMode="decimal" label={t("productCreate.proteinLabel")} required />
        </div>
        <div className="flex gap-3">
          <TextField variant="standard" className="flex-1" value={form.carbsPer100g} onChange={(e) => update("carbsPer100g", e.target.value)} inputMode="decimal" label={t("productCreate.carbsLabel")} required />
          <TextField variant="standard" className="flex-1" value={form.fatPer100g} onChange={(e) => update("fatPer100g", e.target.value)} inputMode="decimal" label={t("productCreate.fatLabel")} required />
        </div>
        <label className="flex flex-col gap-1">
          <span className="hf-type-label">{t("productCreate.ingredientsLabel")}</span>
          <textarea
            value={form.ingredientsText}
            onChange={(e) => update("ingredientsText", e.target.value)}
            rows={3}
            className="hf-type-input w-full rounded-[8px] border bg-hf-cream px-4 py-3 outline-none"
            style={{ borderColor: "var(--hf-color-field-border)" }}
          />
        </label>
      </div>

      {error && <p className="hf-type-caption text-center">{error}</p>}

      <ActionButton type="submit" disabled={saving || !position} className="h-12 disabled:opacity-40">
        <span className="hf-type-button">{saving ? "Opretter…" : "Opret"}</span>
      </ActionButton>
    </form>
  );
}

export default function ScanOpretPage() {
  return (
    <ScanScreen title="Opret vare">
      <Suspense fallback={null}>
        <OpretContent />
      </Suspense>
    </ScanScreen>
  );
}
