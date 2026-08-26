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
export async function POST(req: Request) {
  const body = await req.json();
  const { productId, amountGrams } = body as {
    productId: string;
    amountGrams: number;
  };

  if (!productId || !amountGrams || amountGrams <= 0) {
    return NextResponse.json(
      { message: "productId og amountGrams (> 0) er påkrævet" },
      { status: 400 }
    );
  }

  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ message: "Produkt ikke fundet" }, { status: 404 });
    }

    const user = await getDemoUser();
    const factor = amountGrams / 100;

    const registration = await prisma.registration.create({
      data: {
        userId: user.id,
        productId: product.id,
        titleSnapshot: product.name,
        kcalSnapshot: product.kcalPer100g * factor,
        proteinSnapshot: product.proteinPer100g * factor,
        carbsSnapshot: product.carbsPer100g * factor,
        fatSnapshot: product.fatPer100g * factor,
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
