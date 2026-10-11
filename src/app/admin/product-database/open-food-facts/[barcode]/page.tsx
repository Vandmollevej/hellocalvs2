import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import { OFF_ISSUE_LABELS, confidenceClass } from "@/lib/admin-off";
import { resplitOffRecordAction, toggleOffReviewedAction } from "../actions";

// Admin "Varedatabase → Open Food Facts → vare": OFF's egne tekster ved siden af
// opdelingen og de tre tabeller (basisinfo, næring, filtre), som varen udfyldes i.

type Json = Record<string, unknown>;

const NUTRITION_LABELS: Record<string, string> = {
  kcal: "Energi (kcal)",
  kj: "Energi (kJ)",
  protein: "Protein (g)",
  carbs: "Kulhydrat (g)",
  fat: "Fedt (g)",
  saturatedFat: "Mættet fedt (g)",
  monounsaturatedFat: "Enkeltumættet fedt (g)",
  polyunsaturatedFat: "Flerumættet fedt (g)",
  transFat: "Transfedt (g)",
  sugars: "Sukkerarter (g)",
  fiber: "Fibre (g)",
  salt: "Salt (g)",
  sodium: "Natrium (mg)",
  alcohol: "Alkohol (g)",
};

const FILTER_LABELS: Record<string, string> = {
  organic: "Økologisk",
  glutenFree: "Glutenfri",
  lactoseFree: "Laktosefri",
  sugarFree: "Sukkerfri",
  lowSugar: "Lavt sukkerindhold",
  noAddedSugar: "Uden tilsat sukker",
  reducedSugar: "Reduceret sukker",
  lightSugar: "Light",
  sweeteners: "Sødemidler",
  vegan: "Vegansk",
  vegetarian: "Vegetarisk",
  meatType: "Kødtype",
  alcohol: "Alkohol",
  alcoholPercent: "Alkohol (%)",
  fatPercent: "Fedt (%)",
  countryOfOrigin: "Oprindelsesland",
  wholeGrain: "Fuldkorn",
  keyhole: "Nøglehul",
  animalWelfare: "Dyrevelfærd",
  certifications: "Certificeringer",
  storage: "Opbevaring",
  size: "Størrelse",
  toxins: "Toxiner",
};

function display(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  return String(value);
}

function Facts({ title, rows }: { title: string; rows: [string, unknown][] }) {
  return (
    <section className="hf-panel flex flex-col gap-3">
      <h2 className="hf-type-title text-hf-black">{title}</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="hf-type-small text-text-muted">{label}</dt>
            <dd className={`hf-type-body ${display(value) ? "text-hf-black" : "text-text-muted"}`}>{display(value) ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function AdminOffDetailPage({ params }: { params: Promise<{ barcode: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const canEdit = (await requireFullAdminUser()) !== null;

  const { barcode } = await params;
  const record = await prisma.offProductRecord.findUnique({ where: { barcode } });
  if (!record) notFound();
  const local = await prisma.barcode.findUnique({
    where: { code: barcode },
    select: { productId: true, product: { select: { name: true, status: true } } },
  });

  const raw = (record.raw ?? {}) as Json;
  const filters = (record.filters ?? {}) as Json;
  const nutrition = (record.nutrition ?? null) as (Json & { micronutrients?: Record<string, number> }) | null;
  const fields = (record.splitFields ?? {}) as Record<string, number>;
  const labels = Array.isArray(raw.labels_tags) ? (raw.labels_tags as string[]) : [];
  const categories = Array.isArray(raw.categories_tags) ? (raw.categories_tags as string[]) : [];

  return (
    <div className="hf-admin-page">
      <div className="flex flex-col gap-2">
        <Link href="/admin/product-database/open-food-facts" className="hf-type-small text-text-secondary hover:text-hf-black">
          ← Open Food Facts
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            {record.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={record.imageUrl} alt="" className="h-20 w-20 rounded-md object-contain" />
            )}
            <div className="flex flex-col gap-1">
              <h1 className="hf-type-title text-hf-black">{record.rawName ?? record.barcode}</h1>
              <p className="hf-type-body text-text-secondary">
                {record.barcode}
                {record.rawBrands ? ` · ${record.rawBrands}` : ""}
                {record.rawQuantity ? ` · ${record.rawQuantity}` : ""}
              </p>
              {local?.productId && (
                <Link href={`/admin/products/${local.productId}`} className="hf-type-small text-hf-green-dark">
                  Findes som vare: {local.product.name} ({local.product.status})
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className={`hf-type-hero ${confidenceClass(record.splitConfidence)}`}>{record.splitConfidence} %</p>
            <p className="hf-type-small text-text-muted">sikkerhed for at opdelingen er korrekt</p>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <form action={resplitOffRecordAction}>
            <input type="hidden" name="barcode" value={record.barcode} />
            <button type="submit" className="hf-btn-secondary hf-btn--compact">
              Kør opdelingen igen
            </button>
          </form>
          <form action={toggleOffReviewedAction}>
            <input type="hidden" name="barcode" value={record.barcode} />
            <button type="submit" className="hf-btn-secondary hf-btn--compact">
              {record.reviewedAt ? "Fjern «gennemgået»" : "Markér som gennemgået"}
            </button>
          </form>
        </div>
      )}

      <Facts
        title="Opdelingen"
        rows={[
          ["Titel (uden mærke og mængde)", record.name],
          ["Mærke", record.brand ? `${record.brand}${record.brandKnown ? "" : " (ukendt i arkene)"}` : null],
          ["Øvrige mærker i OFF", record.extraBrands],
          ["Sub brand", record.subbrand],
          ["Produkttype", record.productType],
          ["Produkttype, flertal", record.productTypePlural],
          ["Variation", record.variant],
          ["Nøgleord", record.keywords],
          ["Pakning", record.packaging],
          ["Kategori", record.category],
          ["Mængde", record.packageSizeText],
          ["Antal i pakken", record.packCount],
        ]}
      />

      <Facts
        title="Sikkerhed pr. felt"
        rows={[
          ["Samlet", `${record.splitConfidence} %`],
          ["Mærke", fields.brand !== undefined ? `${fields.brand} %` : null],
          ["Produkttype", fields.type !== undefined ? `${fields.type} %` : null],
          ["Variation", fields.variation !== undefined ? `${fields.variation} %` : null],
          ["Sprog", `${record.splitLanguage ?? "ukendt"}${fields.language !== undefined ? ` (${fields.language} %)` : ""}`],
          ["Årsager", record.splitIssues.map((issue) => OFF_ISSUE_LABELS[issue] ?? issue)],
        ]}
      />

      <Facts
        title="Tabel 3 — filtre (product_filters)"
        rows={Object.keys(FILTER_LABELS).map((key): [string, unknown] => [FILTER_LABELS[key], filters[key]])}
      />

      <Facts
        title="Tabel 2 — næring pr. 100 g/ml"
        rows={[
          ["Grundlag", nutrition ? (nutrition.basis === "100ml" ? "pr. 100 ml" : "pr. 100 g") : null],
          ...Object.keys(NUTRITION_LABELS).map((key): [string, unknown] => [NUTRITION_LABELS[key], nutrition?.[key]]),
          ...Object.entries(nutrition?.micronutrients ?? {}).map(([key, value]): [string, unknown] => [key, value]),
        ]}
      />

      <Facts
        title="Tabel 1 — OFF's egne felter"
        rows={[
          ["Navn (dansk)", raw.product_name_da],
          ["Navn", raw.product_name],
          ["Generic name", raw.generic_name_da ?? raw.generic_name],
          ["Sprog", record.lang],
          ["Kategorier", record.rawCategories],
          ["Kategori-tags", categories.slice(0, 12)],
          ["Labels", labels.slice(0, 12)],
          ["Oprindelse", raw.origins_tags],
          ["Butikker", raw.stores],
          ["Hentet", record.fetchedAt.toLocaleString("da-DK")],
          ["Kilde", record.source],
        ]}
      />

      <details className="hf-surface">
        <summary className="hf-type-strong cursor-pointer px-4 py-3 text-hf-black">OFF&apos;s rå svar</summary>
        <pre className="hf-type-small overflow-x-auto px-4 pb-4 text-text-secondary">{JSON.stringify(raw, null, 2)}</pre>
      </details>
    </div>
  );
}
