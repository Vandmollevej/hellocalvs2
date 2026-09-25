import { prisma } from "@/lib/prisma";
import { createIngredientRequest, INGREDIENT_NAME_MAX } from "@/lib/ingredient-requests";

// "Opret egen ingrediens" (docs/DECISIONS.md 2026-09-24). En privat
// ingrediens er en Product-række med privateOwnerId: kun navn, næring ukendt
// (0), kun synlig for ejeren. Admin får en anmodning og kan tilføje den
// globalt; så erstattes den i brugerens retter (src/lib/ingredient-requests.ts).

export { INGREDIENT_NAME_MAX };

export type PrivateIngredient = { id: string; name: string; createdAt: string; requestId: string | null };

async function withRequestIds(products: { id: string; name: string; createdAt: Date }[]): Promise<PrivateIngredient[]> {
  const requests = products.length
    ? await prisma.ingredientRequest.findMany({
        where: { privateProductId: { in: products.map((p) => p.id) } },
        select: { id: true, privateProductId: true },
      })
    : [];
  const requestByProduct = new Map(requests.map((r) => [r.privateProductId, r.id]));
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt.toISOString(),
    requestId: requestByProduct.get(p.id) ?? null,
  }));
}

export async function listPrivateIngredients(userId: string, q = "") {
  const products = await prisma.product.findMany({
    where: { privateOwnerId: userId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    select: { id: true, name: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return withRequestIds(products);
}

export async function getPrivateIngredient(userId: string, id: string) {
  const product = await prisma.product.findFirst({
    where: { id, privateOwnerId: userId },
    select: { id: true, name: true, createdAt: true },
  });
  return product ? (await withRequestIds([product]))[0] : null;
}

export function cleanIngredientName(raw: unknown): string | null {
  const name = typeof raw === "string" ? raw.trim() : "";
  return name && name.length <= INGREDIENT_NAME_MAX ? name : null;
}

export async function createPrivateIngredient(userId: string, name: string) {
  const product = await prisma.product.create({
    data: {
      name,
      kcalPer100g: 0,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 0,
      productCategory: "INGREDIENT",
      privateOwnerId: userId,
      createdByUserId: userId,
    },
    select: { id: true, name: true, createdAt: true },
  });
  // Fejler anmodningen, gemmes ingrediensen alligevel privat.
  await createIngredientRequest(name, product.id).catch((error) =>
    console.error("Ingredient request failed", error)
  );
  return (await withRequestIds([product]))[0];
}

export async function renamePrivateIngredient(userId: string, id: string, name: string) {
  const { count } = await prisma.product.updateMany({ where: { id, privateOwnerId: userId }, data: { name } });
  return count > 0 ? getPrivateIngredient(userId, id) : null;
}

export async function deletePrivateIngredient(userId: string, id: string) {
  const product = await prisma.product.findFirst({ where: { id, privateOwnerId: userId }, select: { id: true } });
  if (!product) return false;
  await prisma.$transaction([
    prisma.dishIngredient.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  return true;
}

// Kun egne private ingredienser må bruges i en ret; andres afvises.
export async function privateIngredientsAllowed(userId: string, productIds: string[]) {
  const foreign = await prisma.product.count({
    where: { id: { in: productIds }, privateOwnerId: { not: null }, NOT: { privateOwnerId: userId } },
  });
  return foreign === 0;
}
