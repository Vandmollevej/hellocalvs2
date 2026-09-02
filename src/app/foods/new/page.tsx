"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { IconApple } from "@tabler/icons-react";

export const OCR_DRAFT_STORAGE_KEY = "hellocal-ocr-product-draft";

export type ProductDraft = {
  name?: string;
  kcalPer100g?: string;
  proteinPer100g?: string;
  carbsPer100g?: string;
  fatPer100g?: string;
};

type FormValues = Required<ProductDraft>;

const EMPTY_VALUES: FormValues = {
  name: "",
  kcalPer100g: "",
  proteinPer100g: "",
  carbsPer100g: "",
  fatPer100g: "",
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

function NytProduktContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forDish = searchParams.get("for") === "ret";
  const [{ values: initialValues, fromOcr }] = useState(readOcrDraft);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.message ?? "Kunne ikke gemme produktet");
        return;
      }
      router.push(`/add/${data.product.id}${forDish ? "?for=ret" : ""}`);
    } catch {
      setSaveError("Kunne ikke gemme produktet");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen title="Nyt produkt" icon={<IconApple size={20} stroke={2} />}>
      <div className="flex flex-col gap-3 p-4">
        {fromOcr && (
          <p className="px-1 text-xs text-hf-black opacity-70">
            Værdierne herunder er læst automatisk fra dit billede — tjek og ret dem, hvis noget er forkert.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-2xl bg-hf-tan p-4">
          <input
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            autoComplete="off"
            aria-label="Produktnavn"
            placeholder="Produktnavn"
            className={numberInputClass}
            required
          />
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-hf-black opacity-70">
              Kalorier (kcal/100g)
              <input
                value={values.kcalPer100g}
                onChange={(event) => update("kcalPer100g", event.target.value)}
                inputMode="decimal"
                aria-label="Kalorier pr. 100 gram"
                className={`${numberInputClass} mt-1 w-full`}
                required
              />
            </label>
            <label className="flex-1 text-xs text-hf-black opacity-70">
              Protein (g/100g)
              <input
                value={values.proteinPer100g}
                onChange={(event) => update("proteinPer100g", event.target.value)}
                inputMode="decimal"
                aria-label="Protein pr. 100 gram"
                className={`${numberInputClass} mt-1 w-full`}
                required
              />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-hf-black opacity-70">
              Kulhydrat (g/100g)
              <input
                value={values.carbsPer100g}
                onChange={(event) => update("carbsPer100g", event.target.value)}
                inputMode="decimal"
                aria-label="Kulhydrat pr. 100 gram"
                className={`${numberInputClass} mt-1 w-full`}
                required
              />
            </label>
            <label className="flex-1 text-xs text-hf-black opacity-70">
              Fedt (g/100g)
              <input
                value={values.fatPer100g}
                onChange={(event) => update("fatPer100g", event.target.value)}
                inputMode="decimal"
                aria-label="Fedt pr. 100 gram"
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
            {saving ? "Gemmer..." : "Opret produkt"}
          </button>
        </form>
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
