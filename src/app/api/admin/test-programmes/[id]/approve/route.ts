import { NextResponse } from "next/server";
import { requireFullAdminUser } from "@/lib/require-admin";
import { approveTester } from "@/lib/integration-testers";

// Godkender første testperson af en integration og giver 300 points
// (docs/DECISIONS.md 2026-10-02).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tester = await approveTester(id);
  if (!tester) return NextResponse.json({ message: "Tilmeldingen findes ikke" }, { status: 404 });
  return NextResponse.json({ tester });
}
