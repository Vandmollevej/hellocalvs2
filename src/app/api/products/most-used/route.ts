import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { getRetentionCutoffDate, getUserSubscriptionTier } from "@/lib/subscription";
import { productImageForViewer } from "@/lib/product-display-image";

const MOST_USED_LIMIT = 10;

// GET /api/products/most-used — Madvarer-sidens "Mest brugte": profilens
// oftest registrerede varer, talt i databasen. Erstatter klientens tidligere
// opslag (alle registreringer + de 20 nyeste varer i hele databasen), som var
// langsomt og kun fandt varer blandt de 20 nyeste. Samme historikgrænse som
// /api/registrations (gratisbrugere ser 30 dage).
export async function GET() {
  try {
    const user = await getProfileUser("registrations", "VIEWED");
    if (!user) return unauthorized();

    const cutoff = getRetentionCutoffDate(await getUserSubscriptionTier(user.id));
    const counts = await prisma.registration.groupBy({
      by: ["productId"],
      where: {
        userId: user.id,
        productId: { not: null },
        ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
      },
      _count: { productId: true },
      orderBy: { _count: { productId: "desc" } },
      // Lidt ekstra, da udgåede/skjulte varer sorteres fra nedenfor.
      take: MOST_USED_LIMIT * 2,
    });
    const orderedIds = counts.map((row) => row.productId).filter((id): id is string => Boolean(id));

    const products = await prisma.product.findMany({
      where: {
        id: { in: orderedIds },
        discontinued: false,
        nutritionMissing: false,
        OR: [{ privateOwnerId: null }, { privateOwnerId: user.id }],
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        pendingImageUrl: true,
        createdByUserId: true,
        kcalPer100g: true,
        brand: { select: { name: true } },
      },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    return NextResponse.json({
      profileId: user.id,
      products: orderedIds
        .map((id) => byId.get(id))
        .filter((product): product is NonNullable<typeof product> => Boolean(product))
        .slice(0, MOST_USED_LIMIT)
        .map((product) => ({
          id: product.id,
          name: product.name,
          imageUrl: productImageForViewer(product, user.id),
          kcalPer100g: product.kcalPer100g,
          brand: product.brand,
        })),
    });
  } catch (error) {
    console.error("Most used products failed", error);
    return NextResponse.json({ products: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
