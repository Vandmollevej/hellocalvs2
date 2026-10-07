import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

// Tommel op/ned på en opskrift. recipeKey = "shared:<id>" | "hf:<id>" | "own:<id>".
// GET ?key= → { value: 1 | -1 | 0 }. PUT { key, value } med value 1, -1 eller 0 (fjern).

const KEY_PATTERN = /^(shared|hf|own):[A-Za-z0-9_-]{1,64}$/;

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!KEY_PATTERN.test(key)) return NextResponse.json({ message: "Ugyldig nøgle" }, { status: 400 });
  try {
    const rating = await prisma.recipeRating.findUnique({
      where: { userId_recipeKey: { userId: user.id, recipeKey: key } },
      select: { value: true },
    });
    return NextResponse.json({ value: rating?.value ?? 0 });
  } catch {
    return NextResponse.json({ value: 0 });
  }
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { key?: unknown; value?: unknown } | null;
  const key = typeof body?.key === "string" ? body.key : "";
  const value = body?.value;
  if (!KEY_PATTERN.test(key) || (value !== 1 && value !== -1 && value !== 0)) {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  try {
    if (value === 0) {
      await prisma.recipeRating.deleteMany({ where: { userId: user.id, recipeKey: key } });
    } else {
      await prisma.recipeRating.upsert({
        where: { userId_recipeKey: { userId: user.id, recipeKey: key } },
        create: { userId: user.id, recipeKey: key, value },
        update: { value },
      });
    }
    return NextResponse.json({ value });
  } catch (error) {
    console.error("Recipe rating failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
