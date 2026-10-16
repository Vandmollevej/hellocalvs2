import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/ttl-cache";
import { SPELLING_PAGE_SIZE, SPELLING_TABS, spellingTab, type SpellingIssueRow, type SpellingTabKey } from "@/lib/spelling-issues-types";

export { SPELLING_PAGE_SIZE, SPELLING_TABS, spellingTab, type SpellingIssueRow, type SpellingTabKey };

// Rækkerne på admin → Stavekontrol (docs/DECISIONS.md 2026-10-14): lette
// rækker pr. udsnit (REGLER "Lange admin-lister"); varens navn slås op samlet.

export async function spellingTabCounts(): Promise<Record<SpellingTabKey, number>> {
  return cached("spelling-counts", 30_000, async () => {
    const groups = await prisma.spellingIssue.groupBy({ by: ["status"], _count: { _all: true } });
    const byStatus = new Map(groups.map((group) => [group.status, group._count._all]));
    return Object.fromEntries(
      SPELLING_TABS.map((tab) => [tab.key, tab.statuses.reduce((sum, status) => sum + (byStatus.get(status) ?? 0), 0)]),
    ) as Record<SpellingTabKey, number>;
  });
}

export async function listSpellingIssues(tabKey: string, offset: number, limit = SPELLING_PAGE_SIZE): Promise<SpellingIssueRow[]> {
  const tab = spellingTab(tabKey);
  const issues = await prisma.spellingIssue.findMany({
    where: { status: { in: [...tab.statuses] } },
    // Til gennemsyn: de mest sikre forslag først (hurtigst at godkende i bunker).
    orderBy: tab.key === "pending" ? [{ confidence: "desc" }, { word: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "asc" }],
    skip: Math.max(0, offset),
    take: Math.min(limit, 200),
  });
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(issues.map((issue) => issue.productId))] } },
    select: { id: true, name: true },
  });
  const names = new Map(products.map((product) => [product.id, product.name]));
  return issues.map((issue) => ({
    id: issue.id,
    productId: issue.productId,
    productName: names.get(issue.productId) ?? "(slettet vare)",
    word: issue.word,
    suggestion: issue.suggestion,
    appliedText: issue.appliedText,
    confidence: issue.confidence,
    reason: issue.reason,
    contextBefore: issue.contextBefore,
    contextAfter: issue.contextAfter,
    status: issue.status,
    createdAt: issue.createdAt.toISOString(),
  }));
}
