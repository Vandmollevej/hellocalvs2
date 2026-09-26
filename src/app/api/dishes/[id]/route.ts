import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { parseRecipeTags } from "@/lib/recipe-categories";
import { publisherHashForUser } from "@/lib/shared-recipes";

// Kun ejeren kan se sin egen ret (bruges af Opskrifter → Mine retter).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const dish = await prisma.dish.findFirst({
      where: { id, ownerId: user.id },
      include: { ingredients: { include: { product: true } } },
    });
    if (!dish) {
      return NextResponse.json({ dish: null }, { status: 404 });
    }
    return NextResponse.json({ dish });
  } catch (error) {
    console.error("Dish fetch failed", error);
    return NextResponse.json(
      { dish: null, message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// PATCH { tags } — kategorier valgt i vinduet efter Gem (docs/DECISIONS.md
// 2026-09-25). Er retten delt, opdateres den delte udgave også.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { tags?: unknown } | null;
  if (!Array.isArray(body?.tags)) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  const tags = parseRecipeTags(body.tags);

  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const dish = await prisma.dish.findFirst({ where: { id, ownerId: user.id } });
    if (!dish) return NextResponse.json({ message: "Ret ikke fundet" }, { status: 404 });
    await prisma.dish.update({ where: { id }, data: { tags } });
    if (dish.sharedRecipeId) {
      await prisma.sharedRecipe.updateMany({
        where: { id: dish.sharedRecipeId, publisherHash: publisherHashForUser(user.id) },
        data: { tags },
      });
    }
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Dish tag update failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
