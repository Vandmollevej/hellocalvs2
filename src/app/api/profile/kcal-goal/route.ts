import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { computeAge } from "@/lib/age";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import { currentDailyBudget, recordDailyBudget } from "@/lib/activity-profile";
import { SNOOZE_DAYS, suggestDailyKcalGoal } from "@/lib/kcal-goal-suggestion";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 35;
const TIME_ZONE = "Europe/Copenhagen";

// Calendar-style day key (`year-monthIndex-day`) for the Danish calendar day.
function copenhagenDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, number>>((acc, part) => ({ ...acc, [part.type]: Number(part.value) }), {});
  return new Date(parts.year, parts.month - 1, parts.day);
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// GET /api/profile/kcal-goal — the suggested new daily kcal limit, or
// { suggestion: null } when there's no mismatch, too little data, or the user
// snoozed / switched the prompt off.
export async function GET(req: Request) {
  try {
    const tz = Number(new URL(req.url).searchParams.get("tz")) || 0;
    const user = await getProfileUser("profile", "VIEWED");
    if (!user) return unauthorized();
    if (user.kcalGoalPromptDisabled) return NextResponse.json({ suggestion: null });
    if (user.kcalGoalPromptSnoozedUntil && user.kcalGoalPromptSnoozedUntil.getTime() > Date.now()) {
      return NextResponse.json({ suggestion: null });
    }

    const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);
    const [registrations, weighIns, activities] = await Promise.all([
      prisma.registration.findMany({ where: { userId: user.id, createdAt: { gte: since } }, select: { createdAt: true, kcalSnapshot: true } }),
      prisma.weightEntry.findMany({ where: { userId: user.id, weighedAt: { gte: since } }, select: { weightKg: true, weighedAt: true } }),
      prisma.activity.findMany({ where: { userId: user.id, startedAt: { gte: since } }, select: { startedAt: true, caloriesBurned: true } }),
    ]);

    const dailyTotals = new Map<string, number>();
    for (const row of registrations) {
      const key = dayKey(copenhagenDay(row.createdAt));
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + row.kcalSnapshot);
    }

    const suggestion = suggestDailyKcalGoal({
      currentKcal: (await currentDailyBudget(user.id, tz)) ?? DAILY_KCAL_GOAL,
      dailyTotals,
      weighIns: weighIns.map((w) => ({ weightKg: w.weightKg, weighedAt: w.weighedAt.toISOString() })),
      activities: activities.map((a) => ({ startedAt: a.startedAt.toISOString(), caloriesBurned: a.caloriesBurned })),
      profile: {
        weightKg: user.weightKg,
        heightCm: user.heightCm,
        age: computeAge(user.birthDate),
        sex: user.sex,
        activityLevel: user.activityLevel,
        palBase: user.palBase,
        trainingAllowanceKcal: user.trainingAllowanceKcal,
      },
      today: copenhagenDay(new Date()),
    });
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Kcal goal suggestion failed", error);
    return NextResponse.json({ suggestion: null }, { status: 503 });
  }
}

// POST /api/profile/kcal-goal — { action: "apply", kcal } | "snooze" | "disable".
export async function POST(req: Request) {
  const user = await getProfileUser("profile", "UPDATED");
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { action?: string; kcal?: number; tz?: number };

  if (body.action === "apply") {
    const kcal = Math.round(Number(body.kcal));
    if (!Number.isFinite(kcal) || kcal < 500 || kcal > 10000) {
      return NextResponse.json({ message: "kcal er ugyldig" }, { status: 400 });
    }
    // Forward-only, like every budget change (docs/ACTIVITY-PAL.md): a new
    // snapshot for today; earlier days keep their own goal. The need shifts
    // by the same amount as the budget.
    const tz = Number(body.tz) || 0;
    const previous = await prisma.dailyBudgetSnapshot.findFirst({ where: { userId: user.id }, orderBy: { date: "desc" }, select: { budgetKcal: true, needKcal: true } });
    const need = previous ? previous.needKcal + (kcal - previous.budgetKcal) : kcal;
    await recordDailyBudget(user.id, kcal, need, tz);
    await prisma.user.update({ where: { id: user.id }, data: { kcalGoalUpdatedAt: new Date(), kcalGoalPromptSnoozedUntil: null } });
    return NextResponse.json({ dailyKcalGoal: kcal });
  }
  if (body.action === "snooze") {
    await prisma.user.update({ where: { id: user.id }, data: { kcalGoalPromptSnoozedUntil: new Date(Date.now() + SNOOZE_DAYS * DAY_MS) } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "disable") {
    await prisma.user.update({ where: { id: user.id }, data: { kcalGoalPromptDisabled: true } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ message: "Ukendt handling" }, { status: 400 });
}
