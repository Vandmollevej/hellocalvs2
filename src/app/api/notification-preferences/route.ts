import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { USER_TOGGLEABLE_EVENTS } from "@/lib/messaging";
import type { MessageEvent as MessageEventType } from "@prisma/client";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dine notifikationer" }, { status: 401 });

  const rows = await prisma.notificationPreference.findMany({ where: { userId: user.id } });
  const byEvent = new Map(rows.map((row) => [row.event, row]));

  const preferences = USER_TOGGLEABLE_EVENTS.map((event) => ({
    event,
    email: byEvent.get(event)?.email ?? true,
    push: byEvent.get(event)?.push ?? true,
  }));

  return NextResponse.json({ preferences });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at gemme dine notifikationer" }, { status: 401 });

  let body: { event?: string; email?: boolean; push?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  if (!body.event || !USER_TOGGLEABLE_EVENTS.includes(body.event as MessageEventType)) {
    return NextResponse.json({ message: "Ukendt notifikationstype" }, { status: 400 });
  }
  const event = body.event as MessageEventType;

  const preference = await prisma.notificationPreference.upsert({
    where: { userId_event: { userId: user.id, event } },
    create: { userId: user.id, event, email: body.email ?? true, push: body.push ?? true },
    update: { ...(body.email !== undefined ? { email: body.email } : {}), ...(body.push !== undefined ? { push: body.push } : {}) },
  });

  return NextResponse.json({ preference });
}
