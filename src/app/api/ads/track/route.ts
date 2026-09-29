import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Registrerer en visning eller et klik på en reklame-lokation (admin
// "Reklamer", docs/DECISIONS.md 2026-09-29). Kun to felter accepteres.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { locationId?: unknown; type?: unknown } | null;
  const locationId = typeof body?.locationId === "string" ? body.locationId : "";
  const type = body?.type === "CLICK" ? "CLICK" : body?.type === "IMPRESSION" ? "IMPRESSION" : null;
  if (!locationId || !type) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  const location = await prisma.adLocation.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!location) return NextResponse.json({ message: "Ukendt lokation" }, { status: 404 });
  await prisma.adEvent.create({ data: { locationId, type } });
  return NextResponse.json({ ok: true });
}
