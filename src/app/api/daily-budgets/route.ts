import { NextResponse } from "next/server";
import { getProfileUser } from "@/lib/family-access";
import { unauthorized } from "@/lib/session";
import { listDailyBudgets } from "@/lib/activity-profile";

// GET /api/daily-budgets — kaloriebudget pr. dato (src/lib/daily-budget.ts).
// Kalender og statistik slår datoens budget op her; dage før den første
// snapshot bruger det gamle faste mål.
export async function GET() {
  try {
    const user = await getProfileUser("profile", "VIEWED");
    if (!user) return unauthorized();
    return NextResponse.json({ snapshots: await listDailyBudgets(user.id) });
  } catch (error) {
    console.error("Daily budget list failed", error);
    return NextResponse.json({ snapshots: [], message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
