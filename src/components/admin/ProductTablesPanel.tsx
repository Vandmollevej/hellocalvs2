import type { ProductFilters, ProductNutritionFeatures } from "@prisma/client";

// Admin-visning af produktets tre tabeller (docs/DECISIONS.md 2026-09-27
// "Butiksvarer i tre tabeller"): basisinfo, makro/mikro og filtre. Kun
// læsning — tomme felter vises som "—", så det er tydeligt hvad der mangler.

type Value = string | number | string[] | null | undefined;

export type ProductTablesBasics = {
  name: string;
  brand: string | null;
  subbrand: string | null;
  productType: string | null;
  variant: string | null;
  flavor: string | null;
  packageSizeText: string | null;
  packCount: number | null;
  productCategory: string | null;
  category: string | null;
  packaging: string | null;
  barcodes: string[];
  stores: string[];
  keywords: string[];
  externalSource: string | null;
  ingredientsText: string | null;
  allergens: string[];
  additives: string[];
};

export type ProductTablesMacros = {
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  saturatedFatPer100g: number | null;
  // Butiksvare uden kalorietal: 0 er en pladsholder (docs/DECISIONS.md 2026-10-02).
  nutritionMissing?: boolean;
};

const MISSING = "Mangler næring – vises i søgning, skjult i genkendelse";

// Uden kalorietal er en makro på 0 kun pladsholderen; et tal fra arket vises.
function placeholder(macros: ProductTablesMacros, value: number): Value {
  return macros.nutritionMissing && value === 0 ? MISSING : value;
}

const CATEGORY_LABELS: Record<string, string> = {
  DRINK: "Drikkevare (ml)",
  VEGETABLES: "Grøntsager (g)",
  GENERIC: "Generisk (g)",
  PROCESSED: "Forarbejdet (g)",
  RAW: "Råvare (g)",
  INGREDIENT: "Ingrediens (g)",
};

function show(value: Value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "number") return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(value);
  return value;
}

function Table({ title, rows }: { title: string; rows: [string, Value][] }) {
  return (
    <section className="hf-surface">
      <h2 className="hf-type-body hf-type-strong border-b border-hf-tan-dark px-4 py-2 text-hf-black">{title}</h2>
      <dl className="divide-y divide-border-strong">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4 px-4 py-2">
            <dt className="hf-type-small text-text-secondary">{label}</dt>
            <dd className={`hf-type-small break-words ${show(value) === "—" ? "text-text-muted" : "text-hf-black"}`}>{show(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ProductTablesPanel({
  basics,
  macros,
  nutrition,
  filters,
}: {
  basics: ProductTablesBasics;
  macros: ProductTablesMacros;
  nutrition: ProductNutritionFeatures | null;
  filters: ProductFilters | null;
}) {
  const unit = basics.productCategory === "DRINK" ? "100 ml" : "100 g";
  // Lukket dropdown "Indhold" (docs/DECISIONS.md 2026-10-07): de tre
  // tabeller fylder for meget til altid at stå åbne.
  return (
    <details className="hf-surface group">
      <summary className="hf-type-body hf-type-strong flex cursor-pointer list-none items-center justify-between px-4 py-3 text-hf-black">
        Indhold
        <span aria-hidden className="text-text-secondary transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="grid gap-4 border-t border-hf-tan-dark p-4 lg:grid-cols-3">
        <Table
          title="1 · Basisinfo"
          rows={[
            ["Navn", basics.name],
            ["Brand", basics.brand],
            ["Sub brand", basics.subbrand],
            ["Varetype", basics.productType],
            ["Variant", basics.variant],
            ["Smag", basics.flavor],
            ["Mængde", basics.packageSizeText],
            ["Antal i pakken", basics.packCount],
            ["Type", basics.productCategory ? CATEGORY_LABELS[basics.productCategory] ?? basics.productCategory : null],
            ["Kategori", basics.category],
            ["Emballage", basics.packaging],
            ["Stregkode", basics.barcodes],
            ["Kæder", basics.stores],
            ["Nøgleord", basics.keywords],
            ["Kilde", basics.externalSource],
            ["Allergener", basics.allergens],
            ["E-numre", basics.additives],
            ["Ingredienser", basics.ingredientsText],
          ]}
        />
        <Table
          title={`2 · Næring pr. ${unit}`}
          rows={[
            ["Energi (kJ)", nutrition?.energyKjPer100g],
            ["Energi (kcal)", macros.nutritionMissing ? MISSING : macros.kcalPer100g],
            ["Fedt (g)", placeholder(macros, macros.fatPer100g)],
            ["Mættet fedt (g)", macros.saturatedFatPer100g],
            ["Enkeltumættet fedt (g)", nutrition?.monounsaturatedFatPer100g],
            ["Flerumættet fedt (g)", nutrition?.polyunsaturatedFatPer100g],
            ["Kulhydrat (g)", placeholder(macros, macros.carbsPer100g)],
            ["Sukkerarter (g)", nutrition?.sugarsPer100g],
            ["Kostfibre (g)", nutrition?.fiberPer100g],
            ["Protein (g)", placeholder(macros, macros.proteinPer100g)],
            ["Salt (g)", nutrition?.saltPer100g],
            ["Natrium (g)", nutrition?.sodiumPer100g],
            ["Alkohol (g)", nutrition?.alcoholPer100g],
            ["B2-vitamin (mg)", nutrition?.vitaminB2MgPer100g],
            ["B12-vitamin (µg)", nutrition?.vitaminB12UgPer100g],
            ["Calcium (mg)", nutrition?.calciumMgPer100g],
            ["Fosfor (mg)", nutrition?.phosphorusMgPer100g],
          ]}
        />
        <Table
          title="3 · Filtre"
          rows={[
            ["Økologisk", filters?.organic],
            ["Glutenfri", filters?.glutenFree],
            ["Laktosefri", filters?.lactoseFree],
            ["Sukkerfri", filters?.sugarFree],
            ["Lavt sukkerindhold", filters?.lowSugar],
            ["Uden tilsat sukker", filters?.noAddedSugar],
            ["Reduceret sukker", filters?.reducedSugar],
            ["Light", filters?.lightSugar],
            ["Sødemidler", filters?.sweeteners],
            ["Vegansk", filters?.vegan],
            ["Vegetarisk", filters?.vegetarian],
            ["Kødtype", filters?.meatType],
            ["Alkohol", filters?.alcohol],
            ["Alkohol %", filters?.alcoholPercent],
            ["Fedt %", filters?.fatPercent],
            ["Oprindelsesland", filters?.countryOfOrigin],
            ["Fuldkorn", filters?.wholeGrain],
            ["Nøglehul", filters?.keyhole],
            ["Dyrevelfærd", filters?.animalWelfare],
            ["Certificeringer", filters?.certifications],
            ["Opbevaring", filters?.storage],
            ["Størrelse", filters?.size],
            ["Toxiner", filters?.toxins],
          ]}
        />
      </div>
    </details>
  );
}
