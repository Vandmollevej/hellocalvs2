import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { reviewPetFoodIncident, type PetFoodReviewAction } from "@/lib/pet-food-strikes";

const ACTIONS: PetFoodReviewAction[] = ["false-positive", "confirm", "reject-product"];

// Gennemgang af en dyrefoder-afvisning fra admin-oversigten (docs/DECISIONS.md 2026-10-07).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = ACTIONS.find((candidate) => candidate === body?.action);
  if (!action) return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });

  const { id } = await params;
  try {
    await reviewPetFoodIncident(id, action);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Kunne ikke gemme gennemgangen" }, { status: 400 });
  }
}
