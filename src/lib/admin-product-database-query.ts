import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@/lib/product-display-unit";

// URL-kontrakten for admin "Produkt-database" (docs/DECISIONS.md 2026-09-27).
// Ingen Prisma-import her, så filterbjælken (klientkomponent) kan bruge samme
// parsing og link-bygning som serveren.

export const PRODUCT_DATABASE_PAGE_SIZE = 48;

export const PRODUCT_DATABASE_SORTS = [
  { key: "name", label: "Navn A–Å" },
  { key: "name_desc", label: "Navn Å–A" },
  { key: "newest", label: "Nyeste først" },
  { key: "oldest", label: "Ældste først" },
  { key: "image_first", label: "Med billede først" },
  { key: "image_last", label: "Uden billede først" },
  { key: "brand", label: "Mærke A–Å" },
  { key: "kcal_desc", label: "Flest kcal" },
  { key: "kcal_asc", label: "Færrest kcal" },
] as const;
export type ProductDatabaseSort = (typeof PRODUCT_DATABASE_SORTS)[number]["key"];

export const PRODUCT_STATUSES = ["APPROVED", "PENDING", "REJECTED"] as const;
export type ProductDatabaseStatus = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_STATUS_LABELS: Record<ProductDatabaseStatus, string> = {
  APPROVED: "Godkendt",
  PENDING: "Afventer",
  REJECTED: "Afvist",
};

// "USER" = externalSource null (oprettet af en bruger).
export const PRODUCT_SOURCES = ["USER", "REMA1000", "HELLOFRESH", "OPEN_FOOD_FACTS", "FRIDA", "USDA"] as const;
export type ProductDatabaseSource = (typeof PRODUCT_SOURCES)[number];
export const PRODUCT_SOURCE_LABELS: Record<ProductDatabaseSource, string> = {
  USER: "Oprettet af bruger",
  REMA1000: "REMA 1000-import",
  HELLOFRESH: "HelloFresh",
  OPEN_FOOD_FACTS: "Open Food Facts",
  FRIDA: "Frida (DTU)",
  USDA: "USDA",
};

export { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS };

// Mærke, sub brand, kategori, varetype og kilde er flervalg (gentagne
// URL-parametre, fx ?brand=Arla&brand=Lurpak); resten er enkeltvalg.
export type ProductDatabaseFilters = {
  q: string;
  store: string;
  brand: string[];
  subbrand: string[];
  category: string[];
  productCategory: ProductCategory[];
  source: ProductDatabaseSource[];
  status: ProductDatabaseStatus | "";
  image: "with" | "without" | "";
  barcode: "with" | "without" | "";
  sort: ProductDatabaseSort;
  view: "list" | "grid";
  page: number;
};

export type ProductDatabaseSearchParams = Partial<Record<keyof ProductDatabaseFilters, string | string[]>>;

// Filtre der tæller som "aktive" (til nulstil-knap og tæller).
export const PRODUCT_DATABASE_FILTER_KEYS = [
  "store",
  "brand",
  "subbrand",
  "category",
  "productCategory",
  "source",
  "status",
  "image",
  "barcode",
] as const;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function many(value: string | string[] | undefined) {
  const values = (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .map((v) => v.trim().slice(0, 200))
    .filter(Boolean);
  return [...new Set(values)].slice(0, 50);
}

function pick<T extends string>(value: string, allowed: readonly T[]): T | "" {
  return (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

function pickMany<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((v): v is T => (allowed as readonly string[]).includes(v));
}

export function parseProductDatabaseFilters(params: ProductDatabaseSearchParams): ProductDatabaseFilters {
  const page = Number.parseInt(one(params.page), 10);
  return {
    q: one(params.q).slice(0, 200),
    store: one(params.store),
    brand: many(params.brand),
    subbrand: many(params.subbrand),
    category: many(params.category),
    productCategory: pickMany(many(params.productCategory), PRODUCT_CATEGORIES),
    source: pickMany(many(params.source), PRODUCT_SOURCES),
    status: pick(one(params.status), PRODUCT_STATUSES),
    image: pick(one(params.image), ["with", "without"] as const),
    barcode: pick(one(params.barcode), ["with", "without"] as const),
    sort:
      pick(
        one(params.sort),
        PRODUCT_DATABASE_SORTS.map((s) => s.key),
      ) || "name",
    view: one(params.view) === "grid" ? "grid" : "list",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

// Link til samme side med ændrede filtre. Standardværdier udelades, så
// URL'en forbliver kort. Ændres et filter, starter visningen på side 1.
export function productDatabaseHref(filters: ProductDatabaseFilters, changes: Partial<ProductDatabaseFilters> = {}) {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value === "" || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
      continue;
    }
    if (key === "sort" && value === "name") continue;
    if (key === "view" && value === "list") continue;
    if (key === "page" && value === 1) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/admin/product-database?${query}` : "/admin/product-database";
}
