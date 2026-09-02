import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// POST /api/admin/products/[id]/merge { intoProductId }
// Merges the product at `id` (the duplicate) into `intoProductId` (the one
// to keep), per docs/ADMIN.md's duplicate-handling rule: every link moves to
// the kept product and the duplicate is removed, but Registration snapshot
// fields (titleSnapshot/kcalSnapshot/...) are never touched, so historical
// entries keep showing exactly what the user logged at the time.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id: duplicateId } = await params;
  let body: { intoProductId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const keepId = body.intoProductId;
  if (!keepId || keepId === duplicateId) {
    return NextResponse.json({ message: "Vælg et andet produkt at flette ind i" }, { status: 400 });
  }

  const [duplicate, keep] = await Promise.all([
    prisma.product.findUnique({ where: { id: duplicateId } }),
    prisma.product.findUnique({ where: { id: keepId } }),
  ]);
  if (!duplicate || !keep) {
    return NextResponse.json({ message: "Produkt ikke fundet" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Barcode.code is the primary key (globally unique), so a plain
    // reassignment can never collide.
    await tx.barcode.updateMany({ where: { productId: duplicateId }, data: { productId: keepId } });
    await tx.dishIngredient.updateMany({ where: { productId: duplicateId }, data: { productId: keepId } });
    // Registrations keep their own snapshot; only the live-product link moves.
    await tx.registration.updateMany({ where: { productId: duplicateId }, data: { productId: keepId } });

    // Favorite has a (userId, productId, dishId) unique constraint — drop the
    // duplicate's row instead of reassigning wherever the user already
    // favorited the kept product.
    const favorites = await tx.favorite.findMany({ where: { productId: duplicateId } });
    for (const fav of favorites) {
      const clash = await tx.favorite.findFirst({ where: { userId: fav.userId, productId: keepId, dishId: fav.dishId } });
      if (clash) await tx.favorite.delete({ where: { id: fav.id } });
      else await tx.favorite.update({ where: { id: fav.id }, data: { productId: keepId } });
    }

    // ProductIngredient has a (productId, ingredientId) unique constraint —
    // same dedupe approach.
    const ingredients = await tx.productIngredient.findMany({ where: { productId: duplicateId } });
    for (const pi of ingredients) {
      const clash = await tx.productIngredient.findFirst({ where: { productId: keepId, ingredientId: pi.ingredientId } });
      if (clash) await tx.productIngredient.delete({ where: { id: pi.id } });
      else await tx.productIngredient.update({ where: { id: pi.id }, data: { productId: keepId } });
    }

    await tx.product.delete({ where: { id: duplicateId } });
  });

  const merged = await prisma.product.findUnique({ where: { id: keepId }, include: { brand: true } });
  return NextResponse.json({ product: merged });
}
