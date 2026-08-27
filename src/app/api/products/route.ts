import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products?q=rugbrød — søgning i egen produktdatabase.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  try {
    const products = await prisma.product.findMany({
      where: q
        ? { name: { contains: q, mode: "insensitive" }, discontinued: false }
        : { discontinued: false },
      include: { brand: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Product search failed", error);
    return NextResponse.json(
      { products: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

function parsePositiveNumber(value: unknown): number | null {
  const num = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(num) && num >= 0 ? num : null;
}

// POST /api/products — opret et produkt manuelt, fx fra et foto af en
// næringsdeklaration (se /kamera?mode=naering). Oprettes som PENDING,
// samme status som andre brugerbidragede produkter (se docs/ADMIN.md).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kcalPer100g = parsePositiveNumber(body.kcalPer100g);
  const proteinPer100g = parsePositiveNumber(body.proteinPer100g);
  const carbsPer100g = parsePositiveNumber(body.carbsPer100g);
  const fatPer100g = parsePositiveNumber(body.fatPer100g);

  if (!name || kcalPer100g === null || proteinPer100g === null || carbsPer100g === null || fatPer100g === null) {
    return NextResponse.json(
      { message: "Navn, kalorier, protein, kulhydrat og fedt skal udfyldes med gyldige tal" },
      { status: 400 }
    );
  }

  try {
    const product = await prisma.product.create({
      data: { name, kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Product creation failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
