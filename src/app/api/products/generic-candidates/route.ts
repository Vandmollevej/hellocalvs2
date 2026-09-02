import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products/generic-candidates — små, ubrandede produkter (typisk
// frugt/grønt) med billede, brugt som kandidatsæt til den lokale
// billed-hash-matching i det tekstløse spor af /kamera/opret (se
// src/lib/image-similarity.ts). Ren database-læsning, ingen AI.
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        imageUrl: { not: null },
        discontinued: false,
        OR: [
          { category: { name: { contains: "frugt", mode: "insensitive" } } },
          { category: { name: { contains: "grønt", mode: "insensitive" } } },
        ],
      },
      select: { id: true, name: true, imageUrl: true },
      take: 60,
    });
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Generic candidate lookup failed", error);
    return NextResponse.json({ products: [] }, { status: 503 });
  }
}
