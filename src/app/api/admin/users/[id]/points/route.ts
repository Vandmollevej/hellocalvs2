import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { AdminGrantError, grantAdminPoints } from "@/lib/admin-points-grant";
import { validateAdminGrantInput } from "@/lib/admin-points-grant-rules";

// Admin → Brugere → Tildel points (docs/DECISIONS.md 2026-10-03): højst 300
// points (én gratis måned) pr. tildeling, højst én gang pr. måned pr. bruger.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const input = validateAdminGrantInput(body ?? {});
  if (!input.ok) return NextResponse.json({ message: input.message }, { status: 400 });

  try {
    const transaction = await grantAdminPoints(id, admin.id, input.value);
    return NextResponse.json({ transaction });
  } catch (error) {
    if (error instanceof AdminGrantError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}
