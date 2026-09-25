import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { findVisibleSharedRecipe, markSharedRecipeUsed } from "@/lib/shared-recipe-share";
import type { PublicSharedRecipe } from "@/lib/shared-recipes";

// Favoritter på andres delte retter. Gemmes som snapshot, så de bevares,
// selvom ejeren sletter retten eller stopper delingen.

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const favorites = await prisma.sharedRecipeFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ favorites: favorites.map((f) => f.recipe as unknown as PublicSharedRecipe) });
}

async function recipeIdFrom(req: Request) {
  const body = (await req.json().catch(() => null)) as { recipeId?: unknown } | null;
  return typeof body?.recipeId === "string" ? body.recipeId : null;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const recipeId = await recipeIdFrom(req);
  if (!recipeId) return NextResponse.json({ message: "recipeId mangler" }, { status: 400 });

  const existing = await prisma.sharedRecipeFavorite.findUnique({
    where: { userId_recipeId: { userId: user.id, recipeId } },
  });
  if (existing) return NextResponse.json({ ok: true });

  const recipe = await findVisibleSharedRecipe(recipeId);
  if (!recipe) return NextResponse.json({ message: "Kunne ikke gemme favorit" }, { status: 404 });
  await prisma.sharedRecipeFavorite.create({
    data: { userId: user.id, recipeId, recipe: recipe as unknown as Prisma.InputJsonValue },
  });
  await markSharedRecipeUsed(recipeId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const recipeId = await recipeIdFrom(req);
  if (!recipeId) return NextResponse.json({ message: "recipeId mangler" }, { status: 400 });
  await prisma.sharedRecipeFavorite.deleteMany({ where: { userId: user.id, recipeId } });
  return NextResponse.json({ ok: true });
}
