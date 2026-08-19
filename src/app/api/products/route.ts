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
