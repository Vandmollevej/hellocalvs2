import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScanWorker } from "@/lib/scan/require-worker";

// Medarbejderen fjerner selv en af sine Face ID-nøgler.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { count } = await prisma.scanWorkerPasskey.deleteMany({ where: { id, workerId: worker.id } });
  if (!count) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
