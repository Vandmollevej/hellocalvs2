import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { createFlow } from "@/lib/flows";

// Opret et nyt flow (docs/DECISIONS.md 2026-09-27, "Flows i admin").
export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ message: "Giv flowet et navn" }, { status: 400 });
  const flow = await createFlow(name);
  return NextResponse.json({ id: flow.id });
}
