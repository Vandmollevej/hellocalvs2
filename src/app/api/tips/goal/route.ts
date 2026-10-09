import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import { currentDailyBudget } from "@/lib/activity-profile";
import { buildGoalTip } from "@/lib/goal-tip";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 14;

function copenhagenDay(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(date);
}

// GET /api/tips/goal — tip til at nå dagens mål ud fra brugerens vanlige indtag.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    const tz = Number(new URL(req.url).searchParams.get("tz")) || 0;
    const now = new Date();
    const today = copenhagenDay(now);
    const rows = await prisma.registration.findMany({
      where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS) } },
      select: { createdAt: true, kcalSnapshot: true },
    });
    const totals = new Map<string, number>();
    for (const row of rows) {
      const day = copenhagenDay(row.createdAt);
      if (day === today) continue; // dagen i dag er ikke slut endnu
      totals.set(day, (totals.get(day) ?? 0) + row.kcalSnapshot);
    }
    const goalKcal = (await currentDailyBudget(user.id, tz)) ?? DAILY_KCAL_GOAL;
    const tip = buildGoalTip({ dailyTotals: [...totals.values()], goalKcal, weightKg: user.weightKg });
    return NextResponse.json({ tip });
  } catch (error) {
    console.error("Goal tip failed", error);
    return NextResponse.json({ tip: null });
  }
}
