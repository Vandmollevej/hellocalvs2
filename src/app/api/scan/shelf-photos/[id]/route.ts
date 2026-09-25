import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScanWorker } from "@/lib/scan/require-worker";
import { deleteShelfPhotoFile } from "@/lib/scan/storage";
import { SHELF_PHOTO_SELECT } from "@/lib/scan/shelf-select";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const photo = await prisma.shelfPhoto.findFirst({ where: { id, workerId: worker.id }, select: SHELF_PHOTO_SELECT });
  if (!photo) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ photo });
}

// Tandhjul → slet: billedet slettes helt, også for admin (brugerbeslutning
// 2026-09-24). Indsendelser knyttet til billedets varer bevares (SetNull).
export async function DELETE(_req: Request, { params }: Params) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const photo = await prisma.shelfPhoto.findFirst({ where: { id, workerId: worker.id } });
  if (!photo) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await prisma.shelfPhoto.delete({ where: { id: photo.id } });
  await deleteShelfPhotoFile(photo.imageUrl);
  return NextResponse.json({ ok: true });
}
