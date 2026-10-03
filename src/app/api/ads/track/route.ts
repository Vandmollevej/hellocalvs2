import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Registrerer en visning eller et klik på en reklame-lokation (admin
// "Reklamer", docs/DECISIONS.md 2026-09-29 og partnersiden 2026-10-02).
//  - { locationId, type: "IMPRESSION" | "CLICK", path? } → { ok, eventId }
//    `path` er siden (stien) reklamen blev vist på.
//  - { eventId, seconds } opdaterer visningens eksponeringstid, når
//    bannerets synlighed slutter (kaldes af klienten med sendBeacon/fetch).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { locationId?: unknown; type?: unknown; path?: unknown; eventId?: unknown; seconds?: unknown }
    | null;
  if (!body) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  if (typeof body.eventId === "string" && body.eventId) {
    const seconds = Math.round(Number(body.seconds));
    if (!Number.isFinite(seconds) || seconds < 0) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
    const updated = await prisma.adEvent.updateMany({
      where: { id: body.eventId, type: "IMPRESSION" },
      data: { seconds: Math.min(seconds, 24 * 60 * 60) },
    });
    if (updated.count === 0) return NextResponse.json({ message: "Ukendt visning" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const type = body.type === "CLICK" ? "CLICK" : body.type === "IMPRESSION" ? "IMPRESSION" : null;
  if (!locationId || !type) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;
  const location = await prisma.adLocation.findUnique({ where: { id: locationId }, select: { id: true } });
  if (!location) return NextResponse.json({ message: "Ukendt lokation" }, { status: 404 });
  const event = await prisma.adEvent.create({ data: { locationId, type, path } });
  return NextResponse.json({ ok: true, eventId: event.id });
}
