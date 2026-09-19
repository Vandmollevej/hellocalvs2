import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { commitSearchRankingWeights, sanitizeWeights } from "@/lib/search-ranking-config";

// POST /api/admin/search-ranking/[id]/restore — the Søgealgoritmer page's
// "Gendan" button: re-commits an older version's weights as the new active
// row, per the admin's explicit request for a backup/restore function
// (docs/DECISIONS.md, 2026-09-19). History stays append-only — this never
// edits or deletes the old row, it just adds a new one on top of it.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const source = await prisma.searchRankingConfig.findUnique({ where: { id } });
    if (!source) return NextResponse.json({ message: "Findes ikke" }, { status: 404 });

    const config = await commitSearchRankingWeights(
      sanitizeWeights(source.weights),
      admin.id,
      `Gendannet fra version ${source.createdAt.toISOString()}`
    );
    return NextResponse.json({ config });
  } catch (error) {
    console.error("Failed to restore search ranking weights", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
