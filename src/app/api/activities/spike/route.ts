import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { findPendingSpike } from "@/lib/heart-rate-spikes";

// GET: det nyeste mærkbare pulsudsving, brugeren ikke er spurgt om (eller null).
export async function GET() {
  const user = await getProfileUser("activities", "VIEWED");
  if (!user) return unauthorized();
  try {
    return NextResponse.json({ spike: await findPendingSpike(user.id) });
  } catch (error) {
    console.error("Heart rate spike lookup failed", error);
    return NextResponse.json({ spike: null });
  }
}

// POST { startedAt, endedAt, extraKcal, activityId? }: udsvinget er besvaret
// (med en aktivitet) eller sprunget over (uden). Spørges ikke igen.
export async function POST(req: Request) {
  const user = await getProfileUser("activities", "CREATED");
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    startedAt?: string;
    endedAt?: string;
    extraKcal?: number;
    activityId?: string;
  };
  const startedAt = new Date(body.startedAt ?? "");
  const endedAt = new Date(body.endedAt ?? "");
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return NextResponse.json({ message: "Ugyldigt tidsrum" }, { status: 400 });
  }
  const data = {
    endedAt,
    extraKcal: Number(body.extraKcal) || 0,
    activityId: body.activityId ?? null,
    dismissed: !body.activityId,
  };
  await prisma.heartRateSpikeReview.upsert({
    where: { userId_startedAt: { userId: user.id, startedAt } },
    create: { userId: user.id, startedAt, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}
