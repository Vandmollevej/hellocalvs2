import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SEARCH_RANKING_WEIGHTS, type SearchRankingWeights } from "@/lib/product-search-ranking";

// Backing store for the admin "Søgealgoritmer" page (docs/DECISIONS.md,
// 2026-09-19): a draft is tuned and live-tested against the real database
// before the admin explicitly commits it, and every commit keeps the
// previous active row as history/backup instead of overwriting it.

const WEIGHT_KEYS = Object.keys(DEFAULT_SEARCH_RANKING_WEIGHTS) as (keyof SearchRankingWeights)[];
const WEIGHT_MIN = -100;
const WEIGHT_MAX = 100;

// Clamps/coerces an arbitrary JSON value into a complete, safe
// SearchRankingWeights object — any missing/invalid key falls back to the
// default for that key, so a partial or corrupted stored row can never
// crash ranking or silently zero out every other weight.
export function sanitizeWeights(input: unknown): SearchRankingWeights {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SEARCH_RANKING_WEIGHTS };
  for (const key of WEIGHT_KEYS) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, value));
    }
  }
  return out;
}

// Read by the real end-user search routes (/api/products,
// /api/generic-ingredients) on every request. No local caching — the extra
// query is cheap next to the surrounding product/ingredient lookup, and a
// just-committed change must take effect immediately for the admin's own
// live test to be believable.
export async function getActiveSearchRankingWeights(): Promise<SearchRankingWeights> {
  try {
    const active = await prisma.searchRankingConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!active) return DEFAULT_SEARCH_RANKING_WEIGHTS;
    return sanitizeWeights(active.weights);
  } catch (error) {
    console.error("Failed to load active search ranking weights, using defaults", error);
    return DEFAULT_SEARCH_RANKING_WEIGHTS;
  }
}

// Commits a new draft as the live weights: inserts a fresh row and flips the
// previously active row (if any) to inactive, rather than overwriting it —
// that inactive row is exactly the "backup" the admin page's history list
// shows and can restore from.
export async function commitSearchRankingWeights(
  weights: SearchRankingWeights,
  adminId: string,
  note?: string
) {
  return prisma.$transaction(async (tx) => {
    await tx.searchRankingConfig.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.searchRankingConfig.create({
      data: {
        weights: weights as unknown as Prisma.InputJsonValue,
        isActive: true,
        note,
        createdById: adminId,
      },
    });
  });
}
