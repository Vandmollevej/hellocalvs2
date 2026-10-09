import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { sanitizeReminderHours } from "@/lib/weigh-reminders";

// Brugerens vejepåmindelser (docs/DECISIONS.md 2026-10-07).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const pref = await prisma.weighReminderPref.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ enabled: pref?.enabled ?? false, hours: pref?.hours ?? [] });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { enabled?: unknown; hours?: unknown };
  const data = { enabled: body.enabled === true, hours: sanitizeReminderHours(body.hours) };
  await prisma.weighReminderPref.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  return NextResponse.json(data);
}
