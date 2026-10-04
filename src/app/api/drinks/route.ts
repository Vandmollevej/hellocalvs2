import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const drinks = await prisma.drink.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { ingredients: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json({ drinks });
  } catch (error) {
    console.error("Drink list failed", error);
    return NextResponse.json({ drinks: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
