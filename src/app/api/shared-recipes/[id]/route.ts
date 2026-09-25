import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { publisherHashForUser, type PublicSharedRecipe } from "@/lib/shared-recipes";
import { findVisibleSharedRecipe } from "@/lib/shared-recipe-share";

// GET — en delt ret uden oplysninger om udgiveren. Afviste retter og retter
// fra blokerede udgivere findes ikke for andre (docs/DECISIONS.md
// 2026-09-24). Har brugeren retten som favorit, vises den gemte kopi, hvis
// originalen er væk.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await getSessionUser();
    const favorite = user
      ? await prisma.sharedRecipeFavorite.findUnique({ where: { userId_recipeId: { userId: user.id, recipeId: id } } })
      : null;
    const recipe = await findVisibleSharedRecipe(id);
    if (recipe) return NextResponse.json({ recipe, isFavorite: Boolean(favorite) });
    if (favorite) {
      const saved = favorite.recipe as unknown as PublicSharedRecipe;
      return NextResponse.json({ recipe: { ...saved, canReport: false }, isFavorite: true });
    }
    return NextResponse.json({ recipe: null, isFavorite: false }, { status: 404 });
  } catch (error) {
    console.error("Shared recipe fetch failed", error);
    return NextResponse.json({ recipe: null, message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// DELETE — ejeren stopper delingen. Andres favoritter er snapshots og bevares.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const { count } = await prisma.sharedRecipe.deleteMany({ where: { id, publisherHash: publisherHashForUser(user.id) } });
  if (count === 0) return NextResponse.json({ message: "Retten findes ikke" }, { status: 404 });
  await prisma.dish.updateMany({ where: { ownerId: user.id, sharedRecipeId: id }, data: { sharedRecipeId: null } });
  return NextResponse.json({ deleted: true });
}
