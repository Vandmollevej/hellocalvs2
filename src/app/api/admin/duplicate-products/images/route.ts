import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// POST /api/admin/duplicate-products/images — admin "Dubletter" →
// Produktbilleder (docs/DECISIONS.md 2026-09-28).
// { productId, keepImageIds, primaryImageId }: sletter de fravalgte
// billed-rækker (filerne bliver liggende), gør primaryImageId til
// produktets hovedbillede og markerer billederne som gennemgået.
// "primary" er produktets imageUrl, når den ikke har sin egen række.
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const productId = typeof body.productId === "string" ? body.productId : "";
  const keepImageIds = Array.isArray(body.keepImageIds)
    ? body.keepImageIds.filter((id): id is string => typeof id === "string")
    : [];
  const primaryImageId = typeof body.primaryImageId === "string" ? body.primaryImageId : "";
  if (!keepImageIds.includes(primaryImageId)) {
    return NextResponse.json({ message: "Hovedbilledet skal være blandt dem der beholdes" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!product) return NextResponse.json({ message: "Varen findes ikke længere" }, { status: 404 });

  const primaryUrl =
    primaryImageId === "primary" ? product.imageUrl : product.images.find((img) => img.id === primaryImageId)?.url;
  if (!primaryUrl) return NextResponse.json({ message: "Hovedbilledet findes ikke længere" }, { status: 409 });

  const keep = product.images.filter((img) => keepImageIds.includes(img.id));
  const ordered = [...keep.filter((img) => img.url === primaryUrl), ...keep.filter((img) => img.url !== primaryUrl)];

  await prisma.$transaction(async (tx) => {
    await tx.productImage.deleteMany({ where: { productId, id: { notIn: keep.map((img) => img.id) } } });
    for (const [order, img] of ordered.entries()) {
      await tx.productImage.update({ where: { id: img.id }, data: { order } });
    }
    await tx.product.update({
      where: { id: productId },
      data: { imageUrl: primaryUrl, imagesReviewedAt: new Date() },
    });
  });
  return NextResponse.json({ ok: true });
}
