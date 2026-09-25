import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  parseIngredients,
  publisherHashForUser,
  searchTextFor,
  toPublicRecipe,
  totalsFor,
} from "@/lib/shared-recipes";
import { filtersFromParams, type RecipeNutrient } from "@/lib/recipe-filters";
import {
  energyPercents,
  evaluateRecipe,
  needsIngredientData,
  type RecipeFacts,
  type RecipeWarning,
} from "@/lib/recipe-filter-match";
import { portionKcalFor, servingsFor } from "@/lib/recipe-portions";

// Delte brugeropskrifter (docs/DECISIONS.md 2026-09-24).
//
// GET ?q=&sort=relevance|popular|date&hellofresh=1 — søg i delte retter.
// Afviste retter og retter fra blokerede udgivere vises ikke. Med
// hellofresh=1 (brugeren har slået HelloFresh til under Integrationer)
// medtages HelloFresh-opskrifterne i samme liste.
//
// Filtre (docs/DECISIONS.md 2026-09-25, src/lib/recipe-filters.ts):
// allergens=, diets=, nutrients= (kommaseparerede) og protein=/carbs=/fat=
// (high|low). Hver ret får også serveringer ud fra brugerens anbefalede
// portion (src/lib/recipe-portions.ts), energifordeling og allergiadvarsler.

type Item = {
  kind: "shared" | "hellofresh";
  id: string;
  name: string;
  imageUrl: string | null;
  // Hele retten (delte retter) eller én servering (HelloFresh).
  kcal: number;
  servings: number;
  split: { protein: number; carbs: number; fat: number } | null;
  warnings: RecipeWarning[];
  popularity: number;
  createdAt: string;
  score: number;
};

function relevance(name: string, searchText: string, q: string) {
  if (!q) return 0;
  const lower = name.toLowerCase();
  if (lower.startsWith(q)) return 3;
  if (lower.includes(q)) return 2;
  return searchText.includes(q) ? 1 : 0;
}

const PRODUCT_FACTS_SELECT = {
  id: true,
  name: true,
  ingredientsText: true,
  allergens: true,
  servingSizeGrams: true,
  nutritionExtra: true,
  vitaminAPer100g: true,
  vitaminCPer100g: true,
  nutritionFeatures: { select: { fiberPer100g: true, sugarsPer100g: true } },
} satisfies Prisma.ProductSelect;
type ProductFacts = Prisma.ProductGetPayload<{ select: typeof PRODUCT_FACTS_SELECT }>;

// HelloFresh-værdier i nutritionExtra er pr. servering (se
// scripts/hellofresh-import/agent.py); her omregnet til pr. 100 g.
const EXTRA_KEYS: Partial<Record<RecipeNutrient | "sugar", string>> = {
  fiber: "fiberG",
  iron: "ironMg",
  calcium: "calciumMg",
  potassium: "potassiumMg",
  sugar: "sugarG",
};

function per100g(product: ProductFacts | undefined, key: RecipeNutrient | "sugar"): number | null {
  if (!product) return null;
  if (key === "fiber" && product.nutritionFeatures?.fiberPer100g != null) return product.nutritionFeatures.fiberPer100g;
  if (key === "sugar" && product.nutritionFeatures?.sugarsPer100g != null) return product.nutritionFeatures.sugarsPer100g;
  if (key === "vitaminA") return product.vitaminAPer100g;
  if (key === "vitaminC") return product.vitaminCPer100g;
  const extraKey = EXTRA_KEYS[key];
  const extra = product.nutritionExtra as Record<string, unknown> | null;
  const value = extraKey && extra ? extra[extraKey] : undefined;
  if (typeof value !== "number" || !product.servingSizeGrams) return null;
  return (value / product.servingSizeGrams) * 100;
}

const NUTRIENT_KEYS: RecipeNutrient[] = ["fiber", "iron", "calcium", "potassium", "vitaminA", "vitaminC"];

// Summerer et næringsstof over ingredienserne. Ukendt, hvis ingredienser
// uden værdien udgør mere end 20 % af rettens vægt.
function totalOf(parts: { grams: number; product?: ProductFacts }[], key: RecipeNutrient | "sugar") {
  const totalGrams = parts.reduce((sum, p) => sum + p.grams, 0);
  let known = 0;
  let amount = 0;
  for (const part of parts) {
    const value = per100g(part.product, key);
    if (value === null) continue;
    known += part.grams;
    amount += (value * part.grams) / 100;
  }
  if (totalGrams <= 0 || known / totalGrams < 0.8) return { amount: null, totalGrams };
  return { amount, totalGrams };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  const filters = filtersFromParams(params);
  const includeHelloFresh = params.get("hellofresh") === "1";
  const withIngredientData = needsIngredientData(filters);

  try {
    const user = await getSessionUser();
    const portionKcal = portionKcalFor(user);
    const blocked = await prisma.sharedRecipePublisherBlock.findMany({ select: { publisherHash: true } });
    const recipes = await prisma.sharedRecipe.findMany({
      where: {
        status: { not: "REJECTED" },
        publisherHash: { notIn: blocked.map((b) => b.publisherHash) },
        ...(q ? { searchText: { contains: q } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const parsed = recipes.map((r) => ({ recipe: r, ingredients: parseIngredients(r.ingredients) ?? [] }));
    const productIds = withIngredientData
      ? Array.from(new Set(parsed.flatMap((p) => p.ingredients.map((i) => i.productId))))
      : [];
    const products = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: PRODUCT_FACTS_SELECT })
      : [];
    const productById = new Map(products.map((p) => [p.id, p]));

    const items: Item[] = [];
    for (const { recipe: r, ingredients } of parsed) {
      const parts = ingredients.map((i) => ({ grams: i.grams, product: productById.get(i.productId) }));
      const sugar = withIngredientData ? totalOf(parts, "sugar") : null;
      const facts: RecipeFacts = {
        title: r.name,
        segments: ingredients.map((i) => {
          const product = productById.get(i.productId);
          return {
            name: i.name,
            text: product ? `${product.name} ${product.ingredientsText ?? ""}` : "",
            allergens: product?.allergens ?? [],
          };
        }),
        kcal: r.kcal,
        proteinG: r.protein,
        carbsG: r.carbs,
        fatG: r.fat,
        nutrients: withIngredientData
          ? Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, totalOf(parts, key).amount]))
          : {},
        sugarPer100g:
          sugar?.amount != null && sugar.totalGrams > 0 ? (sugar.amount / sugar.totalGrams) * 100 : null,
      };
      const result = evaluateRecipe(facts, filters);
      if (!result.pass) continue;
      items.push({
        kind: "shared",
        id: r.id,
        name: r.name,
        imageUrl: null,
        kcal: Math.round(r.kcal),
        servings: servingsFor(r.kcal, portionKcal),
        split: energyPercents(facts),
        warnings: result.warnings,
        popularity: r.popularity,
        createdAt: r.createdAt.toISOString(),
        score: relevance(r.name, r.searchText, q),
      });
    }

    if (includeHelloFresh) {
      const hfProducts = await prisma.product.findMany({
        where: {
          externalSource: "HELLOFRESH",
          discontinued: false,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { ingredientsText: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          ...PRODUCT_FACTS_SELECT,
          imageUrl: true,
          kcalPer100g: true,
          proteinPer100g: true,
          carbsPer100g: true,
          fatPer100g: true,
          createdAt: true,
        },
      });
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const usage = hfProducts.length
        ? await prisma.registration.groupBy({
            by: ["productId"],
            where: { productId: { in: hfProducts.map((p) => p.id) }, createdAt: { gte: cutoff } },
            _count: { _all: true },
          })
        : [];
      const usageById = new Map(usage.map((u) => [u.productId, u._count._all]));
      for (const p of hfProducts) {
        // Én servering af opskriften.
        const grams = p.servingSizeGrams ?? 100;
        const f = grams / 100;
        const facts: RecipeFacts = {
          title: p.name,
          segments: [{ name: p.name, text: p.ingredientsText ?? "", allergens: p.allergens }],
          kcal: p.kcalPer100g * f,
          proteinG: p.proteinPer100g * f,
          carbsG: p.carbsPer100g * f,
          fatG: p.fatPer100g * f,
          nutrients: Object.fromEntries(
            NUTRIENT_KEYS.map((key) => {
              const value = per100g(p, key);
              return [key, value === null ? null : value * f];
            }),
          ),
          sugarPer100g: per100g(p, "sugar"),
        };
        const result = evaluateRecipe(facts, filters);
        if (!result.pass) continue;
        items.push({
          kind: "hellofresh",
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          kcal: Math.round(facts.kcal),
          servings: 1,
          split: energyPercents(facts),
          warnings: result.warnings,
          popularity: usageById.get(p.id) ?? 0,
          createdAt: p.createdAt.toISOString(),
          score: relevance(p.name, `${p.name} ${p.ingredientsText ?? ""}`.toLowerCase(), q),
        });
      }
    }

    const sort = filters.sort;
    items.sort((a, b) => {
      if (sort === "popular") return b.popularity - a.popularity || b.createdAt.localeCompare(a.createdAt);
      if (sort === "date") return b.createdAt.localeCompare(a.createdAt);
      return b.score - a.score || b.popularity - a.popularity || b.createdAt.localeCompare(a.createdAt);
    });

    return NextResponse.json({
      portionKcal,
      recipes: items.slice(0, 60).map((item) => ({
        kind: item.kind,
        id: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        kcal: item.kcal,
        servings: item.servings,
        split: item.split && {
          protein: Math.round(item.split.protein),
          carbs: Math.round(item.split.carbs),
          fat: Math.round(item.split.fat),
        },
        warnings: item.warnings,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("Shared recipe search failed", error);
    return NextResponse.json({ recipes: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// POST { name, language, ingredients } — del en ret direkte (bruges af
// PATCH /api/dishes/[id]/share). Retten er synlig med det samme og venter
// på admin-godkendelse.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const publisherHash = publisherHashForUser(user.id);

  const blocked = await prisma.sharedRecipePublisherBlock.findUnique({ where: { publisherHash } });
  if (blocked) return NextResponse.json({ message: "Du kan ikke dele retter i øjeblikket" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const language = body?.language === "en" ? "en" : "da";
  const ingredients = parseIngredients(body?.ingredients);
  if (!name || !ingredients) return NextResponse.json({ message: "Ugyldig ret" }, { status: 400 });

  const recipe = await prisma.sharedRecipe.create({
    data: {
      publisherHash,
      name,
      language,
      ingredients,
      searchText: searchTextFor(name, ingredients),
      ...totalsFor(ingredients),
    },
  });
  return NextResponse.json({ recipe: toPublicRecipe(recipe) }, { status: 201 });
}
