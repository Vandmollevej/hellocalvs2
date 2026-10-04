import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFullAdminUser } from "@/lib/require-admin";

// POST /api/admin/brand-logos/batches — opretter et nyt parti (ét drag and
// drop = ét parti med tidsstempel). Filerne sendes derefter én ad gangen til
// /api/admin/brand-logos/batches/[batchId]/items. Se docs/DECISIONS.md 2026-10-04.
export async function POST() {
  const admin = await requireFullAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const batch = await prisma.brandLogoUploadBatch.create({ data: { createdById: admin.id } });
  return NextResponse.json({ batch: { id: batch.id, createdAt: batch.createdAt.toISOString() } });
}
