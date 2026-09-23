import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// POST { name, kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g } —
// tale/AI-flowet fandt en madvare uden match i databasen. Den oprettes som
// PENDING-kandidat i den fælles produktdatabase (docs/ADMIN.md), så den kan
// genkendes/godkendes fremover. Selve registreringen ligger i brugerens
// boks (docs/PRIVACY.md); kandidaten har ingen kobling til brugeren.
export async function POST(req: Request) {
  if (!(await getSessionUser())) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const value = (key: string) => {
    const v = body?.[key];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  };
  const kcal = value("kcalPer100g");
  const protein = value("proteinPer100g");
  const carbs = value("carbsPer100g");
  const fat = value("fatPer100g");
  if (!name || kcal === null || protein === null || carbs === null || fat === null) {
    return NextResponse.json({ message: "Ugyldig kandidat" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: { name, kcalPer100g: kcal, proteinPer100g: protein, carbsPer100g: carbs, fatPer100g: fat, status: "PENDING" },
    select: { id: true },
  });
  return NextResponse.json({ product });
}
