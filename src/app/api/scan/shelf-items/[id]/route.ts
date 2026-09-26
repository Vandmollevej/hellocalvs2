import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScanWorker } from "@/lib/scan/require-worker";

// "Ret tildeling": medarbejderen retter et forkert AI-match i overlayet —
// vælger det rigtige produkt, eller markerer varen som ikke oprettet.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const productId = typeof body.productId === "string" && body.productId ? body.productId : null;

  const item = await prisma.shelfPhotoItem.findFirst({ where: { id, shelfPhoto: { workerId: worker.id } } });
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (productId && !(await prisma.product.findUnique({ where: { id: productId }, select: { id: true } }))) {
    return NextResponse.json({ message: "Produktet findes ikke" }, { status: 400 });
  }

  const updated = await prisma.shelfPhotoItem.update({
    where: { id },
    data: {
      productId,
      status: productId ? "EXISTS" : "MISSING",
      matchConfidence: productId ? 1 : null,
      manuallyAssigned: true,
    },
  });
  return NextResponse.json({ item: updated });
}
