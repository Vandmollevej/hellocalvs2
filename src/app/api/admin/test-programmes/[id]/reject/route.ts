import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { rejectTester } from "@/lib/integration-testers";

// Afviser en ventende testperson; pladsen bliver ledig igen
// (docs/DECISIONS.md 2026-10-02).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await rejectTester(id))) return NextResponse.json({ message: "Tilmeldingen findes ikke" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
