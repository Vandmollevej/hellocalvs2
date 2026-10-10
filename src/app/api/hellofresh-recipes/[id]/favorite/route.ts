import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { MEAL_KIT_SOURCES } from "@/lib/meal-kit-providers";

// "Gem" på en HelloFresh-opskrift (docs/DECISIONS.md 2026-09-27). Gemmes
// sammen med favoritterne fra delte retter, som samme slags snapshot
// ({ id, name, kcal, images }), så de vises under "Favoritter".

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getProfileUser("recipeFavorites", "CREATED");
  if (!user) return unauthorized();
  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, externalSource: { in: MEAL_KIT_SOURCES } },
    select: { id: true, name: true, imageUrl: true, kcalPer100g: true, servingSizeGrams: true },
  });
  if (!product) return NextResponse.json({ message: "Opskriften findes ikke" }, { status: 404 });

  // Uden portionsvægt (BetterFeast) er kcal pr. 100 g og markeres som det.
  const snapshot = {
    id: product.id,
    name: product.name,
    kcal: Math.round((product.kcalPer100g * (product.servingSizeGrams ?? 100)) / 100),
    ...(product.servingSizeGrams ? {} : { per100g: true }),
    images: product.imageUrl ? [product.imageUrl] : [],
  };
  await prisma.sharedRecipeFavorite.upsert({
    where: { userId_recipeId: { userId: user.id, recipeId: id } },
    create: { userId: user.id, recipeId: id, recipe: snapshot as unknown as Prisma.InputJsonValue },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getProfileUser("recipeFavorites", "DELETED");
  if (!user) return unauthorized();
  const { id } = await params;
  await prisma.sharedRecipeFavorite.deleteMany({ where: { userId: user.id, recipeId: id } });
  return NextResponse.json({ ok: true });
}
