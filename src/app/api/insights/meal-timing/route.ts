import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { getUserSubscriptionTier } from "@/lib/subscription";
import { computeMealInsights, type TimedKcal } from "@/lib/meal-timing";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 30;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(date: Date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

// POST (Udregn-knappen på statistik-siden): kun betalende brugere (Seriøs).
export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if ((await getUserSubscriptionTier(user.id)) !== "SERIOUS") {
    return NextResponse.json({ message: "Kræver Seriøs-abonnement" }, { status: 403 });
  }
  const rows = await prisma.registration.findMany({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - LOOKBACK_DAYS * DAY_MS) } },
    select: { createdAt: true, kcalSnapshot: true },
  });
  const entries: TimedKcal[] = rows.map((r) => ({ ...parts(r.createdAt), kcal: r.kcalSnapshot }));
  const bedtime = user.defaultBedtime?.match(/^(\d{1,2}):(\d{2})/);
  const bedtimeMinutes = bedtime ? Number(bedtime[1]) * 60 + Number(bedtime[2]) : null;
  return NextResponse.json({ insights: computeMealInsights(entries, bedtimeMinutes) });
}
