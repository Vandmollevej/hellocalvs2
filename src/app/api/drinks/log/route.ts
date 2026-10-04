import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileContext } from "@/lib/family-access";
import { drinkTotals, ingredientMl } from "@/lib/drinks";

// Logger en drink som ÉN registrering (snapshot): drinkens navn og summeret
// næring ud fra de mængder, brugeren valgte på skyderne. Næringen regnes på
// serveren ud fra ingredienserne — klienten sender kun mængderne.
export async function POST(req: Request) {
  const body = (await req.json()) as {
    drinkId?: string;
    amounts?: Record<string, number>;
    createdAt?: string;
  };
  const { drinkId, amounts, createdAt } = body;
  if (!drinkId || !amounts || typeof amounts !== "object") {
    return NextResponse.json({ message: "drinkId og amounts er påkrævet" }, { status: 400 });
  }
  const parsedCreatedAt = createdAt ? new Date(createdAt) : undefined;
  if (parsedCreatedAt && Number.isNaN(parsedCreatedAt.getTime())) {
    return NextResponse.json({ message: "createdAt er ugyldig" }, { status: 400 });
  }

  try {
    const context = await getProfileContext("registrations", "CREATED");
    if (!context) return unauthorized();
    const drink = await prisma.drink.findUnique({
      where: { id: drinkId },
      include: { ingredients: true },
    });
    if (!drink) return NextResponse.json({ message: "Drink ikke fundet" }, { status: 404 });

    const chosen = drink.ingredients.map((ingredient) => {
      const raw = Number(amounts[ingredient.id]);
      const amount = Number.isFinite(raw)
        ? Math.min(ingredient.maxAmount, Math.max(ingredient.minAmount, raw))
        : ingredient.defaultAmount;
      return { ingredient, amount };
    });
    const totalMl = chosen.reduce((sum, c) => sum + ingredientMl(c.ingredient.unit, c.amount), 0);
    if (totalMl <= 0) {
      return NextResponse.json({ message: "Drinken er tom" }, { status: 400 });
    }
    const totals = drinkTotals(chosen);
    const user = context.profile;
    const registration = await prisma.registration.create({
      data: {
        userId: user.id,
        createdById: context.login.id !== user.id ? context.login.id : null,
        titleSnapshot: drink.name,
        kcalSnapshot: totals.kcal,
        proteinSnapshot: totals.protein,
        carbsSnapshot: totals.carbs,
        fatSnapshot: totals.fat,
        sugarSnapshot: totals.sugar ?? undefined,
        amountGrams: totalMl,
        ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
      },
    });
    return NextResponse.json({ registration });
  } catch (error) {
    console.error("Drink log failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
