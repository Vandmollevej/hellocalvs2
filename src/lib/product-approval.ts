import { prisma } from "@/lib/prisma";
import { awardPoints } from "@/lib/points";
import { queueMessage } from "@/lib/messaging";

// Delt godkendelses-/afvisningslogik for produkter — kaldt fra BÅDE den
// login-krævende admin-rute (src/app/api/admin/products/[id]/approve/route.ts)
// og det login-frie mail-godkendelseslink
// (src/app/api/admin/approve/[token]/route.ts), så points/besked-logikken
// kun findes ét sted. Points (docs/DECISIONS.md 2026-09-02): 10 for et
// godkendt bruger-indsendt produkt, +5 for varedeklaration, +5 for billeder
// fra flere vinkler — kun for bruger-indsendte (createdByUserId sat,
// externalSource null), aldrig for AI/API/DB-autoimporterede.
const BASE_POINTS = 10;
const INGREDIENTS_BONUS = 5;
const PHOTOS_BONUS = 5;
const MIN_EXTRA_IMAGES_FOR_BONUS = 2;

export async function approveProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id }, include: { images: true } });
  if (!existing) return null;

  const product = await prisma.product.update({
    where: { id },
    data: { status: "APPROVED", approvalToken: null },
  });

  if (existing.createdByUserId && existing.externalSource === null) {
    let pointsAwarded = BASE_POINTS;
    await awardPoints(existing.createdByUserId, "PRODUCT_APPROVED", BASE_POINTS, { productId: id });

    if (existing.ingredientsText) {
      pointsAwarded += INGREDIENTS_BONUS;
      await awardPoints(existing.createdByUserId, "PRODUCT_INGREDIENTS_BONUS", INGREDIENTS_BONUS, { productId: id });
    }
    if (existing.images.length >= MIN_EXTRA_IMAGES_FOR_BONUS) {
      pointsAwarded += PHOTOS_BONUS;
      await awardPoints(existing.createdByUserId, "PRODUCT_PHOTOS_BONUS", PHOTOS_BONUS, { productId: id });
    }

    await queueMessage("PRODUCT_APPROVED", {
      userId: existing.createdByUserId,
      vars: { productName: existing.name, points: String(pointsAwarded) },
    });
  }

  return product;
}

export async function rejectProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return null;

  const product = await prisma.product.update({
    where: { id },
    data: { status: "REJECTED", approvalToken: null },
  });

  if (existing.createdByUserId && existing.externalSource === null) {
    await queueMessage("PRODUCT_REJECTED", {
      userId: existing.createdByUserId,
      vars: { productName: existing.name },
    });
  }

  return product;
}
