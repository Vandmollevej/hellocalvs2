import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/products/match-nutrition — { kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g }
//
// Sidste dublet-tjek i næringsindhold-trinnet af /camera/create: hvis de
// aflæste pr.-100g-værdier er (så godt som) identiske med et eksisterende
// produkt, er det formentlig samme vare igen — brugeren skal ikke oprette
// en dublet (krav 6: "hvis energifordelingen ikke er 100% identisk med en
// anden, skift automatisk til opret-siden").
const TOLERANCE = 0.5;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const kcalPer100g = Number(body?.kcalPer100g);
  const proteinPer100g = Number(body?.proteinPer100g);
  const carbsPer100g = Number(body?.carbsPer100g);
  const fatPer100g = Number(body?.fatPer100g);

  if (![kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g].every(Number.isFinite)) {
    return NextResponse.json({ product: null });
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        discontinued: false,
        kcalPer100g: { gte: kcalPer100g - TOLERANCE, lte: kcalPer100g + TOLERANCE },
        proteinPer100g: { gte: proteinPer100g - TOLERANCE, lte: proteinPer100g + TOLERANCE },
        carbsPer100g: { gte: carbsPer100g - TOLERANCE, lte: carbsPer100g + TOLERANCE },
        fatPer100g: { gte: fatPer100g - TOLERANCE, lte: fatPer100g + TOLERANCE },
      },
    });
    return NextResponse.json({ product });
  } catch (error) {
    console.error("Nutrition dedupe lookup failed", error);
    return NextResponse.json({ product: null }, { status: 503 });
  }
}
