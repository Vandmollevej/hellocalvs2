import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import {
  OFF_QUALITY_CATEGORIES,
  OFF_QUALITY_CATEGORY_LABELS,
  OFF_QUALITY_RATING_LABELS,
  OFF_QUALITY_RATINGS,
  type OffQualityCategory,
  type OffQualityFinding,
  type OffQualityRating,
} from "@/lib/off-quality";
import {
  OFF_QUALITY_PATH,
  OFF_QUALITY_PER_PAGE,
  OFF_QUALITY_SENT_FILTERS,
  OFF_QUALITY_SORTS,
  offQualityHref,
  offQualityOrderBy,
  offQualityWhere,
  parseOffQualityFilters,
  type OffQualitySearchParams,
} from "@/lib/off-quality-query";
import { OffQualityTable, type OffQualityRow } from "./OffQualityTable";
import { runAssessmentNow } from "./actions";

// Admin → Scan-invites → "Open Food Facts-kontrol" (docs/DECISIONS.md
// 2026-10-11): alle Open Food Facts-varer med en vurdering pr. kategori og en
// kommentar om, hvorfor varen ikke lever op til kvaliteten. Admin krydser varer
// af, sorterer på vurdering og sender dem til scan-appen, hvor de står som ikke
// scannede, til en agent har scannet dem. Vurderingen beregnes af robotten
// "off-quality" (src/lib/off-quality.ts); "Vurdér nu" kører den med det samme.

const numberFormat = new Intl.NumberFormat("da-DK");

const NOTICES: Record<string, (count: number) => string> = {
  sent: (n) => `${numberFormat.format(n)} varer er sendt til scan-appen og står nu som ikke scannede.`,
  withdrawn: (n) => `${numberFormat.format(n)} varer er trukket tilbage fra scan-appen.`,
  assessed: () => "Vurderingen er kørt igen.",
  none: () => "Vælg mindst én vare først.",
};

function groupFindings(findings: unknown): { label: string; comments: string[] }[] {
  if (!Array.isArray(findings)) return [];
  const byCategory = new Map<OffQualityCategory, string[]>();
  for (const raw of findings as OffQualityFinding[]) {
    const list = byCategory.get(raw.category) ?? [];
    list.push(raw.comment);
    byCategory.set(raw.category, list);
  }
  return OFF_QUALITY_CATEGORIES.filter((category) => byCategory.has(category)).map((category) => ({
    label: OFF_QUALITY_CATEGORY_LABELS[category],
    comments: byCategory.get(category) ?? [],
  }));
}

export default async function OffQualityPage({
  searchParams,
}: {
  searchParams: Promise<OffQualitySearchParams>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const params = await searchParams;
  const filters = parseOffQualityFilters(params);
  const where = offQualityWhere(filters);

  const [all, matchingTotal, reviews] = await Promise.all([
    // Til tællerne: kun små felter, ingen fund-tekster.
    prisma.productQualityReview.findMany({
      select: { rating: true, categories: true, scanRequestedAt: true, scanDoneAt: true },
    }),
    prisma.productQualityReview.count({ where }),
    prisma.productQualityReview.findMany({
      where,
      orderBy: offQualityOrderBy(filters.sort),
      skip: (filters.page - 1) * filters.perPage,
      take: filters.perPage,
      select: {
        productId: true,
        score: true,
        rating: true,
        findings: true,
        scanRequestedAt: true,
        scanDoneAt: true,
        product: {
          select: {
            name: true,
            imageUrl: true,
            packageSizeText: true,
            brand: { select: { name: true } },
            barcodes: { select: { code: true }, take: 1 },
          },
        },
      },
    }),
  ]);

  const ratingCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  let pending = 0;
  let done = 0;
  for (const review of all) {
    ratingCounts.set(review.rating, (ratingCounts.get(review.rating) ?? 0) + 1);
    if (review.rating !== "GOOD") {
      for (const category of review.categories) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
    if (review.scanDoneAt) done += 1;
    else if (review.scanRequestedAt) pending += 1;
  }
  const notBad = all.length - (ratingCounts.get("GOOD") ?? 0);

  const rows: OffQualityRow[] = reviews.map((review) => ({
    productId: review.productId,
    name: review.product.name,
    brand: review.product.brand?.name ?? null,
    packageSizeText: review.product.packageSizeText,
    barcode: review.product.barcodes[0]?.code ?? null,
    imageUrl: review.product.imageUrl,
    score: review.score,
    rating: review.rating as OffQualityRating,
    groups: groupFindings(review.findings),
    scanRequestedAt: review.scanRequestedAt?.toISOString() ?? null,
    scanDoneAt: review.scanDoneAt?.toISOString() ?? null,
  }));

  const pageCount = Math.max(1, Math.ceil(matchingTotal / filters.perPage));
  const noticeKey = typeof params.notice === "string" ? params.notice : "";
  const noticeCount = Number.parseInt(typeof params.n === "string" ? params.n : "0", 10) || 0;
  const notice = NOTICES[noticeKey]?.(noticeCount);
  const returnTo = offQualityHref(filters, { page: filters.page });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/scan-invites" className="hf-type-small text-text-secondary underline">
          ← Scan-invites
        </Link>
        <h1 className="hf-type-title text-hf-black">Open Food Facts-kontrol</h1>
        <p className="hf-type-body text-text-secondary">
          Varer fra Open Food Facts, vurderet i kategorier med en kommentar om, hvorfor de ikke lever op til kvaliteten.
          Kryds varer af og send dem til scan-appen: de står så som ikke scannede (minus på hyldeoverlayet og i
          &quot;Skal scannes&quot;), til en agent har scannet dem.
        </p>
      </div>

      {notice && <p className="hf-type-body rounded bg-hf-green-light px-3 py-2 text-hf-green-dark">{notice}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="hf-type-small rounded-full bg-hf-tan px-2 py-0.5">{numberFormat.format(all.length)} vurderet</span>
        <span className="hf-type-small rounded-full bg-hf-tan px-2 py-0.5">{numberFormat.format(notBad)} ikke gode</span>
        <span className="hf-type-small rounded-full bg-hf-tan px-2 py-0.5">{numberFormat.format(pending)} sendt, ikke scannet</span>
        <span className="hf-type-small rounded-full bg-hf-tan px-2 py-0.5">{numberFormat.format(done)} scannet</span>
        <form action={runAssessmentNow} className="ml-auto">
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className="hf-btn-secondary hf-btn--compact w-fit">
            Vurdér nu
          </button>
        </form>
      </div>
      {all.length === 0 && (
        <p className="hf-type-body rounded bg-hf-warning-bg px-3 py-2 text-hf-warning">
          Der er ingen vurderinger endnu. Tryk &quot;Vurdér nu&quot; (robotten kører ellers hver nat kl. 05:00).
        </p>
      )}

      <form method="get" action={OFF_QUALITY_PATH} className="hf-panel flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="hf-type-small flex flex-col gap-1">
            Søg (navn, mærke, stregkode)
            <input
              name="q"
              defaultValue={filters.q}
              className="hf-type-body w-64 rounded border border-hf-tan-dark bg-page-bg px-2 py-1"
            />
          </label>
          <label className="hf-type-small flex flex-col gap-1">
            Vurdering
            <select
              name="rating"
              defaultValue={filters.rating}
              className="hf-type-body rounded border border-hf-tan-dark bg-page-bg px-2 py-1"
            >
              <option value="">Alle, der ikke er gode</option>
              <option value="all">Alle (også gode)</option>
              {OFF_QUALITY_RATINGS.map((rating) => (
                <option key={rating} value={rating}>
                  {OFF_QUALITY_RATING_LABELS[rating]} ({numberFormat.format(ratingCounts.get(rating) ?? 0)})
                </option>
              ))}
            </select>
          </label>
          <label className="hf-type-small flex flex-col gap-1">
            Scan-app
            <select
              name="sent"
              defaultValue={filters.sent}
              className="hf-type-body rounded border border-hf-tan-dark bg-page-bg px-2 py-1"
            >
              {OFF_QUALITY_SENT_FILTERS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="hf-type-small flex flex-col gap-1">
            Sortér
            <select
              name="sort"
              defaultValue={filters.sort}
              className="hf-type-body rounded border border-hf-tan-dark bg-page-bg px-2 py-1"
            >
              {OFF_QUALITY_SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="hf-type-small flex flex-col gap-1">
            Pr. side
            <select
              name="perPage"
              defaultValue={String(filters.perPage)}
              className="hf-type-body rounded border border-hf-tan-dark bg-page-bg px-2 py-1"
            >
              {OFF_QUALITY_PER_PAGE.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="hf-type-small mb-1 text-text-secondary">Mangler i kategori (mindst én)</legend>
          {OFF_QUALITY_CATEGORIES.map((category) => (
            <label key={category} className="hf-type-body flex items-center gap-1">
              <input type="checkbox" name="category" value={category} defaultChecked={filters.category.includes(category)} />
              {OFF_QUALITY_CATEGORY_LABELS[category]} ({numberFormat.format(categoryCounts.get(category) ?? 0)})
            </label>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <button type="submit" className="hf-btn-secondary hf-btn--compact w-fit">
            Vis
          </button>
          <Link href={OFF_QUALITY_PATH} className="hf-type-body self-center underline">
            Nulstil
          </Link>
        </div>
      </form>

      <p className="hf-type-small text-text-secondary">
        {numberFormat.format(matchingTotal)} varer matcher · side {filters.page} af {pageCount}
      </p>

      <OffQualityTable rows={rows} returnTo={returnTo} matchingTotal={matchingTotal} />

      {pageCount > 1 && (
        <nav className="flex items-center gap-3" aria-label="Sider">
          {filters.page > 1 && (
            <Link href={offQualityHref(filters, { page: filters.page - 1 })} className="hf-btn-secondary hf-btn--compact w-fit">
              Forrige
            </Link>
          )}
          {filters.page < pageCount && (
            <Link href={offQualityHref(filters, { page: filters.page + 1 })} className="hf-btn-secondary hf-btn--compact w-fit">
              Næste
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
