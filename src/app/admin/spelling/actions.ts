"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser, requireFullAdminUser } from "@/lib/require-admin";
import { invalidateCache } from "@/lib/ttl-cache";
import { listSpellingIssues, type SpellingIssueRow } from "@/lib/spelling-issues-query";
import { acceptSpellingIssues, rejectSpellingIssues, revertSpellingIssues } from "@/lib/spelling-review";

// Handlinger på admin → Stavekontrol (docs/DECISIONS.md 2026-10-14).

export type SpellingAction = "accept" | "reject" | "revert";
type Result = { ok: boolean; message: string; failedIds: string[] };

export async function loadSpellingIssues(tab: string, offset: number): Promise<SpellingIssueRow[]> {
  if (!(await requireAdminUser())) return [];
  return listSpellingIssues(String(tab), Number(offset) || 0);
}

export async function applySpellingAction(action: SpellingAction, ids: string[], ownTexts: Record<string, string>): Promise<Result> {
  const admin = await requireFullAdminUser();
  if (!admin) return { ok: false, message: "Kun fuld admin-adgang kan rette stavefejl", failedIds: [] };
  const cleanIds = ids.map(String).slice(0, 500);
  if (!cleanIds.length) return { ok: false, message: "Vælg mindst én række", failedIds: [] };
  const texts = Object.fromEntries(Object.entries(ownTexts ?? {}).map(([id, text]) => [String(id), String(text).slice(0, 200)]));

  const outcome =
    action === "accept"
      ? await acceptSpellingIssues(cleanIds, texts, admin.id)
      : action === "reject"
        ? await rejectSpellingIssues(cleanIds, admin.id)
        : await revertSpellingIssues(cleanIds, admin.id);

  invalidateCache("spelling-counts");
  revalidatePath("/admin/spelling");
  const verb = action === "accept" ? "godkendt" : action === "reject" ? "afvist" : "fortrudt";
  const failed = outcome.failed.length
    ? ` ${outcome.failed.length} kunne ikke: ${[...new Set(outcome.failed.map((item) => item.reason))].join("; ")}.`
    : "";
  return { ok: outcome.failed.length === 0, message: `${outcome.ok} ${verb}.${failed}`, failedIds: outcome.failed.map((item) => item.id) };
}
