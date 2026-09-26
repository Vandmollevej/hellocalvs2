import { NextResponse } from "next/server";
import { getGoal, updateGoal } from "@/lib/user-goals";
import { parseTargetDate, parseTargetValues } from "@/lib/goal-input";
import { unauthorized } from "@/lib/session";
import { getProfileUser } from "@/lib/family-access";
import { getUserSubscriptionTier } from "@/lib/subscription";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getProfileUser("goals", "VIEWED");

    if (!user) return unauthorized();
    const { id } = await params;
    const goal = await getGoal(user.id, id);
    if (!goal) return NextResponse.json({ message: "Målsætningen findes ikke" }, { status: 404 });
    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Goal read failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}

// PATCH /api/goals/[id] — samme body som POST /api/goals. Erstatter
// målsætningens dato og targets: udeladte targets slettes, ændrede værdier
// starter forfra (ny startværdi, gennemført-status nulstilles).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (Object.keys(parsed.values).length === 0) {
    return NextResponse.json({ message: "Mindst ét mål er påkrævet" }, { status: 400 });
  }

  try {
    const user = await getProfileUser("goals", "UPDATED");

    if (!user) return unauthorized();
    // Samme gating som oprettelse af delmål (docs/DECISIONS.md 2026-09-26).
    if ((await getUserSubscriptionTier(user.id)) !== "SERIOUS") {
      return NextResponse.json({ code: "PREMIUM_REQUIRED", message: "Delmål kræver Seriøs" }, { status: 403 });
    }
    const { id } = await params;
    const updated = await updateGoal(user.id, id, targetDate, parsed.values);
    if (!updated) return NextResponse.json({ message: "Målsætningen findes ikke" }, { status: 404 });
    return NextResponse.json({ goal: { id } });
  } catch (error) {
    console.error("Goal update failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
