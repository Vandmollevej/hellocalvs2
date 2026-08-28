import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

// GET /api/dishes — brugerens egne retter (nyeste først).
export async function GET() {
  try {
    const user = await getDemoUser();
    const dishes = await prisma.dish.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { ingredients: { include: { product: true } } },
    });
    return NextResponse.json({ dishes });
  } catch (error) {
    console.error("Dish list failed", error);
    return NextResponse.json(
      { dishes: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

type IngredientInput = { productId: string; grams: number };

// POST /api/dishes — opret en egen ret ud fra en liste af ingredienser
// (produkt + gram), tilføjet via søgning/stregkode/manuel oprettelse på
// samme måde som en almindelig madvare (se /opret-ret).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const ingredients = Array.isArray(body.ingredients) ? (body.ingredients as IngredientInput[]) : [];

  if (!name) {
    return NextResponse.json({ message: "Navn er påkrævet" }, { status: 400 });
  }
  if (
    ingredients.length === 0 ||
    !ingredients.every(
      (i) => typeof i.productId === "string" && typeof i.grams === "number" && i.grams > 0
    )
  ) {
    return NextResponse.json(
      { message: "Mindst én ingrediens (produkt + gram > 0) er påkrævet" },
      { status: 400 }
    );
  }

  try {
    const user = await getDemoUser();
    const dish = await prisma.dish.create({
      data: {
        name,
        ownerId: user.id,
        ingredients: {
          create: ingredients.map((i) => ({ productId: i.productId, grams: i.grams })),
        },
      },
      include: { ingredients: { include: { product: true } } },
    });
    return NextResponse.json({ dish }, { status: 201 });
  } catch (error) {
    console.error("Dish creation failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
