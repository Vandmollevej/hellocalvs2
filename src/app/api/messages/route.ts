import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// Bruger-indbakke (Profil → Beskeder): lister de OutboundMessage-rækker
// der reelt blev sendt til brugeren (mail/push, se src/lib/messaging.ts), med
// læst/ulæst-status til det sorte tal-badge i Indstillinger.
// Swipe → Slet lægger beskeden i "Slettet" (deletedAt); DELETE ("Ryd alt")
// fjerner de slettede beskeder permanent.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine beskeder" }, { status: 401 });

  const deleted = new URL(req.url).searchParams.get("deleted") === "1";
  const messages = await prisma.outboundMessage.findMany({
    where: {
      userId: user.id,
      status: { in: ["SENT", "QUEUED"] },
      subject: { not: null },
      deletedAt: deleted ? { not: null } : null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, event: true, subject: true, bodyHtml: true, createdAt: true, readAt: true },
  });

  const unreadCount = deleted ? 0 : messages.filter((m) => !m.readAt).length;
  return NextResponse.json({ messages, unreadCount });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at opdatere dine beskeder" }, { status: 401 });

  let body: { id?: string; markAllRead?: boolean; delete?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  if (body.markAllRead) {
    await prisma.outboundMessage.updateMany({
      where: { userId: user.id, readAt: null, deletedAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ message: "Mangler besked-id" }, { status: 400 });

  if (body.delete) {
    await prisma.outboundMessage.updateMany({
      where: { id: body.id, userId: user.id, deletedAt: null },
      data: { deletedAt: new Date(), readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.outboundMessage.updateMany({
    where: { id: body.id, userId: user.id },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

// "Ryd alt" under Slettet: fjerner brugerens slettede beskeder permanent.
// Beskeder der stadig venter på at blive sendt (QUEUED) røres ikke.
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at rydde dine beskeder" }, { status: 401 });

  const { count } = await prisma.outboundMessage.deleteMany({
    where: { userId: user.id, deletedAt: { not: null }, status: { not: "QUEUED" } },
  });
  return NextResponse.json({ ok: true, deleted: count });
}
