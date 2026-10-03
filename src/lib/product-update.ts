import { prisma } from "@/lib/prisma";
import { awardPoints } from "@/lib/points";

// Opdater-varen-banneret (brugerbeslutning 2026-10-03): mangler en vare
// indhold, energi, logo eller produktbillede, tilbydes brugeren 20 points for
// at udfylde det. Alle brugere kan optjene dem — også admin, så det kan testes.
// Points udbetales højst én gang pr. bruger og vare.

export const PRODUCT_UPDATE_POINTS = 20;

export type ProductUpdateKind = "FRONT" | "NUTRITION" | "INGREDIENTS";

export type ProductGaps = {
  image: boolean;
  logo: boolean;
  nutrition: boolean;
  ingredients: boolean;
};

export function productGaps(product: {
  imageUrl: string | null;
  pendingImageUrl: string | null;
  ingredientsText: string | null;
  nutritionMissing: boolean;
  pendingFields: string[];
  brand: { logoUrl: string | null } | null;
}): ProductGaps {
  const reading = (field: string) => product.pendingFields.includes(field);
  return {
    image: !product.imageUrl && !product.pendingImageUrl,
    logo: !product.brand?.logoUrl,
    nutrition: product.nutritionMissing && !reading("nutrition"),
    ingredients: !product.ingredientsText?.trim() && !reading("ingredients"),
  };
}

// Hvilke fotos der kan udfylde hullerne: forsiden giver billede + logo.
export function updateKindsFor(gaps: ProductGaps): ProductUpdateKind[] {
  const kinds: ProductUpdateKind[] = [];
  if (gaps.image || gaps.logo) kinds.push("FRONT");
  if (gaps.nutrition) kinds.push("NUTRITION");
  if (gaps.ingredients) kinds.push("INGREDIENTS");
  return kinds;
}

export async function hasEarnedUpdatePoints(userId: string, productId: string): Promise<boolean> {
  const existing = await prisma.pointsTransaction.findFirst({
    where: { userId, productId, reason: "PRODUCT_UPDATED" },
    select: { id: true },
  });
  return existing !== null;
}

export async function awardUpdatePointsOnce(userId: string, productId: string): Promise<boolean> {
  if (await hasEarnedUpdatePoints(userId, productId)) return false;
  await awardPoints(userId, "PRODUCT_UPDATED", PRODUCT_UPDATE_POINTS, { productId });
  return true;
}
