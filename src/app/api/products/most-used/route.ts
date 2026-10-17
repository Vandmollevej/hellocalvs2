import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { localizedProductNames } from "@/lib/product-translations";
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
      _max: { createdAt: true },
      orderBy: { _count: { productId: "desc" } },
      // Lidt ekstra, da udgåede/skjulte varer sorteres fra nedenfor.
      take: MOST_USED_LIMIT * 2,
    });
    // Swipe → Slet: skjult, indtil varen registreres igen (MostUsedHide).
    const hides = await prisma.mostUsedHide.findMany({ where: { userId: user.id } });
    const hiddenAt = new Map(hides.map((row) => [row.productId, row.hiddenAt]));
    const usedIds = counts
      .filter((row) => {
        const since = row.productId ? hiddenAt.get(row.productId) : undefined;
        return !since || (row._max.createdAt ?? new Date(0)) > since;
      })
      .map((row) => row.productId)
      .filter((id): id is string => Boolean(id));
    // Favoritter (bogmærker) står øverst, nyeste først (brugerens krav
    // 2026-10-16); derefter de mest brugte, der ikke allerede er favoritter.
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id, productId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { productId: true },
    });
    const favoriteIds = favorites.map((row) => row.productId).filter((id): id is string => Boolean(id));
    const orderedIds = [...new Set([...favoriteIds, ...usedIds])];
    const favoriteSet = new Set(favoriteIds);

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
        language: true,
        externalSource: true,
        imageUrl: true,
        pendingImageUrl: true,
        createdByUserId: true,
        kcalPer100g: true,
        brand: { select: { name: true } },
      },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    // Varens navn på brugerens sprog (docs/DECISIONS.md 2026-10-15).
    const localized = await localizedProductNames(products, await getSessionUser().catch(() => null)).catch(
      () => new Map<string, { name: string; brandName: string | null }>(),
    );

    const available = orderedIds
      .map((id) => byId.get(id))
      .filter((product): product is NonNullable<typeof product> => Boolean(product));
    const listed = [
      ...available.filter((product) => favoriteSet.has(product.id)),
      ...available.filter((product) => !favoriteSet.has(product.id)).slice(0, MOST_USED_LIMIT),
    ];

    return NextResponse.json({
      profileId: user.id,
      products: listed.map((product) => ({
          id: product.id,
          name: localized.get(product.id)?.name ?? product.name,
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

// DELETE /api/products/most-used?productId=… — swipe → Slet: fjerner varen fra
// "Mest brugte" (og fra favoritterne, der står øverst på samme liste). Den
// kommer tilbage, når den registreres igen.
export async function DELETE(request: Request) {
  try {
    const user = await getProfileUser("registrations", "DELETED");
    if (!user) return unauthorized();
    const productId = new URL(request.url).searchParams.get("productId");
    if (!productId) return NextResponse.json({ error: "productId mangler" }, { status: 400 });
    const hiddenAt = new Date();
    await prisma.$transaction([
      prisma.mostUsedHide.upsert({
        where: { userId_productId: { userId: user.id, productId } },
        update: { hiddenAt },
        create: { userId: user.id, productId, hiddenAt },
      }),
      prisma.favorite.deleteMany({ where: { userId: user.id, productId } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/products/most-used failed", error);
    return NextResponse.json({ error: "Kunne ikke fjerne varen" }, { status: 500 });
  }
}
