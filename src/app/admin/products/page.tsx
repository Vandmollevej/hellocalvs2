import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { PendingProductCard, type PendingProduct } from "@/components/admin/PendingProductCard";
import { productConfidencePercent } from "@/lib/pending-product-confidence";
import { asNumberRecord } from "@/lib/nutrients";
import { t } from "@/lib/admin-i18n";

const SORTS = [
  { key: "time", label: "Tidspunkt (nyeste øverst)" },
  { key: "alpha", label: "Alfabetisk" },
  { key: "confidence", label: "Sikkerhedsmargin (laveste øverst)" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const createdAtFormat = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Adskilt visning af bruger-indsendte vs. auto-importerede (AI/API/DB)
// produkter (docs/DECISIONS.md 2026-09-02) — filter/faner, ikke en ny side.
// externalSource er null for bruger-indsendte produkter, sat for alt der
// kommer fra Open Food Facts/USDA/Frida/HelloFresh.
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { tab: tabParam, sort: sortParam } = await searchParams;
  const tab = tabParam === "auto" ? "auto" : "user";
  const sort: SortKey = SORTS.some((s) => s.key === sortParam) ? (sortParam as SortKey) : "time";

  const rows = await prisma.product.findMany({
    where: {
      status: "PENDING",
      // Brugeres egne private ingredienser er ikke til godkendelse.
      privateOwnerId: null,
      externalSource: tab === "auto" ? { not: null } : null,
    },
    include: {
      brand: true,
      category: { select: { name: true } },
      barcodes: { select: { code: true } },
      nutritionFeatures: { select: { sugarsPer100g: true, fiberPer100g: true, saltPer100g: true } },
      createdBy: { select: { displayName: true, email: true } },
      aiAnalyses: { select: { kind: true, confidence: true, prediction: true } },
      matchChecks: { select: { confidence: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const products: PendingProduct[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    productType: p.productType,
    subbrand: p.subbrand,
    variant: p.variant,
    brand: p.brand ? { name: p.brand.name, logoUrl: p.brand.logoUrl } : null,
    imageUrl: p.imageUrl,
    kcalPer100g: p.kcalPer100g,
    proteinPer100g: p.proteinPer100g,
    carbsPer100g: p.carbsPer100g,
    fatPer100g: p.fatPer100g,
    externalSource: p.externalSource,
    createdAtLabel: createdAtFormat.format(p.createdAt),
    confidencePercent: productConfidencePercent(p.aiAnalyses, p.matchChecks),
    packageSizeText: p.packageSizeText,
    productCategory: p.productCategory,
    categoryName: p.category?.name ?? null,
    barcodes: p.barcodes.map((b) => b.code),
    servingSizeGrams: p.servingSizeGrams,
    servingSizeUnitSingular: p.servingSizeUnitSingular,
    ingredientsText: p.ingredientsText,
    allergens: p.allergens,
    additives: p.additives,
    createdBy: p.createdBy ? p.createdBy.displayName || p.createdBy.email : null,
    extended: {
      saturatedFat: p.saturatedFatPer100g,
      unsaturatedFat: p.unsaturatedFatPer100g,
      transFat: p.transFatPer100g,
      cholesterol: p.cholesterolPer100g,
      vitaminA: p.vitaminAPer100g,
      vitaminC: p.vitaminCPer100g,
      sugar: p.nutritionFeatures?.sugarsPer100g ?? null,
      fiber: p.nutritionFeatures?.fiberPer100g ?? null,
      salt: p.nutritionFeatures?.saltPer100g ?? null,
    },
    micronutrients: asNumberRecord(p.micronutrientsPer100g),
    dietaryTags: Object.values(asStringRecord(p.dietaryTags)),
  }));

  const createdAtMs = new Map(rows.map((p) => [p.id, p.createdAt.getTime()]));
  products.sort((a, b) => {
    if (sort === "alpha") return a.name.localeCompare(b.name, "da");
    if (sort === "confidence") {
      // Uden måling nederst.
      const ca = a.confidencePercent ?? Infinity;
      const cb = b.confidencePercent ?? Infinity;
      if (ca !== cb) return ca - cb;
    }
    return createdAtMs.get(b.id)! - createdAtMs.get(a.id)!;
  });

  const tabClass = (active: boolean) =>
    `hf-type-body rounded-md px-3 py-1.5 ${active ? "bg-hf-green-dark text-hf-white" : "border border-hf-tan-dark text-text-secondary"}`;
  const activeSort = SORTS.find((s) => s.key === sort)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="hf-type-title min-w-0 truncate text-hf-black">{t(admin.locale, "products_title")}</h1>
        <details className="relative">
          <summary
            title={`Sortér: ${activeSort.label}`}
            aria-label={`Sortér: ${activeSort.label}`}
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-hf-tan-dark bg-hf-white text-text-secondary [&::-webkit-details-marker]:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 6h18M6 12h12M10 18h4" />
            </svg>
          </summary>
          <div className="absolute right-0 z-10 mt-1 flex w-max max-w-[calc(100vw-2rem)] flex-col rounded-md border border-hf-tan-dark bg-hf-white py-1 shadow-lg">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={`/admin/products?tab=${tab}&sort=${s.key}`}
                className={`hf-type-body px-3 py-1.5 hover:bg-hf-tan ${s.key === sort ? "hf-type-strong text-hf-green-dark" : "text-text-secondary"}`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </details>
      </div>
      <div className="flex gap-2">
        <Link href={`/admin/products?tab=user&sort=${sort}`} className={tabClass(tab === "user")}>
          {t(admin.locale, "products_tab_user")}
        </Link>
        <Link href={`/admin/products?tab=auto&sort=${sort}`} className={tabClass(tab === "auto")}>
          {t(admin.locale, "products_tab_auto")}
        </Link>
      </div>
      {products.length === 0 ? (
        <p className="hf-type-body text-text-secondary">Ingen varer afventer godkendelse i denne fane.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {products.map((product) => (
            <PendingProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
    ),
  );
}
