import { NextResponse } from "next/server";
import { getProfileUser } from "@/lib/family-access";
import { unauthorized } from "@/lib/session";
import { isActivityLevel } from "@/lib/activity-level";
import { applyActivityAnswers, applyManualLevel, energySummaryFor, parseActivityAnswers } from "@/lib/activity-profile";

// Aktivitetsniveau og regnestykke (docs/ACTIVITY-PAL.md).
// GET: regnestykket for profilen. PUT: gem onboarding-svar og beregn PAL.
// PATCH { activityLevel }: brugeren retter niveauet selv.

export async function GET() {
  try {
    const user = await getProfileUser("profile", "VIEWED");
    if (!user) return unauthorized();
    return NextResponse.json({ summary: energySummaryFor(user), answers: user.activityAnswers });
  } catch (error) {
    console.error("Activity summary failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  try {
    const user = await getProfileUser("profile", "UPDATED");
    if (!user) return unauthorized();
    const answers = parseActivityAnswers(body?.answers ?? body);
    const updated = await applyActivityAnswers(user, answers);
    return NextResponse.json({ summary: energySummaryFor(updated), answers });
  } catch (error) {
    console.error("Activity answers failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const level = body?.activityLevel;
  if (!isActivityLevel(level)) {
    return NextResponse.json({ message: "Ugyldigt aktivitetsniveau" }, { status: 400 });
  }
  try {
    const user = await getProfileUser("profile", "UPDATED");
    if (!user) return unauthorized();
    const updated = await applyManualLevel(user.id, level);
    return NextResponse.json({ summary: energySummaryFor(updated) });
  } catch (error) {
    console.error("Manual activity level failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
