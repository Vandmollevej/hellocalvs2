import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PRODUCTS_ONLY } from "@/lib/admin-product-database";

// Admin "Produkt-database → Brands" (docs/DECISIONS.md 2026-09-28): alle
// brands med logo (Brand.logoUrl) og antal produkter. Produktantallet
// tæller som Produkter-listen (uden private ingredienser og retter).

export const ADMIN_BRANDS_PAGE_SIZE = 120;

export type AdminBrandsFilters = {
  q: string;
  logo: "with" | "without" | "";
  page: number;
};

export type AdminBrandsSearchParams = Partial<Record<keyof AdminBrandsFilters, string | string[]>>;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseAdminBrandsFilters(params: AdminBrandsSearchParams): AdminBrandsFilters {
  const logo = one(params.logo);
  const page = Number.parseInt(one(params.page), 10);
  return {
    q: one(params.q).slice(0, 200),
    logo: logo === "with" || logo === "without" ? logo : "",
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

export function adminBrandsHref(filters: AdminBrandsFilters, changes: Partial<AdminBrandsFilters> = {}) {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.logo) params.set("logo", next.logo);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/admin/product-database/brands?${query}` : "/admin/product-database/brands";
}

export type AdminBrandRow = {
  id: string;
  name: string;
  logoUrl: string | null;
  productCount: number;
};

export async function loadAdminBrands(filters: AdminBrandsFilters) {
  const and: Prisma.BrandWhereInput[] = [];
  if (filters.q) and.push({ name: { contains: filters.q, mode: "insensitive" } });
  if (filters.logo === "with") and.push({ logoUrl: { not: null } });
  if (filters.logo === "without") and.push({ logoUrl: null });
  // Brands uden mindst to bogstaver/tal i navnet (fx «'s» og «/») er rester fra
  // import og vises ikke.
  const junk = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM brands WHERE length(regexp_replace(name, '[^[:alnum:]]', '', 'g')) < 2
  `;
  const notJunk: Prisma.BrandWhereInput = junk.length > 0 ? { id: { notIn: junk.map((row) => row.id) } } : {};
  and.push(notJunk);
  const where: Prisma.BrandWhereInput = { AND: and };

  const [total, withLogo, matching] = await Promise.all([
    prisma.brand.count({ where: notJunk }),
    prisma.brand.count({ where: { logoUrl: { not: null }, ...notJunk } }),
    prisma.brand.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(matching / ADMIN_BRANDS_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const brands = await prisma.brand.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * ADMIN_BRANDS_PAGE_SIZE,
    take: ADMIN_BRANDS_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      logoUrl: true,
      _count: { select: { products: { where: PRODUCTS_ONLY } } },
    },
  });

  const rows: AdminBrandRow[] = brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    logoUrl: brand.logoUrl,
    productCount: brand._count.products,
  }));

  return { rows, total, withLogo, matching, page, pageCount };
}
