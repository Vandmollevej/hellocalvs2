import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { IMPORTED_DISH_SOURCES } from "@/lib/meal-kit-providers";
import { LIST_PROBLEMS, rowProblems, type ListProblem } from "@/lib/admin-list-problems";

// Admin → Retter (docs/DECISIONS.md 2026-09-28): opskrifter er ikke
// produkter. Brugeroprettede = delte brugerretter (SharedRecipe — private
// retter i brugernes egne lister vises aldrig, docs/PRIVACY.md). HelloFresh,
// RetNemt, BetterFeast og Valdemarsro = importernes retter (Product-rækker
// med den kilde, docs/DECISIONS.md 2026-10-10).

export type ImportedDishSource = (typeof IMPORTED_DISH_SOURCES)[number];

// Listens sti pr. kilde; måltidskassernes retter åbnes på en visningsside
// under stien, Valdemarsro-retter som produktsiden.
export const DISH_SOURCE_PATHS: Record<ImportedDishSource, string> = {
  HELLOFRESH: "/admin/dishes/hellofresh",
  RETNEMT: "/admin/dishes/retnemt",
  BETTERFEAST: "/admin/dishes/betterfeast",
  VALDEMARSRO: "/admin/dishes/valdemarsro",
};

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
  // Deaktiveret af admin eller af importens linktjek (Product.discontinued):
  // vises ikke for brugerne.
  disabled: boolean;
  // Slettet af admin (kun i "Slettede"-visningen).
  deleted: boolean;
  // Ret uden kalorietal (kcal ≤ 0) — flages rødt.
  nutritionMissing: boolean;
  // Antal ingredienser; null når rækketypen ikke har en ingrediensliste.
  ingredientCount: number | null;
};

export type DishOverview = {
  // Aktive retter i kilden (uden slettede) og hvor mange der mangler noget.
  total: number;
  missingImage: number;
  missingNutrition: number;
  missingIngredients: number;
  deleted: number;
};

export type DishPage = { rows: DishRow[]; total: number; pageCount: number; page: number; overview: DishOverview };

export type DishParams = {
  q: string;
  page: number;
  deleted: boolean;
  problem: ListProblem | "";
};

export type DishSearchParams = {
  q?: string | string[];
  page?: string | string[];
  deleted?: string | string[];
  problem?: string | string[];
};

export function parseDishParams(params: DishSearchParams): DishParams {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = first(params.q).trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const problem = (LIST_PROBLEMS as readonly string[]).includes(first(params.problem)) ? (first(params.problem) as ListProblem) : "";
  return { q, page, deleted: first(params.deleted) === "1", problem };
}

function words(q: string) {
  return q.split(/\s+/).filter(Boolean).slice(0, 8);
}

// Kun HelloFresh-importen skriver ingredienslinjer pr. ret (product_ingredients);
// de andre kilder flages ikke for manglende ingredienser.
function hasIngredientList(source: ImportedDishSource) {
  return source === "HELLOFRESH";
}

function productProblemWhere(problem: ListProblem, source: ImportedDishSource): Prisma.ProductWhereInput {
  switch (problem) {
    case "image":
      return { imageUrl: null };
    case "nutrition":
      return { kcalPer100g: { lte: 0 } };
    case "ingredients":
      return hasIngredientList(source) ? { ingredients: { none: {} } } : { id: "" };
  }
}

export async function loadImportedDishes(
  q: string,
  page: number,
  source: ImportedDishSource,
  options: { deleted?: boolean; problem?: ListProblem | "" } = {},
): Promise<DishPage> {
  const deleted = options.deleted === true;
  const live: Prisma.ProductWhereInput = { externalSource: source, deletedAt: null };
  const where: Prisma.ProductWhereInput = {
    externalSource: source,
    deletedAt: deleted ? { not: null } : null,
    AND: [
      ...words(q).map((word) => ({ name: { contains: word, mode: "insensitive" as const } })),
      ...(options.problem && !deleted ? [productProblemWhere(options.problem, source)] : []),
    ],
  };
  const [total, products, activeTotal, missingImage, missingNutrition, missingIngredients, deletedCount] = await Promise.all([
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
        deletedAt: true,
        _count: { select: { ingredients: true } },
      },
    }),
    prisma.product.count({ where: live }),
    prisma.product.count({ where: { ...live, imageUrl: null } }),
    prisma.product.count({ where: { ...live, kcalPer100g: { lte: 0 } } }),
    hasIngredientList(source) ? prisma.product.count({ where: { ...live, ingredients: { none: {} } } }) : Promise.resolve(0),
    prisma.product.count({ where: { externalSource: source, deletedAt: { not: null } } }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / DISHES_PAGE_SIZE)),
    overview: { total: activeTotal, missingImage, missingNutrition, missingIngredients, deleted: deletedCount },
    rows: products.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      kcal: p.kcalPer100g,
      kcalLabel: "kcal/100 g",
      status: p.status,
      href: source === "VALDEMARSRO" ? `/add/${encodeURIComponent(p.id)}` : `${DISH_SOURCE_PATHS[source]}/${encodeURIComponent(p.id)}`,
      note: p._count.ingredients > 0 ? `${p._count.ingredients} ingredienser` : null,
      disabled: p.discontinued,
      deleted: p.deletedAt !== null,
      nutritionMissing: p.kcalPer100g <= 0,
      ingredientCount: hasIngredientList(source) ? p._count.ingredients : null,
    })),
  };
}

function recipeProblemWhere(problem: ListProblem): Prisma.SharedRecipeWhereInput {
  switch (problem) {
    case "image":
      return { images: { isEmpty: true } };
    case "nutrition":
      return { kcal: { lte: 0 } };
    case "ingredients":
      return { id: "" };
  }
}

export async function loadUserDishes(
  q: string,
  page: number,
  options: { deleted?: boolean; problem?: ListProblem | "" } = {},
): Promise<DishPage> {
  const deleted = options.deleted === true;
  const where: Prisma.SharedRecipeWhereInput = {
    deletedAt: deleted ? { not: null } : null,
    AND: [
      ...words(q).map((word) => ({ searchText: { contains: word.toLowerCase() } })),
      ...(options.problem && !deleted ? [recipeProblemWhere(options.problem)] : []),
    ],
  };
  const [total, recipes, activeTotal, missingImage, missingNutrition, deletedCount] = await Promise.all([
    prisma.sharedRecipe.count({ where }),
    prisma.sharedRecipe.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * DISHES_PAGE_SIZE,
      take: DISHES_PAGE_SIZE,
      select: { id: true, name: true, images: true, kcal: true, status: true, totalGrams: true, deletedAt: true },
    }),
    prisma.sharedRecipe.count({ where: { deletedAt: null } }),
    prisma.sharedRecipe.count({ where: { deletedAt: null, images: { isEmpty: true } } }),
    prisma.sharedRecipe.count({ where: { deletedAt: null, kcal: { lte: 0 } } }),
    prisma.sharedRecipe.count({ where: { deletedAt: { not: null } } }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / DISHES_PAGE_SIZE)),
    overview: { total: activeTotal, missingImage, missingNutrition, missingIngredients: 0, deleted: deletedCount },
    rows: recipes.map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.images[0] ?? null,
      kcal: r.kcal,
      kcalLabel: "kcal i alt",
      status: r.status,
      href: r.status === "PENDING" ? "/admin/quality-control/shared-recipes" : null,
      note: r.totalGrams > 0 ? `${Math.round(r.totalGrams)} g` : null,
      // En afvist bruger-ret er skjult for andre, så rækken står som deaktiveret.
      disabled: r.status === "REJECTED",
      deleted: r.deletedAt !== null,
      nutritionMissing: r.kcal <= 0,
      ingredientCount: null,
    })),
  };
}

// Rækkens mangler til flagning (rød kant + tekst) — samme regler som tællerne.
export function dishProblems(row: DishRow): ListProblem[] {
  if (row.deleted) return [];
  return rowProblems({ imageUrl: row.imageUrl, nutritionMissing: row.nutritionMissing, ingredientCount: row.ingredientCount });
}
