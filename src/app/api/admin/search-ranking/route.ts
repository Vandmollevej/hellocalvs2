import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SEARCH_RANKING_WEIGHTS } from "@/lib/product-search-ranking";
import { commitSearchRankingWeights, sanitizeWeights } from "@/lib/search-ranking-config";

// GET /api/admin/search-ranking — the currently active (committed) weights
// plus the full commit history, for the Søgealgoritmer admin page. Every
// past commit is kept (see docs/DECISIONS.md, 2026-09-19) so this list also
// serves as the "backup" the admin can restore from.
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const configs = await prisma.searchRankingConfig.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { displayName: true, email: true } } },
  });
  const active = configs.find((config) => config.isActive);

  return NextResponse.json({
    weights: active ? sanitizeWeights(active.weights) : DEFAULT_SEARCH_RANKING_WEIGHTS,
    defaultWeights: DEFAULT_SEARCH_RANKING_WEIGHTS,
    activeId: active?.id ?? null,
    history: configs.map((config) => ({
      id: config.id,
      weights: sanitizeWeights(config.weights),
      isActive: config.isActive,
      note: config.note,
      createdAt: config.createdAt,
      createdBy: config.createdBy?.displayName ?? config.createdBy?.email ?? null,
    })),
  });
}

// POST /api/admin/search-ranking — commit a draft as the live weights used
// by /api/products and /api/generic-ingredients from now on. Inserts a new
// row and deactivates the previous one rather than overwriting it, so the
// history above always has the pre-commit settings to restore.
// Body: { weights: SearchRankingWeights, note?: string }
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const weights = sanitizeWeights(body.weights);
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;

  try {
    const config = await commitSearchRankingWeights(weights, admin.id, note);
    return NextResponse.json({ config });
  } catch (error) {
    console.error("Failed to commit search ranking weights", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
