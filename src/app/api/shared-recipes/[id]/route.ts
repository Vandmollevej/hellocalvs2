import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publisherHashFrom, toPublicRecipe } from "@/lib/shared-recipes";

// GET — en delt ret, uden oplysninger om udgiveren. Afviste retter og retter
// fra blokerede udgivere findes ikke for andre (docs/DECISIONS.md 2026-09-24).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const recipe = await prisma.sharedRecipe.findUnique({ where: { id } });
    if (!recipe || recipe.status === "REJECTED") return NextResponse.json({ recipe: null }, { status: 404 });
    const blocked = await prisma.sharedRecipePublisherBlock.findUnique({
      where: { publisherHash: recipe.publisherHash },
    });
    if (blocked) return NextResponse.json({ recipe: null }, { status: 404 });
    return NextResponse.json({ recipe: toPublicRecipe(recipe) });
  } catch (error) {
    console.error("Shared recipe fetch failed", error);
    return NextResponse.json({ recipe: null, message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// DELETE — ejeren stopper delingen. Kun med det udgivertoken, der delte
// retten. Andres favoritter er kopier i deres egen boks og bevares.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publisherHash = publisherHashFrom(req);
  if (!publisherHash) return NextResponse.json({ message: "Udgivertoken mangler" }, { status: 400 });
  const { count } = await prisma.sharedRecipe.deleteMany({ where: { id, publisherHash } });
  if (count === 0) return NextResponse.json({ message: "Retten findes ikke" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
