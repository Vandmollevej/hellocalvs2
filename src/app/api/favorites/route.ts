import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEffectiveUser } from "@/lib/session";

// Favorites (fejl #31/#33/#36 i Fejlretninger/FEJLLISTE.md): en bruger kan
// markere et produkt som favorit fra en swipe-handling på en registrerings-
// række. Bruges til Søg-sidens "Favoritter"-sektion og bookmark-ikonet på
// vare-rækker. `Favorite` findes allerede i schema (også forberedt til
// Dish-favoritter, som ikke bruges endnu — ingen UI for det i dag).
export async function GET() {
  try {
    const user = await getEffectiveUser();
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id, productId: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });

    return NextResponse.json({
      favorites: favorites
        .filter((favorite) => favorite.product)
        .map((favorite) => ({ id: favorite.id, product: favorite.product })),
    });
  } catch (error) {
    console.error("Favorite list failed", error);
    return NextResponse.json({ favorites: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getEffectiveUser();
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
    const user = await getEffectiveUser();
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
