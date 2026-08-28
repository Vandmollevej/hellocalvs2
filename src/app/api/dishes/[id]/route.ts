import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const dish = await prisma.dish.findUnique({
      where: { id },
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
