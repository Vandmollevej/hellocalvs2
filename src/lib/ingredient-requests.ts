import { prisma } from "@/lib/prisma";
import { queueMessage } from "@/lib/messaging";
import { matchFridaProduct } from "@/lib/generic-ingredient-match";

// "Opret egen ingrediens" (docs/DECISIONS.md 2026-09-24). Brugerens private
// ingrediens (src/lib/private-ingredients.ts) sendes som anmodning til
// admin, som kan oprette den globalt — så erstattes den private i
// brugerens retter.

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "peter@packroff.dk";
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "https://adminhellocal.packroff.dk";

export const INGREDIENT_NAME_MAX = 80;

export async function createIngredientRequest(name: string, privateProductId: string | null) {
  const request = await prisma.ingredientRequest.create({ data: { name, privateProductId } });
  await queueMessage("INGREDIENT_REQUEST_ADMIN", {
    toEmail: ADMIN_NOTIFICATION_EMAIL,
    vars: { ingredientName: name, reviewLink: `${ADMIN_BASE_URL}/admin/ingredient-requests` },
  }).catch((error) => console.error("Ingredient request alert failed", error));
  return request;
}

// Opretter den globale GenericIngredient (næring fra bedste Frida-match, som
// ved almindelig oprettelse — src/app/api/generic-ingredients/route.ts) og
// erstatter brugerens private ingrediens.
export async function addIngredientRequestGlobally(requestId: string, name: string, adminUserId: string) {
  const request = await prisma.ingredientRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") return null;

  const fridaCandidates = await prisma.product.findMany({
    where: { externalSource: "FRIDA" },
    select: { id: true, name: true, kcalPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
  });
  const match = matchFridaProduct(name, fridaCandidates);
  const ingredient = await prisma.genericIngredient.create({
    data: {
      name,
      fridaProductId: match?.id,
      kcalPer100g: match?.kcalPer100g,
      proteinPer100g: match?.proteinPer100g,
      carbsPer100g: match?.carbsPer100g,
      fatPer100g: match?.fatPer100g,
      createdByUserId: adminUserId,
    },
  });

  await prisma.ingredientRequest.update({
    where: { id: request.id },
    data: { status: "ADDED", genericIngredientId: ingredient.id, reviewedAt: new Date() },
  });

  // Den globale ingrediens' Frida-produkt erstatter brugerens private i
  // deres retter; derefter slettes den private.
  if (request.privateProductId && ingredient.fridaProductId) {
    const privateId = request.privateProductId;
    await prisma
      .$transaction([
        prisma.dishIngredient.updateMany({
          where: { productId: privateId },
          data: { productId: ingredient.fridaProductId },
        }),
        prisma.product.deleteMany({ where: { id: privateId, privateOwnerId: { not: null } } }),
      ])
      .catch((error) => console.error("Private ingredient replacement failed", error));
  }
  return ingredient;
}
