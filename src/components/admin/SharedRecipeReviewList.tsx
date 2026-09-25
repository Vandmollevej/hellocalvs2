"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@prisma/client";
import { t } from "@/lib/admin-i18n";

export type SharedRecipeReviewRow = {
  id: string;
  name: string;
  owner: string;
  reportCount: number;
  kcal: number;
  ingredients: string[];
  createdAt: string;
};

type Action = "APPROVE" | "REJECT" | "BLOCK";

// Godkend/Afvis/Bloker deling som små teksthandlinger (brugerens valg
// 2026-09-23), ikke store knapper.
export function SharedRecipeReviewList({ rows, locale }: { rows: SharedRecipeReviewRow[]; locale: Locale }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  async function decide(id: string, action: Action) {
    setBusyId(id);
    const res = await fetch(`/api/admin/shared-recipes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) return;
    if (action === "BLOCK") {
      router.refresh();
      return;
    }
    setDone((current) => new Set(current).add(id));
  }

  const visible = rows.filter((row) => !done.has(row.id));
  if (visible.length === 0) {
    return <p className="text-sm text-text-secondary">{t(locale, "quality_control_empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {visible.map((row) => (
        <div
          key={row.id}
          className={`rounded-lg border bg-surface-2 p-3 ${row.reportCount > 0 ? "border-red-600" : "border-border-strong"}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium text-text-primary">{row.name}</p>
            <span className={`shrink-0 text-xs ${row.reportCount > 0 ? "font-semibold text-red-600" : "text-text-secondary"}`}>
              {row.reportCount > 0
                ? `${row.reportCount} ${t(locale, "shared_recipes_reports")}`
                : t(locale, "shared_recipes_new")}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {t(locale, "shared_recipes_owner")}: {row.owner} · {row.kcal} kcal ·{" "}
            {new Date(row.createdAt).toLocaleDateString(locale === "EN" ? "en-GB" : "da-DK")}
          </p>
          <p className="mt-1 text-xs text-text-secondary">{row.ingredients.join(", ")}</p>
          <div className="mt-2 flex gap-4 text-xs font-semibold">
            {(["APPROVE", "REJECT", "BLOCK"] as const).map((action) => (
              <button
                key={action}
                type="button"
                disabled={busyId === row.id}
                onClick={() => decide(row.id, action)}
                className="text-text-primary underline disabled:opacity-40"
              >
                {t(
                  locale,
                  action === "APPROVE"
                    ? "shared_recipes_approve"
                    : action === "REJECT"
                      ? "shared_recipes_reject"
                      : "shared_recipes_block"
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
