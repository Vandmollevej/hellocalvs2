"use client";

import { IngredientsText } from "@/components/hf/IngredientsText";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NUTRIENTS, NUTRIENT_BY_KEY, isNutrientKey, type NutrientKey } from "@/lib/nutrients";
import { PRODUCT_CATEGORY_LABELS, isProductCategory } from "@/lib/product-display-unit";
import { UNCERTAINTY_TARGET, URGENT_BELOW } from "@/lib/uncertainty-thresholds";

export type PendingProduct = {
  id: string;
  name: string;
  productType: string | null;
  subbrand: string | null;
  variant: string | null;
  brand: { name: string; logoUrl: string | null } | null;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  externalSource: string | null;
  createdAtLabel: string;
  // 0–100, null = ingen AI-/billedmålinger (src/lib/pending-product-confidence.ts).
  confidencePercent: number | null;
  packageSizeText: string | null;
  productCategory: string | null;
  categoryName: string | null;
  barcodes: string[];
  servingSizeGrams: number | null;
  servingSizeUnitSingular: string | null;
  ingredientsText: string | null;
  allergens: string[];
  additives: string[];
  createdBy: string | null;
  // Udvidet næring pr. 100 g fra produktets egne kolonner + nutritionFeatures.
  extended: Partial<Record<NutrientKey, number | null>>;
  micronutrients: Record<string, number>;
  dietaryTags: string[];
};

const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  saturatedFat: "Mættet fedt",
  unsaturatedFat: "Umættet fedt",
  transFat: "Transfedt",
  cholesterol: "Kolesterol",
  sugar: "Sukkerarter",
  fiber: "Kostfibre",
  salt: "Salt",
  sodium: "Natrium",
  potassium: "Kalium",
  calcium: "Calcium",
  magnesium: "Magnesium",
  iron: "Jern",
  zinc: "Zink",
  copper: "Kobber",
  manganese: "Mangan",
  selenium: "Selen",
  phosphorus: "Fosfor",
  iodine: "Jod",
  vitaminA: "Vitamin A",
  vitaminC: "Vitamin C",
  vitaminD: "Vitamin D",
  vitaminE: "Vitamin E",
  vitaminK: "Vitamin K",
  vitaminB1: "Vitamin B1 (thiamin)",
  vitaminB2: "Vitamin B2 (riboflavin)",
  vitaminB3: "Vitamin B3 (niacin)",
  vitaminB5: "Vitamin B5 (pantotensyre)",
  vitaminB6: "Vitamin B6",
  vitaminB7: "Vitamin B7 (biotin)",
  vitaminB9: "Vitamin B9 (folat)",
  vitaminB12: "Vitamin B12",
};

const SOURCE_LABEL: Record<string, string> = {
  OPEN_FOOD_FACTS: "Open Food Facts",
  USDA: "USDA",
  FRIDA: "Frida (DTU)",
  HELLOFRESH: "HelloFresh",
  REMA1000: "REMA 1000",
  BILKA: "Bilka",
};

const number = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

// Energifordelingen regnes med de gængse faktorer (4/4/9 kcal pr. g).
function energySplit(protein: number, carbs: number, fat: number) {
  const parts = [
    { key: "protein", label: "Protein", kcal: protein * 4, className: "bg-hf-green-dark" },
    { key: "carbs", label: "Kulhydrat", kcal: carbs * 4, className: "bg-hf-green" },
    { key: "fat", label: "Fedt", kcal: fat * 9, className: "bg-hf-tan-dark" },
  ];
  const total = parts.reduce((sum, p) => sum + p.kcal, 0);
  return {
    total,
    parts: parts.map((p) => ({ ...p, percent: total > 0 ? (p.kcal / total) * 100 : 0 })),
  };
}

function confidenceClass(percent: number | null): string {
  if (percent === null) return "text-text-muted";
  if (percent < URGENT_BELOW * 100) return "text-hf-red-dark";
  if (percent < UNCERTAINTY_TARGET * 100) return "text-hf-warning";
  return "text-hf-green-dark";
}

export function PendingProductCard({ product }: { product: PendingProduct }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: product.name,
    productType: product.productType ?? "",
    brand: product.brand?.name ?? "",
    subbrand: product.subbrand ?? "",
    variant: product.variant ?? "",
    kcalPer100g: String(product.kcalPer100g),
    proteinPer100g: String(product.proteinPer100g),
    carbsPer100g: String(product.carbsPer100g),
    fatPer100g: String(product.fatPer100g),
  });

  async function act(action: "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/${action}`, { method: "POST" });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Kunne ikke gemme");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setSaving(false);
    }
  }

  if (done) return null;

  const set = (key: keyof typeof form) => (value: string) => {
    setSaved(false);
    setForm({ ...form, [key]: value });
  };
  const split = energySplit(
    parseFloat(form.proteinPer100g) || 0,
    parseFloat(form.carbsPer100g) || 0,
    parseFloat(form.fatPer100g) || 0,
  );
  const extendedRows = NUTRIENTS.filter((n) => product.extended[n.key] != null).map((n) => ({
    key: n.key,
    value: product.extended[n.key] as number,
  }));
  const extendedKeys = new Set(extendedRows.map((r) => r.key));
  const microRows = Object.entries(product.micronutrients)
    .filter(([key]) => isNutrientKey(key) && !extendedKeys.has(key))
    .map(([key, value]) => ({ key: key as NutrientKey, value }));
  const nutrientRows = [...extendedRows, ...microRows];

  return (
    <div className="hf-surface">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <a
          href={`/admin/products/${product.id}`}
          title="Åbn fuld varevisning"
          className="flex min-w-0 flex-1 items-center gap-4 rounded-md hover:opacity-80"
        >
        <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-hf-tan">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="hf-type-small text-text-muted">Intet billede</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="hf-type-strong truncate text-hf-black">{product.name}</p>
          <p className="hf-type-small truncate text-text-secondary">
            {[
              product.brand?.name,
              product.externalSource ? SOURCE_LABEL[product.externalSource] ?? product.externalSource : null,
              `${Math.round(product.kcalPer100g)} kcal / 100 g`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="hf-type-small whitespace-nowrap text-text-muted">
            Protein {product.proteinPer100g} g · Kulhydrat {product.carbsPer100g} g · Fedt {product.fatPer100g} g
          </p>
        </div>
        </a>
        <div className="flex flex-shrink-0 items-center gap-3 self-end sm:self-center">
          {/* Uden AI-/billedmålinger findes der ingen sikkerhed at vise, så
              feltet skjules helt i stedet for en meningsløs streg (opgave 43). */}
          {product.confidencePercent !== null && (
            <div
              className="flex min-w-[4.5rem] flex-col items-end whitespace-nowrap"
              title="Laveste AI-/billedsikkerhed for varen"
            >
              <span
                className={`hf-type-page-title leading-none tabular-nums ${confidenceClass(
                  product.confidencePercent,
                )}`}
              >
                {product.confidencePercent}%
              </span>
              <span className="hf-type-micro hf-type-strong mt-1 uppercase tracking-wide leading-none text-text-muted">
                Sikkerhed
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Skjul detaljer" : "Vis alle detaljer"}
            aria-expanded={expanded}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-text-muted"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="block"
              style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform .15s" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          <span className="hf-type-small text-text-muted">Oprettet: {product.createdAtLabel}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => act("reject")}
              disabled={loading !== null}
              className="hf-type-body rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-red-dark disabled:opacity-60"
            >
              {loading === "reject" ? "…" : "Afvis"}
            </button>
            <button
              type="button"
              onClick={() => act("approve")}
              disabled={loading !== null}
              className="hf-type-body rounded-md bg-hf-green-dark px-3 py-1.5 text-hf-white disabled:opacity-60"
            >
              {loading === "approve" ? "…" : "Godkend"}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-hf-tan-dark">
          <Section
            title="Vare"
            action={
              <a href={`/admin/products/${product.id}`} className="hf-type-small text-hf-green-dark underline">
                Åbn vareside (merge m.m.)
              </a>
            }
          >
            <div className="flex gap-4">
              <div className="flex h-20 w-28 flex-shrink-0 items-center justify-center overflow-hidden hf-surface p-2">
                {product.brand?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.brand.logoUrl} alt={product.brand.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="hf-type-small text-center text-text-muted">Intet logo</span>
                )}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-4 lg:grid-cols-4">
                <Field label="Varetype" value={form.productType} onChange={set("productType")} />
                <Field label="Brand" value={form.brand} onChange={set("brand")} />
                <Field label="Subbrand" value={form.subbrand} onChange={set("subbrand")} />
                <Field label="Variant" value={form.variant} onChange={set("variant")} />
              </div>
            </div>
          </Section>

          <Section title="Energifordeling (pr. 100 g)">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Field label="Kcal / 100 g" type="number" value={form.kcalPer100g} onChange={set("kcalPer100g")} />
              <Field label="Protein (g)" type="number" value={form.proteinPer100g} onChange={set("proteinPer100g")} />
              <Field label="Kulhydrat (g)" type="number" value={form.carbsPer100g} onChange={set("carbsPer100g")} />
              <Field label="Fedt (g)" type="number" value={form.fatPer100g} onChange={set("fatPer100g")} />
            </div>
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-hf-tan">
              {split.parts.map((p) => (
                <div key={p.key} className={p.className} style={{ width: `${p.percent}%` }} />
              ))}
            </div>
            <div className="hf-type-small mt-2 flex flex-wrap gap-x-6 gap-y-1 text-text-secondary">
              {split.parts.map((p) => (
                <span key={p.key} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${p.className}`} />
                  {p.label} {Math.round(p.percent)} % ({Math.round(p.kcal)} kcal)
                </span>
              ))}
              <span className="text-text-muted">
                I alt beregnet {Math.round(split.total)} kcal · angivet {Math.round(parseFloat(form.kcalPer100g) || 0)} kcal
              </span>
            </div>
          </Section>

          <Section title="Varedetaljer">
            <div className="mb-4 max-w-xl">
              <Field label="Navn" value={form.name} onChange={set("name")} />
            </div>
            <dl className="hf-type-body grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              <Detail label="EAN" value={product.barcodes.join(", ")} />
              <Detail label="Pakningsstørrelse" value={product.packageSizeText} />
              <Detail
                label="Varekategori"
                value={isProductCategory(product.productCategory) ? PRODUCT_CATEGORY_LABELS[product.productCategory] : null}
              />
              <Detail label="Kategori" value={product.categoryName} />
              <Detail
                label="Portion"
                value={
                  product.servingSizeGrams
                    ? `${number.format(product.servingSizeGrams)} g${product.servingSizeUnitSingular ? ` (1 ${product.servingSizeUnitSingular})` : ""}`
                    : null
                }
              />
              <Detail
                label="Kilde"
                value={product.externalSource ? SOURCE_LABEL[product.externalSource] ?? product.externalSource : "Bruger-indsendt"}
              />
              <Detail label="Indsendt af" value={product.createdBy} />
              <Detail label="Mærkninger" value={product.dietaryTags.join(", ")} />
              <Detail label="Allergener" value={product.allergens.join(", ")} />
              <Detail label="Tilsætningsstoffer" value={product.additives.join(", ")} />
            </dl>
            <div className="hf-type-body mt-4">
              <p className="hf-type-small text-text-secondary">Ingredienser</p>
              <p className="mt-1 whitespace-pre-line text-hf-black">{product.ingredientsText ? <IngredientsText text={product.ingredientsText} /> : "—"}</p>
            </div>
            <div className="mt-4">
              <p className="hf-type-small text-text-secondary">Øvrig næring pr. 100 g</p>
              {nutrientRows.length === 0 ? (
                <p className="hf-type-body mt-1 text-hf-black">—</p>
              ) : (
                <dl className="hf-type-body mt-1 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {nutrientRows.map((row) => (
                    <div key={row.key} className="flex justify-between gap-4 border-b border-border-strong/40 py-1">
                      <dt className="text-text-secondary">{NUTRIENT_LABEL[row.key]}</dt>
                      <dd className="text-hf-black">
                        {number.format(row.value)} {NUTRIENT_BY_KEY[row.key].unit}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </Section>

          <div className="flex items-center gap-3 border-t border-hf-tan-dark p-4">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="hf-type-body rounded-md bg-hf-green-dark px-4 py-1.5 text-hf-white disabled:opacity-60"
            >
              {saving ? "Gemmer…" : "Gem ændringer"}
            </button>
            {saved && <span className="hf-type-body text-hf-green-dark">Gemt ✓</span>}
            {error && <span className="hf-type-body text-hf-red-dark">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-hf-tan-dark p-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="hf-type-body hf-type-strong text-hf-black">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="hf-type-body hf-field rounded-md border border-hf-tan-dark px-2"
      />
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-strong/40 py-1">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right text-hf-black">{value || "—"}</dd>
    </div>
  );
}
