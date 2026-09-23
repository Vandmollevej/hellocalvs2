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

// Kalenderdato "YYYY-MM-DD" → Date kl. 12:00 UTC, så datoen ikke skifter ved
// tidszonekonvertering. Null ved ugyldig dato eller en dato før i dag.
function parseTargetDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  // Én dags slæk, så en klient i en tidszone foran UTC kan vælge sin egen "i dag".
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return value >= yesterday ? date : null;
}

// POST /api/goals — body: { targetDate: "YYYY-MM-DD", targets: { weight?: number,
// waistCm?: number, … } }. Tomme felter udelades; mindst ét target og en
// målsætningsdato fra i dag og frem er påkrævet.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { targetDate?: unknown; targets?: Record<string, unknown> }
    | null;
  const raw = body?.targets ?? {};

  const targetDate = parseTargetDate(body?.targetDate);
  if (!targetDate) {
    return NextResponse.json({ message: "Ugyldig målsætningsdato" }, { status: 400 });
  }

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
