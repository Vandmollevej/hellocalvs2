import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Marks a support request resolved/reopened (docs/DECISIONS.md 2026-09-23).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = body?.status === "RESOLVED" ? "RESOLVED" : body?.status === "OPEN" ? "OPEN" : null;
  if (!status) return NextResponse.json({ message: "Ugyldig status" }, { status: 400 });

  const updated = await prisma.supportRequest.updateMany({
    where: { id },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
  if (updated.count === 0) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
