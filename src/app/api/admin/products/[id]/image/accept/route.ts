import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { resolveOpenSearches } from "@/lib/product-image-search";
import { briaVariantUrl } from "@/lib/bria-variant";

// Promotes the AI-suggested image (scripts/image-agent) to the live
// imageUrl — the agent only ever writes pendingImageUrl, see docs/ADMIN.md.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing?.pendingImageUrl) {
    return NextResponse.json({ message: "Intet forslag at godkende" }, { status: 400 });
  }

  // Admin kan vælge Bria-udgaven af udklippet (_bria.png, docs/BRIA.md).
  const body = (await req.json().catch(() => null)) as { variant?: string } | null;
  let imageUrl = existing.pendingImageUrl;
  if (body?.variant === "bria") {
    const bria = briaVariantUrl(existing.pendingImageUrl);
    if (!bria) return NextResponse.json({ message: "Der er ingen Bria-udgave af dette forslag" }, { status: 400 });
    imageUrl = bria;
  }

  const product = await prisma.product.update({
    where: { id },
    data: { imageUrl, pendingImageUrl: null, imageStatus: "APPROVED" },
  });
  await resolveOpenSearches(id);
  return NextResponse.json({ product });
}
