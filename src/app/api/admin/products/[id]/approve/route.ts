import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { approveProduct } from "@/lib/product-approval";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const product = await approveProduct(id);
  if (!product) return NextResponse.json({ message: "Produktet findes ikke" }, { status: 404 });
  return NextResponse.json({ product });
}
