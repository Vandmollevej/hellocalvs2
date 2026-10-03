import { NextResponse } from "next/server";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import { getLatestPersonaSnapshot, runPersonaAnalysis } from "@/lib/personas";

// Admin → Brugere → Personas (docs/DECISIONS.md 2026-10-02).
// GET: seneste snapshot. POST: "Beregn nu" — grupperer brugerne anonymt og
// beder OpenAI om personas; kræver fuld administratoradgang (koster penge).

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const snapshot = await getLatestPersonaSnapshot();
  return NextResponse.json({ snapshot });
}

export async function POST() {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Kræver fuld administratoradgang" }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ message: "OPENAI_API_KEY er ikke sat" }, { status: 503 });

  const snapshot = await runPersonaAnalysis("manual");
  if (snapshot.error) return NextResponse.json({ message: snapshot.error, snapshotId: snapshot.id }, { status: 502 });
  return NextResponse.json({
    snapshotId: snapshot.id,
    userCount: snapshot.userCount,
    personas: snapshot.personas?.personas.length ?? 0,
    model: snapshot.model,
  });
}
