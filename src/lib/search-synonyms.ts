import { prisma } from "@/lib/prisma";

export type SynonymExpansion = { term: string; similarity: number };

export function normalizeSynonymTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Words the admin has declared (partly) interchangeable with the typed query,
// across all languages. `similarity` is 0..1. Failures never break search.
export async function getSynonymExpansions(query: string): Promise<SynonymExpansion[]> {
  const q = normalizeSynonymTerm(query);
  if (q.length < 2) return [];
  try {
    const rows = await prisma.searchSynonym.findMany({
      where: { similarity: { gt: 0 }, OR: [{ termA: q }, { termB: q }] },
    });
    const best = new Map<string, number>();
    for (const row of rows) {
      const term = row.termA === q ? row.termB : row.termA;
      if (term === q) continue;
      best.set(term, Math.max(best.get(term) ?? 0, row.similarity / 100));
    }
    return [...best].map(([term, similarity]) => ({ term, similarity }));
  } catch (error) {
    console.error("Failed to load search synonyms", error);
    return [];
  }
}
