import type { SpellingIssueStatus } from "@prisma/client";

// Faner, sidestørrelse og rækketype til admin → Stavekontrol — uden
// databaseadgang, så tabellen i browseren kan bruge dem.

export const SPELLING_TABS = [
  { key: "pending", label: "Til gennemsyn", statuses: ["PENDING"] },
  { key: "auto", label: "Rettet automatisk", statuses: ["AUTO_FIXED"] },
  { key: "accepted", label: "Godkendt", statuses: ["ACCEPTED"] },
  { key: "rejected", label: "Afvist / fortrudt", statuses: ["REJECTED", "REVERTED"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly SpellingIssueStatus[] }[];

export type SpellingTabKey = (typeof SPELLING_TABS)[number]["key"];

export const SPELLING_PAGE_SIZE = 50;

export type SpellingIssueRow = {
  id: string;
  productId: string;
  productName: string;
  word: string;
  suggestion: string | null;
  appliedText: string | null;
  confidence: number;
  reason: string;
  contextBefore: string;
  contextAfter: string;
  status: SpellingIssueStatus;
  createdAt: string;
};

export function spellingTab(key: string | undefined) {
  return SPELLING_TABS.find((tab) => tab.key === key) ?? SPELLING_TABS[0];
}

