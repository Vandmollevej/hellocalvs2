import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

// Bruger-indbakke (Indstillinger → Beskeder): lister de OutboundMessage-rækker
// der reelt blev sendt til brugeren (mail/push, se src/lib/messaging.ts), med
// læst/ulæst-status til det sorte tal-badge i Indstillinger.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine beskeder" }, { status: 401 });

  const messages = await prisma.outboundMessage.findMany({
    where: { userId: user.id, status: { in: ["SENT", "QUEUED"] }, subject: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, event: true, subject: true, bodyHtml: true, createdAt: true, readAt: true },
  });

  const unreadCount = messages.filter((m) => !m.readAt).length;
  return NextResponse.json({ messages, unreadCount });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at opdatere dine beskeder" }, { status: 401 });

  let body: { id?: string; markAllRead?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  if (body.markAllRead) {
    await prisma.outboundMessage.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ message: "Mangler besked-id" }, { status: 400 });

  await prisma.outboundMessage.updateMany({
    where: { id: body.id, userId: user.id },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
