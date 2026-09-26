import { NextResponse } from "next/server";
import { createGoal, listGoals } from "@/lib/user-goals";
import { parseTargetDate, parseTargetValues } from "@/lib/goal-input";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { getUserSubscriptionTier } from "@/lib/subscription";

export async function GET() {
  try {
    const user = await getProfileUser("goals", "VIEWED");

    if (!user) return unauthorized();
    const goals = await listGoals(user.id);
    return NextResponse.json({ goals });
  } catch (error) {
    console.error("Goal list failed", error);
    return NextResponse.json(
      { goals: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

// POST /api/goals — body: { targetDate: "YYYY-MM-DD", targets: { weight?: number,
// waistCm?: number, … } }. Tomme felter udelades; mindst ét target og en
// målsætningsdato fra i dag og frem er påkrævet.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { targetDate?: unknown; targets?: Record<string, unknown> }
    | null;

  const targetDate = parseTargetDate(body?.targetDate);
  if (!targetDate) {
    return NextResponse.json({ message: "Ugyldig målsætningsdato" }, { status: 400 });
  }

  const parsed = parseTargetValues(body?.targets ?? {});
  if ("invalid" in parsed) {
    return NextResponse.json({ message: `Ugyldig værdi for ${parsed.invalid}` }, { status: 400 });
  }
  const { values } = parsed;

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ message: "Mindst ét mål er påkrævet" }, { status: 400 });
  }

  try {
    const user = await getProfileUser("goals", "CREATED");

    if (!user) return unauthorized();
    // Delmål er kun for Seriøs; Gratis har én målsætning i alt (målvægten)
    // og ingen delmål (docs/DECISIONS.md 2026-09-26).
    if ((await getUserSubscriptionTier(user.id)) !== "SERIOUS") {
      return NextResponse.json({ code: "PREMIUM_REQUIRED", message: "Delmål kræver Seriøs" }, { status: 403 });
    }
    const goal = await createGoal(user.id, targetDate, values);
    return NextResponse.json({ goal: { id: goal.id } });
  } catch (error) {
    console.error("Goal create failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
