import { NextResponse } from "next/server";
import { GenericIngredientCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
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
    const region = sessionUser?.region ?? "DK";
    // docs/PRIVACY.md: personlig søgehistorik ligger i boksen; med
    // ?personal=1 rangerer enheden selv (src/lib/vault/handlers/search.ts).
    const personalRank = params.get("personal") === "1";
    let personalHistoryWeight: number | null = null;
    const scoreById = new Map<string, number>();

    let results = ingredients;
    if (q) {
      const weights = await getActiveSearchRankingWeights();
      if (personalRank) personalHistoryWeight = weights.personalHistory;

      const rankable = ingredients.map((ingredient) => ({
        ...ingredient,
        brand: null as { name: string } | null,
        barcodes: [] as { code: string }[],
        entityBias: 1, // "Generiske ingredienser vs. varer" — en GenericIngredient
      }));
      const ranked = rankProducts(rankable, q, region, localHour, personalRank ? take * 2 : take, weights);
      for (const entry of ranked) scoreById.set(entry.product.id, entry.score);
      results = ranked.map((entry) => entry.product);

      if (results.length > 0) {
        const now = new Date();
        await prisma.$transaction([
          ...results.map((ingredient) =>
            prisma.genericIngredientRegionSearchStat.upsert({
              where: { ingredientId_region: { ingredientId: ingredient.id, region } },
              create: { ingredientId: ingredient.id, region, searchCount: 1, lastSearchedAt: now },
              update: { searchCount: { increment: 1 }, lastSearchedAt: now },
            })
          ),
        ]);
      }
    } else {
      results = results.slice(0, take);
    }

    const publicIngredients = results.map((ingredient) => {
      /* eslint-disable @typescript-eslint/no-unused-vars -- hidden ranking stats/inputs, never sent to the client */
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
      /* eslint-enable @typescript-eslint/no-unused-vars */
      return personalRank ? { ...rest, rankScore: scoreById.get(rest.id) ?? 0 } : rest;
    });
    return NextResponse.json({
      ingredients: publicIngredients,
      ...(personalRank ? { personalHistoryWeight } : {}),
    });
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
      select: {
        id: true,
        name: true,
        kcalPer100g: true,
        proteinPer100g: true,
        carbsPer100g: true,
        fatPer100g: true,
        micronutrientsPer100g: true,
      },
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
        // Frida-mikrodata kopieres med (docs/DECISIONS.md 2026-09-24).
        micronutrientsPer100g: match?.micronutrientsPer100g ?? undefined,
        createdByUserId: sessionUser?.id,
      },
    });

    return NextResponse.json({ ingredient });
  } catch (error) {
    console.error("Generic ingredient create failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
