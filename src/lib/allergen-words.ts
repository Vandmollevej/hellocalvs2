import { prisma } from "@/lib/prisma";
import { cached, invalidateCache } from "@/lib/ttl-cache";
import type { ExtraAllergenWord } from "@/lib/allergen-highlight";

// Godkendte allergen-ord fra allergen-robotten (docs/DECISIONS.md 2026-10-17),
// som web og app henter via GET /api/allergens/words og lægger oven i de faste
// stammer i src/lib/allergen-highlight.ts.

const CACHE_KEY = "allergen-words:approved";

export function approvedAllergenWords(): Promise<ExtraAllergenWord[]> {
  return cached(CACHE_KEY, 10 * 60 * 1000, async () => {
    const rows = await prisma.allergenWord.findMany({
      where: { status: "APPROVED", allergenKey: { not: null } },
      select: { word: true, allergenKey: true },
      orderBy: { word: "asc" },
    });
    return rows.map((row) => ({ word: row.word, allergen: row.allergenKey as string }));
  });
}

export function invalidateAllergenWords() {
  invalidateCache("allergen-words");
}
