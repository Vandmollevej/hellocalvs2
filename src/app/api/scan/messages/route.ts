import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireScanWorker } from "@/lib/scan/require-worker";

// Tovejs beskedtråd medarbejder <-> admin ("Beskeder"/"Kontakt").
export async function GET() {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const messages = await prisma.scanMessage.findMany({
    where: { workerId: worker.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, fromAdmin: true, createdAt: true },
  });
  await prisma.scanMessage.updateMany({ where: { workerId: worker.id, fromAdmin: true, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const worker = await requireScanWorker();
  if (!worker) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
  if (!text) return NextResponse.json({ message: "Tom besked" }, { status: 400 });
  const message = await prisma.scanMessage.create({
    data: { workerId: worker.id, body: text, fromAdmin: false },
    select: { id: true, body: true, fromAdmin: true, createdAt: true },
  });
  return NextResponse.json({ message }, { status: 201 });
}
