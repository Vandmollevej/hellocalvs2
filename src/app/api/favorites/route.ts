import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { localizedProductNames } from "@/lib/product-translations";
import { getProfileUser } from "@/lib/family-access";

// Favorites (fejl #31/#33/#36 i Fejlretninger/FEJLLISTE.md): en bruger kan
// markere et produkt som favorit fra en swipe-handling på en registrerings-
// række. Bruges til Søg-sidens "Favoritter"-sektion og bookmark-ikonet på
// vare-rækker. `Favorite` findes allerede i schema (også forberedt til
// Dish-favoritter, som ikke bruges endnu — ingen UI for det i dag).
export async function GET() {
  try {
    const user = await getProfileUser("favorites", "VIEWED");

    if (!user) return unauthorized();
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id, productId: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });

    // Varens navn på brugerens sprog (docs/DECISIONS.md 2026-10-15).
    const viewer = await getSessionUser().catch(() => null);
    const localized = await localizedProductNames(
      favorites.flatMap((favorite) => (favorite.product ? [favorite.product] : [])),
      viewer,
    ).catch(() => new Map<string, { name: string; brandName: string | null }>());
    return NextResponse.json({
      favorites: favorites
        .filter((favorite) => favorite.product)
        .map((favorite) => ({
          id: favorite.id,
          product: { ...favorite.product!, name: localized.get(favorite.product!.id)?.name ?? favorite.product!.name },
        })),
    });
  } catch (error) {
    console.error("Favorite list failed", error);
    return NextResponse.json({ favorites: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getProfileUser("favorites", "CREATED");

    if (!user) return unauthorized();
    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId : null;
    if (!productId) {
      return NextResponse.json({ message: "productId mangler" }, { status: 400 });
    }

    // Ikke upsert: Postgres' unikke indeks behandler NULL dishId som forskellig
    // fra enhver anden NULL, så et unikt opslag på (userId, productId, null)
    // kan ikke bruges pålideligt til konflikt-detektion her.
    const existing = await prisma.favorite.findFirst({
      where: { userId: user.id, productId, dishId: null },
    });
    const favorite = existing ?? (await prisma.favorite.create({ data: { userId: user.id, productId } }));

    return NextResponse.json({ favorite });
  } catch (error) {
    console.error("Favorite create failed", error);
    return NextResponse.json({ message: "Kunne ikke gemme favorit" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getProfileUser("favorites", "DELETED");

    if (!user) return unauthorized();
    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId : null;
    if (!productId) {
      return NextResponse.json({ message: "productId mangler" }, { status: 400 });
    }

    await prisma.favorite.deleteMany({ where: { userId: user.id, productId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Favorite delete failed", error);
    return NextResponse.json({ message: "Kunne ikke fjerne favorit" }, { status: 503 });
  }
}
