import type { Prisma } from "@prisma/client";
import {
  OFF_QUALITY_CATEGORIES,
  OFF_QUALITY_RATINGS,
  type OffQualityCategory,
  type OffQualityRating,
} from "@/lib/off-quality";
import { OFF_REVIEW_WHERE } from "@/lib/off-quality-job";

// URL-kontrakten for admin → Scan-invites → "Open Food Facts-kontrol"
// (docs/DECISIONS.md 2026-10-11). Samme filtre bruges af siden og af
// handlingen "send alle, der matcher filteret".

export const OFF_QUALITY_PATH = "/admin/scan-invites/off-kvalitet";

export const OFF_QUALITY_SORTS = [
  { key: "score_asc", label: "Dårligste først" },
  { key: "score_desc", label: "Bedste først" },
  { key: "name", label: "Navn A–Å" },
  { key: "brand", label: "Mærke A–Å" },
  { key: "sent_desc", label: "Senest sendt til scan-appen" },
  { key: "assessed_desc", label: "Senest vurderet" },
] as const;
export type OffQualitySort = (typeof OFF_QUALITY_SORTS)[number]["key"];

// "" = alle, der ikke er gode (standard). "all" = også de gode.
export type OffQualityRatingFilter = "" | "all" | OffQualityRating;

export const OFF_QUALITY_SENT_FILTERS = [
  { key: "", label: "Alle" },
  { key: "unsent", label: "Ikke sendt" },
  { key: "pending", label: "Sendt — ikke scannet endnu" },
  { key: "done", label: "Scannet af agent" },
] as const;
export type OffQualitySentFilter = (typeof OFF_QUALITY_SENT_FILTERS)[number]["key"];

export const OFF_QUALITY_PER_PAGE = [25, 50, 100, 200] as const;

export type OffQualityFilters = {
  q: string;
  rating: OffQualityRatingFilter;
  category: OffQualityCategory[];
  sent: OffQualitySentFilter;
  sort: OffQualitySort;
  perPage: number;
  page: number;
};

export type OffQualitySearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function many(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value : value === undefined ? [] : [value]).map((v) => v.trim()).filter(Boolean);
}

export function parseOffQualityFilters(params: OffQualitySearchParams): OffQualityFilters {
  const rating = one(params.rating);
  const sent = one(params.sent);
  const sort = one(params.sort);
  const perPage = Number.parseInt(one(params.perPage), 10);
  const page = Number.parseInt(one(params.page), 10);
  return {
    q: one(params.q).slice(0, 200),
    rating: rating === "all" || (OFF_QUALITY_RATINGS as readonly string[]).includes(rating) ? (rating as OffQualityRatingFilter) : "",
    category: many(params.category).filter((c): c is OffQualityCategory =>
      (OFF_QUALITY_CATEGORIES as readonly string[]).includes(c),
    ),
    sent: OFF_QUALITY_SENT_FILTERS.some((f) => f.key === sent) ? (sent as OffQualitySentFilter) : "",
    sort: OFF_QUALITY_SORTS.some((s) => s.key === sort) ? (sort as OffQualitySort) : "score_asc",
    perPage: OFF_QUALITY_PER_PAGE.find((n) => n === perPage) ?? 50,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

// Link til samme side med ændrede filtre; standardværdier udelades.
export function offQualityHref(filters: OffQualityFilters, changes: Partial<OffQualityFilters> = {}) {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.rating) params.set("rating", next.rating);
  for (const category of next.category) params.append("category", category);
  if (next.sent) params.set("sent", next.sent);
  if (next.sort !== "score_asc") params.set("sort", next.sort);
  if (next.perPage !== 50) params.set("perPage", String(next.perPage));
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `${OFF_QUALITY_PATH}?${query}` : OFF_QUALITY_PATH;
}

export function offQualityWhere(filters: OffQualityFilters): Prisma.ProductQualityReviewWhereInput {
  const and: Prisma.ProductQualityReviewWhereInput[] = [{ product: OFF_REVIEW_WHERE }];
  if (filters.q) {
    and.push({
      product: {
        OR: [
          { name: { contains: filters.q, mode: "insensitive" } },
          { brand: { name: { contains: filters.q, mode: "insensitive" } } },
          { barcodes: { some: { code: { contains: filters.q } } } },
        ],
      },
    });
  }
  if (filters.rating === "") and.push({ rating: { not: "GOOD" } });
  else if (filters.rating !== "all") and.push({ rating: filters.rating });
  if (filters.category.length) and.push({ categories: { hasSome: filters.category } });
  if (filters.sent === "unsent") and.push({ scanRequestedAt: null });
  if (filters.sent === "pending") and.push({ scanRequestedAt: { not: null }, scanDoneAt: null });
  if (filters.sent === "done") and.push({ scanDoneAt: { not: null } });
  return { AND: and };
}

export function offQualityOrderBy(sort: OffQualitySort): Prisma.ProductQualityReviewOrderByWithRelationInput[] {
  switch (sort) {
    case "score_desc":
      return [{ score: "desc" }, { productId: "asc" }];
    case "name":
      return [{ product: { name: "asc" } }, { productId: "asc" }];
    case "brand":
      return [{ product: { brand: { name: "asc" } } }, { product: { name: "asc" } }, { productId: "asc" }];
    case "sent_desc":
      return [{ scanRequestedAt: { sort: "desc", nulls: "last" } }, { productId: "asc" }];
    case "assessed_desc":
      return [{ assessedAt: "desc" }, { productId: "asc" }];
    default:
      return [{ score: "asc" }, { productId: "asc" }];
  }
}
