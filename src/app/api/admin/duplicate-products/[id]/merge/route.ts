import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// POST /api/admin/duplicate-products/[id]/merge — the "Merge"-knap on
// /admin/duplicate-products (docs/ADMIN.md "Dobbeltoprettelser"). Keeps one
// of the two flagged products, moves every reference (registrations,
// barcodes, favorites, dish/product ingredients, points, forwards) over to
// it, applies the admin's checked image selection, and deletes the other
// product. Registration/PointsTransaction rows keep their own snapshot
// values regardless (see the snapshot principle in docs/DECISIONS.md), so
// the merge never changes what a user already logged.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const keepProductId = typeof body.keepProductId === "string" ? body.keepProductId : "";
  const images = Array.isArray(body.images)
    ? body.images.filter((url): url is string => typeof url === "string" && url.length > 0)
    : [];

  const link = await prisma.productDuplicateLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (link.status !== "PENDING") {
    return NextResponse.json({ message: "Denne dobbeltoprettelse er allerede behandlet" }, { status: 409 });
  }
  if (keepProductId !== link.productAId && keepProductId !== link.productBId) {
    return NextResponse.json({ message: "keepProductId skal være et af de to flaggede produkter" }, { status: 400 });
  }

  const discardProductId = keepProductId === link.productAId ? link.productBId : link.productAId;

  try {
    await prisma.$transaction(async (tx) => {
      // Straightforward reassignments — no unique constraint can collide.
      await tx.barcode.updateMany({ where: { productId: discardProductId }, data: { productId: keepProductId } });
      await tx.registration.updateMany({ where: { productId: discardProductId }, data: { productId: keepProductId } });
      await tx.dishIngredient.updateMany({ where: { productId: discardProductId }, data: { productId: keepProductId } });
      await tx.pointsTransaction.updateMany({ where: { productId: discardProductId }, data: { productId: keepProductId } });
      await tx.forward.updateMany({ where: { productId: discardProductId }, data: { productId: keepProductId } });

      // ProductIngredient has @@unique([productId, ingredientId]) — drop the
      // discard side's row instead of reassigning when the kept product
      // already has that ingredient.
      const discardIngredients = await tx.productIngredient.findMany({ where: { productId: discardProductId } });
      const keepIngredientIds = new Set(
        (await tx.productIngredient.findMany({ where: { productId: keepProductId }, select: { ingredientId: true } })).map(
          (row) => row.ingredientId
        )
      );
      for (const row of discardIngredients) {
        if (keepIngredientIds.has(row.ingredientId)) {
          await tx.productIngredient.delete({ where: { id: row.id } });
        } else {
          await tx.productIngredient.update({ where: { id: row.id }, data: { productId: keepProductId } });
        }
      }

      // Favorite has @@unique([userId, productId, dishId]) — drop the
      // discard side's row instead of reassigning when the same user already
      // favorited the kept product.
      const discardFavorites = await tx.favorite.findMany({ where: { productId: discardProductId } });
      for (const fav of discardFavorites) {
        const clash = await tx.favorite.findFirst({
          where: { userId: fav.userId, productId: keepProductId, dishId: fav.dishId },
        });
        if (clash) {
          await tx.favorite.delete({ where: { id: fav.id } });
        } else {
          await tx.favorite.update({ where: { id: fav.id }, data: { productId: keepProductId } });
        }
      }

      // Images: replace both products' images with the admin's checked,
      // ordered selection — the first becomes the kept product's primary
      // imageUrl, the rest become ProductImage rows.
      await tx.productImage.deleteMany({ where: { productId: { in: [keepProductId, discardProductId] } } });
      const [primaryImage, ...restImages] = images;
      await tx.product.update({
        where: { id: keepProductId },
        data: {
          imageUrl: primaryImage ?? null,
          ...(restImages.length
            ? { images: { create: restImages.map((url, order) => ({ url, order })) } }
            : {}),
        },
      });

      await tx.productDuplicateLink.update({
        where: { id: link.id },
        data: { status: "MERGED", resolvedAt: new Date() },
      });

      // Deleting the discarded product also cascades any other pending
      // ProductDuplicateLink rows involving it (see schema.prisma).
      await tx.product.delete({ where: { id: discardProductId } });
    });

    return NextResponse.json({ ok: true, keepProductId });
  } catch (error) {
    console.error("Duplicate-product merge failed", error);
    return NextResponse.json({ message: "Kunne ikke flette produkterne" }, { status: 500 });
  }
}
