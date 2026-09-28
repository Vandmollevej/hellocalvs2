import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { setDebugLogEnabled } from "@/lib/debug-log";

// Admin "Log" (docs/DECISIONS.md 2026-09-28): slå test-logningen til/fra
// (PATCH { enabled }) og ryd loggen (DELETE).
export async function PATCH(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  await setDebugLogEnabled(body.enabled);
  return NextResponse.json({ enabled: body.enabled });
}

export async function DELETE() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { count } = await prisma.debugLog.deleteMany({});
  return NextResponse.json({ deleted: count });
}
