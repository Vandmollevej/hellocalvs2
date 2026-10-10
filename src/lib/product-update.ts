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
  // Frida-skøn (∼, DECISIONS 2026-10-10) er stadig et hul: en rigtig
  // næringsdeklaration afløser det.
  fridaEstimateId?: string | null;
  pendingFields: string[];
  brand: { logoUrl: string | null } | null;
}): ProductGaps {
  const reading = (field: string) => product.pendingFields.includes(field);
  return {
    image: !product.imageUrl && !product.pendingImageUrl,
    logo: !product.brand?.logoUrl,
    nutrition: (product.nutritionMissing || !!product.fridaEstimateId) && !reading("nutrition"),
    ingredients: !product.ingredientsText?.trim() && !reading("ingredients"),
  };
}

// Hvilke fotos der kan udfylde hullerne. Kun tre områder tilbydes: produktbillede
// (forsiden), energi og indhold. Et manglende logo alene udløser hverken banner
// eller kort — det følger med forsiden, når billedet mangler (brugerens rettelse
// 2026-10-03).
export function updateKindsFor(gaps: ProductGaps): ProductUpdateKind[] {
  const kinds: ProductUpdateKind[] = [];
  if (gaps.image) kinds.push("FRONT");
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

// Points gives kun for et foto taget nu med kameraet — ikke for et billede, der
// er hentet på nettet og lagt op fra fotobiblioteket (brugerens regel
// 2026-10-03). Filens ændringstid bruges som mærke; ældre filer udfylder stadig
// varen, men giver ingen points.
export const CAMERA_PHOTO_MAX_AGE_MS = 5 * 60 * 1000;

export function isFreshCameraPhoto(lastModifiedMs: unknown, now = Date.now()): boolean {
  return (
    typeof lastModifiedMs === "number" &&
    Number.isFinite(lastModifiedMs) &&
    now - lastModifiedMs <= CAMERA_PHOTO_MAX_AGE_MS &&
    lastModifiedMs <= now + 60_000
  );
}

export async function awardUpdatePointsOnce(userId: string, productId: string): Promise<boolean> {
  if (await hasEarnedUpdatePoints(userId, productId)) return false;
  await awardPoints(userId, "PRODUCT_UPDATED", PRODUCT_UPDATE_POINTS, { productId });
  return true;
}
