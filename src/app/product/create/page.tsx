"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconApple } from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { TextField } from "@/components/hf/TextField";
import { CreateProductMediaGrid, type MediaGridValue } from "@/components/hf/CreateProductMediaGrid";
import { PRODUCT_DRAFT_STORAGE_KEY, type ProductCreateDraft } from "@/lib/product-draft";

type FormValues = {
  name: string;
  kcalPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
  servingSizeGrams: string;
  ingredientsText: string;
};

const EMPTY_VALUES: FormValues = {
  name: "",
  kcalPer100g: "",
  proteinPer100g: "",
  carbsPer100g: "",
  fatPer100g: "",
  servingSizeGrams: "",
  ingredientsText: "",
};

function readDraft(): { form: FormValues; media: MediaGridValue; fromCamera: boolean } {
  const empty = { form: EMPTY_VALUES, media: { barcodeValue: "", sideImages: [undefined, undefined, undefined] as [string?, string?, string?] }, fromCamera: false };
  if (typeof window === "undefined") return empty;
  const raw = sessionStorage.getItem(PRODUCT_DRAFT_STORAGE_KEY);
  if (!raw) return empty;
  sessionStorage.removeItem(PRODUCT_DRAFT_STORAGE_KEY);
  try {
    const draft = JSON.parse(raw) as ProductCreateDraft;
    return {
      form: {
        name: draft.name ?? "",
        kcalPer100g: draft.kcalPer100g ?? "",
        proteinPer100g: draft.proteinPer100g ?? "",
        carbsPer100g: draft.carbsPer100g ?? "",
        fatPer100g: draft.fatPer100g ?? "",
        servingSizeGrams: draft.servingSizeGrams ?? "",
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
      fromCamera: true,
    };
  } catch {
    return empty;
  }
}

function OpretProduktContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromFailedAdd = searchParams.get("fromFailedAdd") === "1";
  const [{ form: initialForm, media: initialMedia }] = useState(readDraft);
  const [form, setForm] = useState<FormValues>(initialForm);
  const [media, setMedia] = useState<MediaGridValue>(initialMedia);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function update(key: keyof FormValues, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          name: form.name,
          kcalPer100g: form.kcalPer100g,
          proteinPer100g: form.proteinPer100g,
          carbsPer100g: form.carbsPer100g,
          fatPer100g: form.fatPer100g,
          servingSizeGrams: form.servingSizeGrams || undefined,
          ingredientsText: form.ingredientsText || undefined,
          barcode: media.barcodeValue || undefined,
          imageUrl: media.mainImage,
          extraImages: [media.sideImages[0], media.sideImages[1], media.sideImages[2]].filter(
            (img): img is string => Boolean(img)
          ),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.message ?? "Kunne ikke gemme produktet");
        return;
      }
      router.push(`/tilfoej/${data.product.id}`);
    } catch {
      setSaveError("Kunne ikke gemme produktet");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Opret produkt" icon={<IconApple size={20} stroke={2} />} onBack={() => router.back()} />
      <div className="flex flex-col gap-4 p-4">
        {fromFailedAdd && (
          <div
            className="hf-type-body-sm rounded-[8px] p-4 text-center"
            style={{ background: "var(--hf-color-brand)", color: "var(--hf-color-white)" }}
          >
            Produktet er endnu ikke registreret. Vi har gjort det nemt for dig selv at oprette produktet nedenfor.
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
              Opret produktet og optjen 10 points.*
            </div>
            <p
              className="hf-type-caption mt-1 text-center"
              style={{ color: "var(--hf-color-text-secondary)" }}
            >
              *
              <Link href="/betingelser#pointsystem" className="underline">
                Læs betingelser
              </Link>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CreateProductMediaGrid value={media} onChange={setMedia} />

          <TextField
            variant="standard"
            value={media.barcodeValue}
            onChange={(event) => setMedia((prev) => ({ ...prev, barcodeValue: event.target.value }))}
            inputMode="numeric"
            label="Stregkode (valgfri)"
            placeholder="fx 5701234567890"
          />

          <div className="flex flex-col gap-3 rounded-[8px] p-4" style={{ background: "var(--hf-color-card)" }}>
            <TextField
              variant="standard"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              autoComplete="off"
              label="Produktnavn"
              placeholder="Produktnavn"
              required
            />
            <div className="flex gap-3">
              <TextField
                variant="standard"
                className="flex-1"
                value={form.kcalPer100g}
                onChange={(event) => update("kcalPer100g", event.target.value)}
                inputMode="decimal"
                label="Kalorier (kcal/100g)"
                required
              />
              <TextField
                variant="standard"
                className="flex-1"
                value={form.proteinPer100g}
                onChange={(event) => update("proteinPer100g", event.target.value)}
                inputMode="decimal"
                label="Protein (g/100g)"
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
                label="Kulhydrat (g/100g)"
                required
              />
              <TextField
                variant="standard"
                className="flex-1"
                value={form.fatPer100g}
                onChange={(event) => update("fatPer100g", event.target.value)}
                inputMode="decimal"
                label="Fedt (g/100g)"
                required
              />
            </div>
            <TextField
              variant="standard"
              value={form.servingSizeGrams}
              onChange={(event) => update("servingSizeGrams", event.target.value)}
              inputMode="decimal"
              label="Portionsstørrelse (g, valgfri)"
            />
            <label className="flex flex-col gap-1">
              <span className="hf-type-label">Indholdsfortegnelse (valgfri)</span>
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
            <span className="hf-type-button">{saving ? "Gemmer..." : "Opret vare"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OpretProduktPage() {
  return (
    <Suspense fallback={null}>
      <OpretProduktContent />
    </Suspense>
  );
}
