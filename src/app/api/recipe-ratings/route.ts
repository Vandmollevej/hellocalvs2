import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Thumbs op/ned på en ret (delt brugerret eller HelloFresh-opskrift).
// GET ?recipeId= -> { value, up, down } (value = brugerens egen: 1, -1 eller 0).
// PUT { recipeId, value: 1 | -1 | 0 } sætter vurderingen; 0 fjerner den.

const MAX_ID_LENGTH = 100;

async function counts(recipeId: string) {
  const [up, down] = await Promise.all([
    prisma.recipeRating.count({ where: { recipeId, value: 1 } }),
    prisma.recipeRating.count({ where: { recipeId, value: -1 } }),
  ]);
  return { up, down };
}

export async function GET(req: Request) {
  const recipeId = new URL(req.url).searchParams.get("recipeId")?.slice(0, MAX_ID_LENGTH);
  if (!recipeId) return NextResponse.json({ message: "recipeId mangler" }, { status: 400 });
  try {
    const user = await getSessionUser();
    const own = user
      ? await prisma.recipeRating.findUnique({ where: { userId_recipeId: { userId: user.id, recipeId } } })
      : null;
    return NextResponse.json({ value: own?.value ?? 0, ...(await counts(recipeId)) });
  } catch (error) {
    console.error("Recipe rating fetch failed", error);
    return NextResponse.json({ value: 0, up: 0, down: 0, message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { recipeId?: unknown; value?: unknown } | null;
  const recipeId = typeof body?.recipeId === "string" ? body.recipeId.slice(0, MAX_ID_LENGTH) : "";
  const value = body?.value;
  if (!recipeId || (value !== 1 && value !== -1 && value !== 0)) {
    return NextResponse.json({ message: "Ugyldig vurdering" }, { status: 400 });
  }
  try {
    if (value === 0) {
      await prisma.recipeRating.deleteMany({ where: { userId: user.id, recipeId } });
    } else {
      await prisma.recipeRating.upsert({
        where: { userId_recipeId: { userId: user.id, recipeId } },
        create: { userId: user.id, recipeId, value },
        update: { value },
      });
    }
    return NextResponse.json({ value, ...(await counts(recipeId)) });
  } catch (error) {
    console.error("Recipe rating save failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
