import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { brand: true },
    });
    if (!product) {
      return NextResponse.json({ product: null }, { status: 404 });
    }
    return NextResponse.json({ product });
  } catch (error) {
    console.error("Product fetch failed", error);
    return NextResponse.json(
      { product: null, message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
