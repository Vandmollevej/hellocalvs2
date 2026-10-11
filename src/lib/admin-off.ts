import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Admin "Varedatabase → Open Food Facts" (docs/DECISIONS.md 2026-10-11): listen over
// varer hentet fra OFF (off_products) med navnet opdelt efter vores navneregler og
// en sikkerhed i %. Filtre ligger i URL'en (som Brands-siden).

export const ADMIN_OFF_PAGE_SIZE = 50;
export const OFF_BAND_HIGH = 80;
export const OFF_BAND_MID = 50;

export type AdminOffFilters = {
  q: string;
  band: "high" | "mid" | "low" | "";
  link: "linked" | "unlinked" | "";
  lang: "da" | "foreign" | "unknown" | "";
  issue: string;
  sort: "confidence" | "recent" | "name";
  page: number;
};

export type AdminOffSearchParams = Partial<Record<keyof AdminOffFilters, string | string[]>>;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseAdminOffFilters(params: AdminOffSearchParams): AdminOffFilters {
  const band = one(params.band);
  const link = one(params.link);
  const lang = one(params.lang);
  const sort = one(params.sort);
  const page = Number.parseInt(one(params.page), 10);
  return {
    q: one(params.q).slice(0, 200),
    band: band === "high" || band === "mid" || band === "low" ? band : "",
    link: link === "linked" || link === "unlinked" ? link : "",
    lang: lang === "da" || lang === "foreign" || lang === "unknown" ? lang : "",
    issue: one(params.issue).slice(0, 60),
    sort: sort === "recent" || sort === "name" ? sort : "confidence",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

export function adminOffHref(filters: AdminOffFilters, changes: Partial<AdminOffFilters> = {}) {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.band) params.set("band", next.band);
  if (next.link) params.set("link", next.link);
  if (next.lang) params.set("lang", next.lang);
  if (next.issue) params.set("issue", next.issue);
  if (next.sort !== "confidence") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/product-database/open-food-facts?${query}` : "/admin/product-database/open-food-facts";
}

// Forklaring af koderne i off_products.splitIssues (src/lib/off-name-split.ts).
export const OFF_ISSUE_LABELS: Record<string, string> = {
  "mangler-navn": "OFF har intet navn",
  "mangler-brand": "Intet mærke i OFF",
  "brand-ukendt-i-arkene": "Mærket findes ikke i vores ark",
  "flere-maerker": "Flere mærker på varen",
  "type-ikke-i-ordforraad": "Produkttypen er ikke i vores ordforråd",
  "type-gaettet-sidste-ord": "Produkttypen er gættet (sidste ord)",
  "type-fra-off-kategori": "Produkttypen kommer fra OFF-kategorien",
  "type-fra-generic-name": "Produkttypen kommer fra OFF's generic name",
  "type-fra-maerke": "Produkttypen følger af mærket/linjen",
  "kategori-ikke-afgjort": "Kategori ikke afgjort (sat til Kolonial)",
  "ikke-dansk-navn": "Navnet er ikke på dansk",
  "langt-navn": "Meget langt navn",
  "lang-variation": "Lang variation",
  "maengde-ikke-aflaest": "Mængden kunne ikke aflæses",
  "maengde-afviger-fra-navn": "Mængden afviger fra den i navnet",
  "maengde-fra-product_quantity": "Mængde fra product_quantity",
  "oekologisk-kun-i-navn": "Økologisk kun i navnet (ingen label)",
  "glutenfri-men-allergen-gluten": "Glutenfri, men allergener har gluten",
  "vegansk-men-allergen-maelk-aeg": "Vegansk, men allergener har mælk/æg",
  "sukkerfri-men-sukker-i-naering": "Sukkerfri, men sukker i næringsindhold",
};

export function confidenceClass(value: number) {
  if (value >= OFF_BAND_HIGH) return "text-hf-green-dark";
  if (value >= OFF_BAND_MID) return "text-hf-warning-text";
  return "text-hf-red-dark";
}

export type AdminOffRow = {
  barcode: string;
  imageUrl: string | null;
  rawName: string | null;
  rawBrands: string | null;
  rawQuantity: string | null;
  name: string | null;
  brand: string | null;
  subbrand: string | null;
  productType: string | null;
  variant: string | null;
  keywords: string[];
  packageSizeText: string | null;
  splitConfidence: number;
  splitIssues: string[];
  splitLanguage: string | null;
  productId: string | null;
  reviewedAt: Date | null;
  fetchedAt: Date;
};

export function offWhere(filters: AdminOffFilters): Prisma.OffProductRecordWhereInput {
  const and: Prisma.OffProductRecordWhereInput[] = [];
  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    and.push({
      OR: [
        { barcode: { contains: filters.q } },
        { rawName: contains },
        { name: contains },
        { brand: contains },
        { rawBrands: contains },
        { productType: contains },
        { variant: contains },
      ],
    });
  }
  if (filters.band === "high") and.push({ splitConfidence: { gte: OFF_BAND_HIGH } });
  if (filters.band === "mid") and.push({ splitConfidence: { gte: OFF_BAND_MID, lt: OFF_BAND_HIGH } });
  if (filters.band === "low") and.push({ splitConfidence: { lt: OFF_BAND_MID } });
  if (filters.link === "linked") and.push({ productId: { not: null } });
  if (filters.link === "unlinked") and.push({ productId: null });
  if (filters.lang) and.push({ splitLanguage: filters.lang });
  if (filters.issue) and.push({ splitIssues: { has: filters.issue } });
  return and.length ? { AND: and } : {};
}

export async function loadAdminOff(filters: AdminOffFilters) {
  const where = offWhere(filters);
  const [total, matching, avg, high, mid, linked, reviewed, foreign] = await Promise.all([
    prisma.offProductRecord.count(),
    prisma.offProductRecord.count({ where }),
    prisma.offProductRecord.aggregate({ _avg: { splitConfidence: true } }),
    prisma.offProductRecord.count({ where: { splitConfidence: { gte: OFF_BAND_HIGH } } }),
    prisma.offProductRecord.count({ where: { splitConfidence: { gte: OFF_BAND_MID, lt: OFF_BAND_HIGH } } }),
    prisma.offProductRecord.count({ where: { productId: { not: null } } }),
    prisma.offProductRecord.count({ where: { reviewedAt: { not: null } } }),
    prisma.offProductRecord.count({ where: { splitLanguage: "foreign" } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(matching / ADMIN_OFF_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const orderBy: Prisma.OffProductRecordOrderByWithRelationInput[] =
    filters.sort === "recent"
      ? [{ fetchedAt: "desc" }, { id: "asc" }]
      : filters.sort === "name"
        ? [{ rawName: "asc" }, { id: "asc" }]
        : [{ splitConfidence: "asc" }, { fetchedAt: "desc" }, { id: "asc" }];
  const rows = (await prisma.offProductRecord.findMany({
    where,
    orderBy,
    skip: (page - 1) * ADMIN_OFF_PAGE_SIZE,
    take: ADMIN_OFF_PAGE_SIZE,
    select: {
      barcode: true,
      imageUrl: true,
      rawName: true,
      rawBrands: true,
      rawQuantity: true,
      name: true,
      brand: true,
      subbrand: true,
      productType: true,
      variant: true,
      keywords: true,
      packageSizeText: true,
      splitConfidence: true,
      splitIssues: true,
      splitLanguage: true,
      productId: true,
      reviewedAt: true,
      fetchedAt: true,
    },
  })) as AdminOffRow[];
  const issueRows = await prisma.$queryRaw<{ issue: string; n: bigint }[]>`
    SELECT issue, count(*) AS n FROM off_products, unnest("splitIssues") AS issue
    GROUP BY issue ORDER BY n DESC LIMIT 16
  `;
  return {
    rows,
    total,
    matching,
    page,
    pageCount,
    stats: {
      avg: Math.round(avg._avg.splitConfidence ?? 0),
      high,
      mid,
      low: total - high - mid,
      linked,
      reviewed,
      foreign,
    },
    issues: issueRows.map((row) => ({ issue: row.issue, count: Number(row.n) })),
  };
}
