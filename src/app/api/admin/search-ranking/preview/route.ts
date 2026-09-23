import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { deriveIsVerified, rankProducts, type RankableProduct } from "@/lib/product-search-ranking";
import { sanitizeWeights } from "@/lib/search-ranking-config";

const CANDIDATE_TAKE = 120;
const RESULT_TAKE = 25;

// POST /api/admin/search-ranking/preview — the Søgealgoritmer page's live
// test panel. Runs the exact same ranking function real end-user search
// uses (src/lib/product-search-ranking.ts), but against a *draft* weight
// set the admin is still tuning (never the committed one) and without any
// side effects — no impression/click counters are touched. Merges Product
// and GenericIngredient candidates into one ranked list so the "Generiske
// ingredienser vs. varer" weight's effect is actually visible (production
// search still queries them as two separate endpoints — see
// docs/DECISIONS.md, 2026-09-19).
// Body: { query: string, region: string, hour?: number, weights: SearchRankingWeights }
// Personlig historik ligger i brugernes krypterede boks (docs/PRIVACY.md) og
// kan derfor ikke forhåndsvises for en bestemt bruger her.
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const region = typeof body.region === "string" && body.region ? body.region : "DK";
  const requestedHour = Number(body.hour);
  const localHour =
    Number.isInteger(requestedHour) && requestedHour >= 0 && requestedHour <= 23
      ? requestedHour
      : new Date().getHours();
  const weights = sanitizeWeights(body.weights);

  if (query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const [products, ingredients] = await Promise.all([
      prisma.product.findMany({
        where: {
          discontinued: false,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { brand: { name: { contains: query, mode: "insensitive" } } },
          ],
          AND: { OR: [{ externalSource: null }, { externalSource: { not: "HELLOFRESH" } }] },
        },
        include: {
          brand: { include: { regionSearchStats: true } },
          barcodes: true,
          regionSearchStats: true,
          regionHourStats: true,
          _count: { select: { images: true } },
          aiAnalyses: { select: { kind: true } },
        },
        take: CANDIDATE_TAKE,
        orderBy: { createdAt: "desc" },
      }),
      prisma.genericIngredient.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        include: { regionSearchStats: true, regionHourStats: true },
        take: CANDIDATE_TAKE,
        orderBy: { createdAt: "desc" },
      }),
    ]);


    type PreviewEntry = RankableProduct & { type: "product" | "genericIngredient"; displayName: string };

    const rankableProducts: PreviewEntry[] = products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      originCountryCode: product.originCountryCode,
      barcodes: product.barcodes,
      regionSearchStats: product.regionSearchStats,
      regionHourStats: product.regionHourStats,
      brandRegionStats: product.brand?.regionSearchStats,
      isVerified: deriveIsVerified({
        barcodeCount: product.barcodes.length,
        imageCount: product._count.images,
        aiAnalyses: product.aiAnalyses,
      }),
      entityBias: -1,
      type: "product",
      displayName: product.brand ? `${product.brand.name} ${product.name}` : product.name,
    }));

    const rankableIngredients: PreviewEntry[] = ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      brand: null,
      barcodes: [],
      regionSearchStats: ingredient.regionSearchStats,
      regionHourStats: ingredient.regionHourStats,
      entityBias: 1,
      type: "genericIngredient",
      displayName: ingredient.name,
    }));

    const ranked = rankProducts(
      [...rankableProducts, ...rankableIngredients],
      query,
      region,
      localHour,
      RESULT_TAKE,
      weights
    );

    return NextResponse.json({
      results: ranked.map((entry) => ({
        id: entry.product.id,
        type: entry.product.type,
        name: entry.product.displayName,
        score: Math.round(entry.score * 100) / 100,
        similarity: Math.round(entry.similarity * 100) / 100,
        breakdown: entry.breakdown,
      })),
    });
  } catch (error) {
    console.error("Search ranking preview failed", error);
    return NextResponse.json({ results: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
