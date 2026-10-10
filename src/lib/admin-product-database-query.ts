import { IMPORTED_DISH_SOURCES } from "@/lib/meal-kit-providers";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@/lib/product-display-unit";

// URL-kontrakten for admin "Produkt-database" (docs/DECISIONS.md 2026-09-27).
// Ingen Prisma-import her, så filterbjælken (klientkomponent) kan bruge samme
// parsing og link-bygning som serveren.

export const PRODUCT_DATABASE_PAGE_SIZE = 48;
// Valgbare antal varer pr. side (eller pr. indlæsning ved uendelig scroll).
export const PRODUCT_DATABASE_PER_PAGE_OPTIONS = [24, 48, 96, 200] as const;

export const PRODUCT_DATABASE_SORTS = [
  { key: "name", label: "Navn A–Å" },
  { key: "name_desc", label: "Navn Å–A" },
  { key: "newest", label: "Nyeste først" },
  { key: "oldest", label: "Ældste først" },
  { key: "image_first", label: "Med billede først" },
  { key: "image_last", label: "Uden billede først" },
  { key: "brand", label: "Mærke A–Å" },
  { key: "brand_desc", label: "Mærke Å–A" },
  { key: "popular", label: "Mest populære" },
  { key: "trending", label: "Trending (seneste 7 dage)" },
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
export const PRODUCT_SOURCES = ["USER", "BILKA", "REMA1000", "OPEN_FOOD_FACTS", "FRIDA", "USDA"] as const;
// Opskrift-kilder er retter, ikke produkter: de vises under admin → Retter
// og aldrig i Produkt-database (docs/DECISIONS.md 2026-09-28 og 2026-10-10).
export const DISH_SOURCES = IMPORTED_DISH_SOURCES;
export type ProductDatabaseSource = (typeof PRODUCT_SOURCES)[number];
export const PRODUCT_SOURCE_LABELS: Record<ProductDatabaseSource, string> = {
  USER: "Oprettet af bruger",
  BILKA: "Bilka-import",
  REMA1000: "REMA 1000-import",
  OPEN_FOOD_FACTS: "Open Food Facts",
  FRIDA: "Frida (DTU)",
  USDA: "USDA",
};

// Felter der kan vises/skjules i listen og galleriet (gemmes i en visning).
export const PRODUCT_COLUMNS = ["brand", "stores", "category", "kcal", "additions", "status"] as const;
export type ProductColumn = (typeof PRODUCT_COLUMNS)[number];
export const PRODUCT_COLUMN_LABELS: Record<ProductColumn, string> = {
  brand: "Mærke",
  stores: "Kæder",
  category: "Kategori · kilde",
  kcal: "Kcal/100",
  additions: "Tilføjelser",
  status: "Status",
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
  view: "list" | "grid" | "details";
  // Synlige felter; altid mindst ét (ingen i URL'en = alle).
  cols: ProductColumn[];
  // "pages" = side-visning med Forrige/Næste, "infinite" = uendelig scroll.
  paging: "pages" | "infinite";
  perPage: number;
  // Ved uendelig scroll er page antal indlæste portioner (1..page vises).
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

function columnsOrAll(cols: ProductColumn[]): ProductColumn[] {
  const picked = PRODUCT_COLUMNS.filter((c) => cols.includes(c));
  return picked.length > 0 ? picked : [...PRODUCT_COLUMNS];
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
    view: one(params.view) === "grid" ? "grid" : one(params.view) === "details" ? "details" : "list",
    cols: columnsOrAll(pickMany(many(params.cols), PRODUCT_COLUMNS)),
    paging: one(params.paging) === "infinite" ? "infinite" : "pages",
    perPage: PRODUCT_DATABASE_PER_PAGE_OPTIONS.find((n) => String(n) === one(params.perPage)) ?? PRODUCT_DATABASE_PAGE_SIZE,
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
    if (key === "cols" && Array.isArray(value) && value.length === PRODUCT_COLUMNS.length) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
      continue;
    }
    if (key === "sort" && value === "name") continue;
    if (key === "view" && value === "list") continue;
    if (key === "page" && value === 1) continue;
    if (key === "paging" && value === "pages") continue;
    if (key === "perPage" && value === PRODUCT_DATABASE_PAGE_SIZE) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/admin/product-database/products?${query}` : "/admin/product-database/products";
}
