import { NextResponse } from "next/server";
import { getDemoUser } from "@/lib/demo-user";
import { createGoal, GOAL_TARGET_TYPES, listGoals, type GoalTargetType } from "@/lib/user-goals";

export async function GET() {
  try {
    const user = await getDemoUser();
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

// POST /api/goals — body: { targets: { weight?: number, waistCm?: number, … } }.
// Tomme felter udelades; mindst ét target er påkrævet.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { targets?: Record<string, unknown> } | null;
  const raw = body?.targets ?? {};

  const values: Partial<Record<GoalTargetType, number>> = {};
  for (const type of GOAL_TARGET_TYPES) {
    const value = raw[type];
    if (value == null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ message: `Ugyldig værdi for ${type}` }, { status: 400 });
    }
    values[type] = value;
  }

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ message: "Mindst ét mål er påkrævet" }, { status: 400 });
  }

  try {
    const user = await getDemoUser();
    const goal = await createGoal(user.id, values);
    return NextResponse.json({ goal: { id: goal.id } });
  } catch (error) {
    console.error("Goal create failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
