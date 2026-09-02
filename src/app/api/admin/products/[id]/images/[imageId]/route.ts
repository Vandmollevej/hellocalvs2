import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id: productId, imageId } = await params;
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image || image.productId !== productId) {
    return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  }
  await prisma.productImage.delete({ where: { id: imageId } });
  return NextResponse.json({ ok: true });
}

// PATCH { direction: "up" | "down" } — swap order with the neighbouring image.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id: productId, imageId } = await params;
  let body: { direction?: "up" | "down" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const images = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: "asc" } });
  const index = images.findIndex((img) => img.id === imageId);
  if (index === -1) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });

  const swapIndex = body.direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= images.length) return NextResponse.json({ images });

  const a = images[index];
  const b = images[swapIndex];
  await prisma.$transaction([
    prisma.productImage.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.productImage.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);

  const updated = await prisma.productImage.findMany({ where: { productId }, orderBy: { order: "asc" } });
  return NextResponse.json({ images: updated });
}
