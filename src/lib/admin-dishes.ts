import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Admin → Retter (docs/DECISIONS.md 2026-09-28): opskrifter er ikke
// produkter. Brugeroprettede = delte brugerretter (SharedRecipe — private
// retter i brugernes egne lister vises aldrig, docs/PRIVACY.md), HelloFresh =
// HelloFresh-importens retter (Product-rækker med kilde HELLOFRESH).

export const DISHES_PAGE_SIZE = 48;

export type DishRow = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcal: number;
  kcalLabel: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  href: string | null;
  note: string | null;
  // Deaktiveret i admin (Product.discontinued) — vises ikke for brugerne.
  disabled: boolean;
};

export type DishPage = { rows: DishRow[]; total: number; pageCount: number; page: number };

export function parseDishParams(params: { q?: string | string[]; page?: string | string[] }) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = first(params.q).trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  return { q, page };
}

function words(q: string) {
  return q.split(/\s+/).filter(Boolean).slice(0, 8);
}

// Integrationernes retter (Product-rækker med kilde HELLOFRESH eller VALDEMARSRO).
export async function loadHelloFreshDishes(
  q: string,
  page: number,
  source: "HELLOFRESH" | "VALDEMARSRO" = "HELLOFRESH",
): Promise<DishPage> {
  const where: Prisma.ProductWhereInput = {
    externalSource: source,
    AND: words(q).map((word) => ({ name: { contains: word, mode: "insensitive" as const } })),
  };
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * DISHES_PAGE_SIZE,
      take: DISHES_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        kcalPer100g: true,
        status: true,
        discontinued: true,
        _count: { select: { ingredients: true } },
      },
    }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / DISHES_PAGE_SIZE)),
    rows: products.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      kcal: p.kcalPer100g,
      kcalLabel: "kcal/100 g",
      status: p.status,
      // Valdemarsro-retter åbnes som produktsiden (tilføj, "Gå til opskrift").
      href: source === "VALDEMARSRO" ? `/add/${p.id}` : `/admin/dishes/hellofresh/${p.id}`,
      note: p._count.ingredients > 0 ? `${p._count.ingredients} ingredienser` : null,
      disabled: p.discontinued,
    })),
  };
}

export async function loadUserDishes(q: string, page: number): Promise<DishPage> {
  const where: Prisma.SharedRecipeWhereInput = {
    AND: words(q).map((word) => ({ searchText: { contains: word.toLowerCase() } })),
  };
  const [total, recipes] = await Promise.all([
    prisma.sharedRecipe.count({ where }),
    prisma.sharedRecipe.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * DISHES_PAGE_SIZE,
      take: DISHES_PAGE_SIZE,
      select: { id: true, name: true, images: true, kcal: true, status: true, totalGrams: true },
    }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / DISHES_PAGE_SIZE)),
    rows: recipes.map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.images[0] ?? null,
      kcal: r.kcal,
      kcalLabel: "kcal i alt",
      status: r.status,
      href: r.status === "PENDING" ? "/admin/quality-control/shared-recipes" : null,
      note: r.totalGrams > 0 ? `${Math.round(r.totalGrams)} g` : null,
      disabled: false,
    })),
  };
}
