import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// Bruger-indbakke (Profil → Beskeder): lister de OutboundMessage-rækker
// der reelt blev sendt til brugeren (mail/push, se src/lib/messaging.ts), med
// læst/ulæst-status til det sorte tal-badge i Indstillinger.
// "Slet" (userDeletedAt) lægger en besked under Slettet; "Ryd alt"
// (userPurgedAt) fjerner de slettede for brugeren for altid. Rækken bevares
// til admin-loggen.
const VISIBLE = { status: { in: ["SENT", "QUEUED"] as ("SENT" | "QUEUED")[] }, subject: { not: null }, userPurgedAt: null };

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine beskeder" }, { status: 401 });

  const deletedView = new URL(req.url).searchParams.get("view") === "deleted";
  const messages = await prisma.outboundMessage.findMany({
    where: { userId: user.id, ...VISIBLE, userDeletedAt: deletedView ? { not: null } : null },
    orderBy: { createdAt: "desc" },
    select: { id: true, event: true, subject: true, bodyHtml: true, createdAt: true, readAt: true },
  });

  const unreadCount = deletedView
    ? 0
    : messages.filter((m) => !m.readAt).length;
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
      where: { userId: user.id, readAt: null, userDeletedAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ message: "Mangler besked-id" }, { status: 400 });

  await prisma.outboundMessage.updateMany({
    where: { id: body.id, userId: user.id },
    data: body.delete ? { userDeletedAt: new Date(), readAt: new Date() } : { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

// "Ryd alt" under Slettet: skjuler alle slettede beskeder for brugeren for altid.
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at rydde dine beskeder" }, { status: 401 });

  await prisma.outboundMessage.updateMany({
    where: { userId: user.id, userDeletedAt: { not: null }, userPurgedAt: null },
    data: { userPurgedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
