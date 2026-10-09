import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { unblockUser } from "@/lib/pet-food-strikes";

// Ophæver en spærring (dyrefoder-spærringen, docs/DECISIONS.md 2026-10-07).
// Brugeren kan logge ind igen og har igen én advarsel.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await unblockUser(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Kunne ikke ophæve spærringen" }, { status: 400 });
  }
}