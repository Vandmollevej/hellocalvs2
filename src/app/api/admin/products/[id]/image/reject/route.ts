import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { resolveOpenSearches } from "@/lib/product-image-search";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const product = await prisma.product.update({
    where: { id },
    data: { pendingImageUrl: null, imageStatus: "REJECTED" },
  });
  await resolveOpenSearches(id);
  return NextResponse.json({ product });
}
