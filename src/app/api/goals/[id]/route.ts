import { NextResponse } from "next/server";
import { getGoal } from "@/lib/user-goals";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();

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
