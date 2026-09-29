import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// Admin-afgørelse på en brugertilføjet aktivitet (docs/DECISIONS.md 2026-09-29).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== "APPROVE" && body?.action !== "REJECT") {
    return NextResponse.json({ message: "Ugyldig handling" }, { status: 400 });
  }
  const updated = await prisma.customActivityType.updateMany({
    where: { id },
    data: { status: body.action === "APPROVE" ? "APPROVED" : "REJECTED", reviewedAt: new Date() },
  });
  if (updated.count === 0) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
