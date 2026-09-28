import type { Prisma, ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DISH_SOURCES,
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_DATABASE_PAGE_SIZE,
  PRODUCT_SOURCE_LABELS,
  type ProductDatabaseFilters,
  type ProductDatabaseSort,
} from "@/lib/admin-product-database-query";

// Admin "Produkt-database" (docs/DECISIONS.md 2026-09-27): hele
// produktkataloget med søgning, filtre (kæde, mærke, sub brand, kategori,
// kilde, status, billede, stregkode) og sortering. Private ingredienser
// (privateOwnerId) er udeladt som i øvrige admin-lister.

const insensitive = { mode: "insensitive" as const };

// Kun rigtige produkter: private ingredienser og retter (HelloFresh o.l.) er udeladt.
const PRODUCTS_ONLY: Prisma.ProductWhereInput = {
  privateOwnerId: null,
  OR: [{ externalSource: null }, { externalSource: { notIn: [...DISH_SOURCES] } }],
};

function buildWhere(filters: ProductDatabaseFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [PRODUCTS_ONLY];

  if (filters.q) {
    // Hvert ord skal findes i navn, mærke, sub brand, variant, produkttype
    // eller stregkode, så "arla skyr vanilje" rammer på tværs af felterne.
    for (const word of filters.q.split(/\s+/).filter(Boolean).slice(0, 8)) {
      and.push({
        OR: [
          { name: { contains: word, ...insensitive } },
          { brand: { name: { contains: word, ...insensitive } } },
          { subbrand: { contains: word, ...insensitive } },
          { variant: { contains: word, ...insensitive } },
          { productType: { contains: word, ...insensitive } },
          { barcodes: { some: { code: { contains: word } } } },
        ],
      });
    }
  }
  if (filters.store === "none") and.push({ stores: { none: {} } });
  else if (filters.store) and.push({ stores: { some: { storeId: filters.store } } });
  // Flervalg: et produkt matcher, hvis det rammer mindst én af de valgte værdier.
  if (filters.brand.length > 0) and.push({ OR: filters.brand.map((name) => ({ brand: { name: { equals: name, ...insensitive } } })) });
  if (filters.subbrand.length > 0) and.push({ OR: filters.subbrand.map((name) => ({ subbrand: { equals: name, ...insensitive } })) });
  if (filters.category.length > 0) {
    const ids = filters.category.filter((id) => id !== "none");
    and.push({
      OR: [
        ...(ids.length > 0 ? [{ categoryId: { in: ids } }] : []),
        ...(filters.category.includes("none") ? [{ categoryId: null }] : []),
      ],
    });
  }
  if (filters.productCategory.length > 0) and.push({ productCategory: { in: filters.productCategory } });
  if (filters.source.length > 0) {
    const external = filters.source.filter((source) => source !== "USER");
    and.push({
      OR: [
        ...(external.length > 0 ? [{ externalSource: { in: external } }] : []),
        ...(filters.source.includes("USER") ? [{ externalSource: null }] : []),
      ],
    });
  }
  if (filters.status) and.push({ status: filters.status });
  if (filters.image === "with") and.push({ imageUrl: { not: null } });
  if (filters.image === "without") and.push({ imageUrl: null });
  if (filters.barcode === "with") and.push({ barcodes: { some: {} } });
  if (filters.barcode === "without") and.push({ barcodes: { none: {} } });

  return { AND: and };
}

function buildOrderBy(sort: ProductDatabaseSort): Prisma.ProductOrderByWithRelationInput[] {
  const byName: Prisma.ProductOrderByWithRelationInput = { name: "asc" };
  const stable: Prisma.ProductOrderByWithRelationInput = { id: "asc" };
  switch (sort) {
    case "name":
      return [byName, stable];
    case "name_desc":
      return [{ name: "desc" }, stable];
    case "newest":
      return [{ createdAt: "desc" }, stable];
    case "oldest":
      return [{ createdAt: "asc" }, stable];
    // Selve billed-URL'en er ligegyldig; nulls-placeringen deler listen i
    // med/uden billede, og navnet giver en stabil orden inden i hver del.
    case "image_first":
      return [{ imageUrl: { sort: "asc", nulls: "last" } }, byName, stable];
    case "image_last":
      return [{ imageUrl: { sort: "asc", nulls: "first" } }, byName, stable];
    case "brand":
      return [{ brand: { name: "asc" } }, byName, stable];
    case "kcal_desc":
      return [{ kcalPer100g: "desc" }, byName, stable];
    case "kcal_asc":
      return [{ kcalPer100g: "asc" }, byName, stable];
  }
}

export type ProductDatabaseRow = {
  id: string;
  name: string;
  brandName: string | null;
  subbrand: string | null;
  variant: string | null;
  packageSizeText: string | null;
  imageUrl: string | null;
  kcalPer100g: number;
  status: ProductStatus;
  sourceLabel: string;
  categoryLabel: string | null;
  stores: string[];
  barcodeCount: number;
};

export type ProductDatabaseOverview = {
  total: number;
  withImage: number;
  approved: number;
  pending: number;
};

export async function loadProductDatabase(filters: ProductDatabaseFilters) {
  const where = buildWhere(filters);
  const [matching, rows, stores, categories, overview] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip: (filters.page - 1) * PRODUCT_DATABASE_PAGE_SIZE,
      take: PRODUCT_DATABASE_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        subbrand: true,
        variant: true,
        packageSizeText: true,
        imageUrl: true,
        kcalPer100g: true,
        status: true,
        externalSource: true,
        productCategory: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
        stores: { select: { store: { select: { name: true } } } },
        _count: { select: { barcodes: true } },
      },
    }),
    prisma.store.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { products: true } } },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    loadOverview(),
  ]);

  const result: ProductDatabaseRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    brandName: p.brand?.name ?? null,
    subbrand: p.subbrand,
    variant: p.variant,
    packageSizeText: p.packageSizeText,
    imageUrl: p.imageUrl,
    kcalPer100g: p.kcalPer100g,
    status: p.status,
    // Nye kilder i skemaet (fx en kommende kæde-import) vises med deres rå navn.
    sourceLabel: (PRODUCT_SOURCE_LABELS as Record<string, string>)[p.externalSource ?? "USER"] ?? String(p.externalSource),
    categoryLabel: p.category?.name ?? (p.productCategory ? PRODUCT_CATEGORY_LABELS[p.productCategory] : null),
    stores: p.stores.map((s) => s.store.name),
    barcodeCount: p._count.barcodes,
  }));

  return {
    rows: result,
    matching,
    pageCount: Math.max(1, Math.ceil(matching / PRODUCT_DATABASE_PAGE_SIZE)),
    stores: stores.map((s) => ({ id: s.id, name: s.name, count: s._count.products })),
    categories,
    overview,
  };
}

async function loadOverview(): Promise<ProductDatabaseOverview> {
  const base: Prisma.ProductWhereInput = PRODUCTS_ONLY;
  const [total, withImage, approved, pending] = await Promise.all([
    prisma.product.count({ where: base }),
    prisma.product.count({ where: { ...base, imageUrl: { not: null } } }),
    prisma.product.count({ where: { ...base, status: "APPROVED" } }),
    prisma.product.count({ where: { ...base, status: "PENDING" } }),
  ]);
  return { total, withImage, approved, pending };
}

// Valgmuligheder til mærke-/sub brand-dropdowns. Sub brands indsnævres til
// de valgte mærker, så listen er relevant og kort.
export async function loadProductDatabaseSuggestions(brands: string[]) {
  const [brandRows, subbrands] = await Promise.all([
    prisma.brand.findMany({
      where: { products: { some: PRODUCTS_ONLY } },
      orderBy: { name: "asc" },
      select: { name: true },
      take: 3000,
    }),
    prisma.product.findMany({
      where: {
        privateOwnerId: null,
        subbrand: { not: null },
        ...(brands.length > 0 ? { OR: brands.map((name) => ({ brand: { name: { equals: name, ...insensitive } } })) } : {}),
      },
      distinct: ["subbrand"],
      orderBy: { subbrand: "asc" },
      select: { subbrand: true },
      take: 1000,
    }),
  ]);
  return {
    brands: brandRows.map((b) => b.name),
    subbrands: subbrands.map((s) => s.subbrand).filter((s): s is string => Boolean(s && s.trim())),
  };
}
