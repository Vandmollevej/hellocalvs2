import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";

// POST /api/admin/duplicate-products/[id]/dismiss — mark a flagged pair as
// "not actually a duplicate" without merging anything (docs/ADMIN.md
// "Dobbeltoprettelser").
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  const { id } = await params;
  const link = await prisma.productDuplicateLink.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
  if (link.status !== "PENDING") {
    return NextResponse.json({ message: "Denne dobbeltoprettelse er allerede behandlet" }, { status: 409 });
  }

  await prisma.productDuplicateLink.update({
    where: { id },
    data: { status: "DISMISSED", resolvedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
