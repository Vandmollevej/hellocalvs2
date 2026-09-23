import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Kun fælles retter (fx importerede, externalSource sat). Brugernes egne
// retter ligger krypteret i boksen (docs/PRIVACY.md) og hentes via localApi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const dish = await prisma.dish.findFirst({
      where: { id, externalSource: { not: null } },
      include: { ingredients: { include: { product: true } } },
    });
    if (!dish) return NextResponse.json({ dish: null }, { status: 404 });
    const { ownerId: _ownerId, ...publicDish } = dish;
    void _ownerId;
    return NextResponse.json({ dish: publicDish });
  } catch (error) {
    console.error("Dish fetch failed", error);
    return NextResponse.json({ dish: null, message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
