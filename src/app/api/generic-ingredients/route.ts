import { NextResponse } from "next/server";
import { GenericIngredientCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser, getSessionUser } from "@/lib/session";
import { rankProducts } from "@/lib/product-search-ranking";
import { getActiveSearchRankingWeights } from "@/lib/search-ranking-config";
import { matchFridaProduct } from "@/lib/generic-ingredient-match";

// GET /api/generic-ingredients?q=æble — search generic (non-scanned)
// ingredients, e.g. for the "Ingrediens" branch of manual food creation
// (src/app/foods/new/page.tsx) and later reuse across the search screens.
// Ranked with the same text/region-popularity model as ordinary products
// (src/lib/product-search-ranking.ts, docs/DECISIONS.md 2026-09-19) — the
// generic-ingredient row has no brand/barcodes, so those fields are just
// passed as empty.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const take = Math.min(Math.max(parseInt(params.get("take") ?? "20", 10) || 20, 1), 100);
  const localHour = new Date().getHours();

  try {
    const ingredients = await prisma.genericIngredient.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      include: { regionSearchStats: true, regionHourStats: true },
      take: q ? Math.max(take * 4, 60) : take,
      orderBy: { createdAt: "desc" },
    });

    const sessionUser = await getSessionUser();
    const user = sessionUser ?? (await getEffectiveUser());

    let results = ingredients;
    if (q) {
      const weights = await getActiveSearchRankingWeights();

      // Personlig historik (2026-09-19, se docs/DECISIONS.md) — kun for en
      // rigtig indlogget bruger, aldrig den delte demo-bruger.
      const personalHistory = sessionUser
        ? await prisma.userProductSearchHistory.findMany({
            where: { userId: sessionUser.id, genericIngredientId: { in: ingredients.map((i) => i.id) } },
          })
        : [];
      const personalByIngredientId = new Map(
        personalHistory.map((entry) => [entry.genericIngredientId, entry])
      );

      const rankable = ingredients.map((ingredient) => ({
        ...ingredient,
        brand: null as { name: string } | null,
        barcodes: [] as { code: string }[],
        personalSearchCount: personalByIngredientId.get(ingredient.id)?.searchCount,
        personalClickCount: personalByIngredientId.get(ingredient.id)?.clickCount,
        entityBias: 1, // "Generiske ingredienser vs. varer" — en GenericIngredient
      }));
      const ranked = rankProducts(rankable, q, user.region, localHour, take, weights);
      results = ranked.map((entry) => entry.product);

      if (results.length > 0) {
        const now = new Date();
        await prisma.$transaction([
          ...results.map((ingredient) =>
            prisma.genericIngredientRegionSearchStat.upsert({
              where: { ingredientId_region: { ingredientId: ingredient.id, region: user.region } },
              create: { ingredientId: ingredient.id, region: user.region, searchCount: 1, lastSearchedAt: now },
              update: { searchCount: { increment: 1 }, lastSearchedAt: now },
            })
          ),
          ...(sessionUser
            ? results.map((ingredient) =>
                prisma.userProductSearchHistory.upsert({
                  where: {
                    userId_genericIngredientId: { userId: sessionUser.id, genericIngredientId: ingredient.id },
                  },
                  create: {
                    userId: sessionUser.id,
                    genericIngredientId: ingredient.id,
                    searchCount: 1,
                    lastSearchedAt: now,
                  },
                  update: { searchCount: { increment: 1 }, lastSearchedAt: now },
                })
              )
            : []),
        ]);
      }
    } else {
      results = results.slice(0, take);
    }

    const publicIngredients = results.map((ingredient) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- hidden ranking stats/inputs, never sent to the client
      const {
        regionSearchStats,
        regionHourStats,
        brand,
        barcodes,
        personalSearchCount,
        personalClickCount,
        entityBias,
        ...rest
      } = ingredient as typeof ingredient & {
        brand?: unknown;
        barcodes?: unknown;
        personalSearchCount?: unknown;
        personalClickCount?: unknown;
        entityBias?: unknown;
      };
      return rest;
    });
    return NextResponse.json({ ingredients: publicIngredients });
  } catch (error) {
    console.error("Generic ingredient search failed", error);
    return NextResponse.json(
      { ingredients: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// POST /api/generic-ingredients — manual creation of a generic (non-scanned)
// ingredient (fruit/vegetable/meat sold loose, no brand/packaging). Nutrition
// per 100g is never typed by the user (there is no energideklaration to
// read) — resolved once here from the closest-matching Frida reference
// product and copied onto the row, see src/lib/generic-ingredient-match.ts.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const categoryRaw = typeof body.category === "string" ? body.category : "";
  const category = (Object.values(GenericIngredientCategory) as string[]).includes(categoryRaw)
    ? (categoryRaw as GenericIngredientCategory)
    : GenericIngredientCategory.OTHER;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;

  if (!name) {
    return NextResponse.json({ message: "Navn skal udfyldes" }, { status: 400 });
  }

  try {
    const sessionUser = await getSessionUser();

    const fridaCandidates = await prisma.product.findMany({
      where: { externalSource: "FRIDA" },
      select: { id: true, name: true, kcalPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
    });
    const match = matchFridaProduct(name, fridaCandidates);

    const ingredient = await prisma.genericIngredient.create({
      data: {
        name,
        category,
        imageUrl,
        fridaProductId: match?.id,
        kcalPer100g: match?.kcalPer100g,
        proteinPer100g: match?.proteinPer100g,
        carbsPer100g: match?.carbsPer100g,
        fatPer100g: match?.fatPer100g,
        createdByUserId: sessionUser?.id,
      },
    });

    return NextResponse.json({ ingredient });
  } catch (error) {
    console.error("Generic ingredient create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
