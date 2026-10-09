import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/dishes/:id/disable — { disabled: boolean }
// Admin → Retter → HelloFresh: det eneste admin kan rette på en ret er at
// deaktivere den (status REJECTED) eller aktivere den igen (APPROVED).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { disabled?: unknown } | null;
  if (typeof body?.disabled !== "boolean") return NextResponse.json({ message: "Ugyldigt input" }, { status: 400 });
  const result = await prisma.product.updateMany({
    where: { id, externalSource: "HELLOFRESH" },
    data: { status: body.disabled ? "REJECTED" : "APPROVED" },
  });
  if (result.count === 0) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  return NextResponse.json({ ok: true, status: body.disabled ? "REJECTED" : "APPROVED" });
}
