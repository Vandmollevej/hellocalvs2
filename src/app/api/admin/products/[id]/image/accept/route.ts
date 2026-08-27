import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Promotes the AI-suggested image (scripts/image-agent) to the live
// imageUrl — the agent only ever writes pendingImageUrl, see docs/ADMIN.md.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing?.pendingImageUrl) {
    return NextResponse.json({ message: "Intet forslag at godkende" }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: { imageUrl: existing.pendingImageUrl, pendingImageUrl: null, imageStatus: "APPROVED" },
  });
  return NextResponse.json({ product });
}
