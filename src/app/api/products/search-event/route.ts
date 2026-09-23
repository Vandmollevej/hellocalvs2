import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

function validHour(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 0 && value <= 23 ? value : null;
}

// POST /api/products/search-event
// Records aggregate region/brand click statistics (2026-09-19, see
// docs/DECISIONS.md) used by src/lib/product-search-ranking.ts. Never stores
// the raw query text or who clicked. The personal click history lives in
// the user's encrypted vault (docs/PRIVACY.md, src/lib/vault/handlers/search.ts).
// Body: { productId?: string, ingredientId?: string, localHour: 0..23 }
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId : null;
  const ingredientId = typeof body.ingredientId === "string" ? body.ingredientId : null;
  const genericIngredientId =
    typeof body.genericIngredientId === "string" ? body.genericIngredientId : null;
  const localHour = validHour(body.localHour);

  const targetCount = [productId, ingredientId, genericIngredientId].filter(Boolean).length;
  if (targetCount !== 1 || localHour === null) {
    return NextResponse.json({ message: "Ugyldig søgehændelse" }, { status: 400 });
  }

  try {
    const sessionUser = await getSessionUser();
    const region = sessionUser?.region ?? "DK";
    const now = new Date();

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { brandId: true },
      });

      await prisma.$transaction([
        prisma.productRegionSearchStat.upsert({
          where: { productId_region: { productId, region } },
          create: {
            productId,
            region,
            clickCount: 1,
            lastClickedAt: now,
          },
          update: {
            clickCount: { increment: 1 },
            lastClickedAt: now,
          },
        }),
        prisma.productRegionHourStat.upsert({
          where: { productId_region_hour: { productId, region, hour: localHour } },
          create: {
            productId,
            region,
            hour: localHour,
            clickCount: 1,
            lastClickedAt: now,
          },
          update: {
            clickCount: { increment: 1 },
            lastClickedAt: now,
          },
        }),
        ...(product?.brandId
          ? [
              prisma.brandRegionSearchStat.upsert({
                where: { brandId_region: { brandId: product.brandId, region } },
                create: { brandId: product.brandId, region, clickCount: 1, lastClickedAt: now },
                update: { clickCount: { increment: 1 }, lastClickedAt: now },
              }),
            ]
          : []),
      ]);
    } else if (ingredientId) {
      await prisma.$transaction([
        prisma.ingredientRegionSearchStat.upsert({
          where: { ingredientId_region: { ingredientId, region } },
          create: {
            ingredientId,
            region,
            clickCount: 1,
            lastClickedAt: now,
          },
          update: {
            clickCount: { increment: 1 },
            lastClickedAt: now,
          },
        }),
        prisma.ingredientRegionHourStat.upsert({
          where: { ingredientId_region_hour: { ingredientId, region, hour: localHour } },
          create: {
            ingredientId,
            region,
            hour: localHour,
            clickCount: 1,
            lastClickedAt: now,
          },
          update: {
            clickCount: { increment: 1 },
            lastClickedAt: now,
          },
        }),
      ]);
    } else if (genericIngredientId) {
      await prisma.$transaction([
        prisma.genericIngredientRegionSearchStat.upsert({
          where: { ingredientId_region: { ingredientId: genericIngredientId, region } },
          create: {
            ingredientId: genericIngredientId,
            region,
            clickCount: 1,
            lastClickedAt: now,
          },
          update: {
            clickCount: { increment: 1 },
            lastClickedAt: now,
          },
        }),
        prisma.genericIngredientRegionHourStat.upsert({
          where: {
            ingredientId_region_hour: { ingredientId: genericIngredientId, region, hour: localHour },
          },
          create: {
            ingredientId: genericIngredientId,
            region,
            hour: localHour,
            clickCount: 1,
            lastClickedAt: now,
          },
          update: {
            clickCount: { increment: 1 },
            lastClickedAt: now,
          },
        }),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Search click tracking failed", error);
    return NextResponse.json({ message: "Kunne ikke registrere søgehændelsen" }, { status: 503 });
  }
}
