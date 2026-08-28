import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function GET() {
  try {
    const user = await getDemoUser();
    const registrations = await prisma.registration.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { imageUrl: true } } },
      take: 500,
    });

    return NextResponse.json({ registrations });
  } catch (error) {
    console.error("Registration list failed", error);
    return NextResponse.json(
      { registrations: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// POST /api/registrations — manuel tilføjelse af en registrering.
// Kalorier/makroer gemmes som snapshot på registreringen selv, jf.
// docs/DATABASE.md, og ændres derfor aldrig af senere produktopdateringer.
//
// Tre former:
// - { productId, amountGrams } — normalt flow, snapshot udregnes fra produktet.
// - { dishId, amountGrams } — en egen ret (se /opret-ret); snapshot udregnes
//   ud fra summen af rettens ingredienser, skaleret til amountGrams.
// - { titleSnapshot, kcalSnapshot, proteinSnapshot, carbsSnapshot, fatSnapshot,
//   amountGrams } uden productId/dishId — bruges når stemme/AI-flowet (se
//   /api/ai/interpret-meal) foreslår en madvare uden match i databasen. Varen
//   oprettes her som en ny "PENDING"-kandidat (jf. docs/ADMIN.md), så den kan
//   genkendes/godkendes fremover i stedet for at gætte hver gang.
export async function POST(req: Request) {
  const body = await req.json();
  const {
    productId,
    dishId,
    amountGrams,
    titleSnapshot,
    kcalSnapshot,
    proteinSnapshot,
    carbsSnapshot,
    fatSnapshot,
    createdAt,
  } = body as {
    productId?: string;
    dishId?: string;
    amountGrams: number;
    titleSnapshot?: string;
    // Ved productId/dishId er disse tre valgfri overstyringer af de udregnede
    // makroer (fx justeret via Energifordeling-slidere i /tilfoej), ikke et
    // krav om fuldt selvstændigt snapshot som i AI-flowet nedenfor.
    kcalSnapshot?: number;
    proteinSnapshot?: number;
    carbsSnapshot?: number;
    fatSnapshot?: number;
    createdAt?: string;
  };

  if (!amountGrams || amountGrams <= 0) {
    return NextResponse.json(
      { message: "amountGrams (> 0) er påkrævet" },
      { status: 400 }
    );
  }

  const parsedCreatedAt = createdAt ? new Date(createdAt) : undefined;
  if (parsedCreatedAt && Number.isNaN(parsedCreatedAt.getTime())) {
    return NextResponse.json({ message: "createdAt er ugyldig" }, { status: 400 });
  }

  try {
    const user = await getDemoUser();

    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        return NextResponse.json({ message: "Produkt ikke fundet" }, { status: 404 });
      }

      const factor = amountGrams / 100;
      const registration = await prisma.registration.create({
        data: {
          userId: user.id,
          productId: product.id,
          titleSnapshot: product.name,
          kcalSnapshot: kcalSnapshot ?? product.kcalPer100g * factor,
          proteinSnapshot: proteinSnapshot ?? product.proteinPer100g * factor,
          carbsSnapshot: carbsSnapshot ?? product.carbsPer100g * factor,
          ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
          fatSnapshot: fatSnapshot ?? product.fatPer100g * factor,
          amountGrams,
        },
      });

      return NextResponse.json({ registration });
    }

    if (dishId) {
      const dish = await prisma.dish.findUnique({
        where: { id: dishId },
        include: { ingredients: { include: { product: true } } },
      });
      if (!dish) {
        return NextResponse.json({ message: "Ret ikke fundet" }, { status: 404 });
      }

      const totals = dish.ingredients.reduce(
        (acc, ingredient) => {
          const factor = ingredient.grams / 100;
          acc.grams += ingredient.grams;
          acc.kcal += ingredient.product.kcalPer100g * factor;
          acc.protein += ingredient.product.proteinPer100g * factor;
          acc.carbs += ingredient.product.carbsPer100g * factor;
          acc.fat += ingredient.product.fatPer100g * factor;
          return acc;
        },
        { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
      );
      const scale = totals.grams > 0 ? amountGrams / totals.grams : 0;

      const registration = await prisma.registration.create({
        data: {
          userId: user.id,
          dishId: dish.id,
          titleSnapshot: dish.name,
          kcalSnapshot: kcalSnapshot ?? totals.kcal * scale,
          proteinSnapshot: proteinSnapshot ?? totals.protein * scale,
          carbsSnapshot: carbsSnapshot ?? totals.carbs * scale,
          fatSnapshot: fatSnapshot ?? totals.fat * scale,
          ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
          amountGrams,
        },
      });

      return NextResponse.json({ registration });
    }

    if (
      !titleSnapshot ||
      kcalSnapshot === undefined ||
      proteinSnapshot === undefined ||
      carbsSnapshot === undefined ||
      fatSnapshot === undefined
    ) {
      return NextResponse.json(
        { message: "productId, eller titleSnapshot + alle snapshot-værdier, er påkrævet" },
        { status: 400 }
      );
    }

    const factor = amountGrams / 100;
    const product = await prisma.product.create({
      data: {
        name: titleSnapshot,
        kcalPer100g: kcalSnapshot / factor,
        proteinPer100g: proteinSnapshot / factor,
        carbsPer100g: carbsSnapshot / factor,
        fatPer100g: fatSnapshot / factor,
        status: "PENDING",
      },
    });

    const registration = await prisma.registration.create({
      data: {
        userId: user.id,
        productId: product.id,
        titleSnapshot,
        kcalSnapshot,
        proteinSnapshot,
        carbsSnapshot,
        fatSnapshot,
        amountGrams,
      },
    });

    return NextResponse.json({ registration });
  } catch (error) {
    console.error("Registration create failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
