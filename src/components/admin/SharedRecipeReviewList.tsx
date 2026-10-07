"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@prisma/client";
import { t } from "@/lib/admin-i18n";

// Kopi-tjekkets resultat (src/lib/recipe-copy-check.ts), som det er gemt.
export type CopyCheckView = {
  ratio: number;
  source: { kind: string; id: string; name: string };
  candidateWords: string[];
  sourceWords: string[];
  candidateRanges: [number, number][];
  sourceRanges: [number, number][];
};

const SOURCE_LABELS: Record<string, string> = {
  shared: "Delt ret fra en anden bruger",
  hellofresh: "HelloFresh",
  valdemarsro: "Valdemarsro",
};

// Teksten med de sammenfaldende stykker markeret.
function HighlightedText({ words, ranges }: { words: string[]; ranges: [number, number][] }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([from, to], index) => {
    if (from > cursor) parts.push(words.slice(cursor, from).join(" ") + " ");
    parts.push(
      <mark key={index} className="rounded bg-hf-tan-dark px-0.5 text-hf-black">
        {words.slice(from, to).join(" ")}
      </mark>,
      " ",
    );
    cursor = to;
  });
  if (cursor < words.length) parts.push(words.slice(cursor).join(" "));
  return <p className="hf-type-small whitespace-pre-wrap text-hf-black">{parts}</p>;
}

function CopyWarning({ check }: { check: CopyCheckView }) {
  return (
    <div className="mt-3 rounded-lg border border-hf-red-dark bg-hf-cream p-3">
      <p className="hf-type-small hf-type-strong text-hf-red-dark">
        Advarsel: {Math.round(check.ratio * 100)} % sammenfald med en anden ret
      </p>
      <p className="hf-type-small mt-1 text-text-secondary">
        Kilde: {SOURCE_LABELS[check.source.kind] ?? check.source.kind} — {check.source.name}
      </p>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div>
          <p className="hf-type-small hf-type-strong mb-1 text-hf-black">Den delte ret</p>
          <HighlightedText words={check.candidateWords} ranges={check.candidateRanges} />
        </div>
        <div>
          <p className="hf-type-small hf-type-strong mb-1 text-hf-black">Fundet kilde</p>
          <HighlightedText words={check.sourceWords} ranges={check.sourceRanges} />
        </div>
      </div>
    </div>
  );
}

export type SharedRecipeReviewRow = {
  copyCheck?: CopyCheckView | null;
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

  // Afvisning af en kopi-flaget ret åbner en boks, hvor admin skriver begrundelsen.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function decide(id: string, action: Action, rejectReason?: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/shared-recipes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: rejectReason }),
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) return;
    setRejectingId(null);
    setReason("");
    if (action === "BLOCK") {
      router.refresh();
      return;
    }
    setDone((current) => new Set(current).add(id));
  }

  const visible = rows.filter((row) => !done.has(row.id));
  if (visible.length === 0) {
    return <p className="hf-type-body text-text-secondary">{t(locale, "quality_control_empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {visible.map((row) => (
        <div
          key={row.id}
          className={`rounded-lg border bg-hf-white p-4 ${row.reportCount > 0 ? "border-hf-red-dark" : "border-hf-tan-dark"}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="hf-type-strong text-hf-black">{row.name}</p>
            <span className={`hf-type-small shrink-0 ${row.reportCount > 0 ? "hf-type-strong text-hf-red-dark" : "text-text-secondary"}`}>
              {row.reportCount > 0
                ? `${row.reportCount} ${t(locale, "shared_recipes_reports")}`
                : t(locale, "shared_recipes_new")}
            </span>
          </div>
          <p className="hf-type-small mt-1 text-text-secondary">
            {t(locale, "shared_recipes_owner")}: {row.owner} · {row.kcal} kcal ·{" "}
            {new Date(row.createdAt).toLocaleDateString(locale === "EN" ? "en-GB" : "da-DK")}
          </p>
          <p className="hf-type-small mt-1 text-text-secondary">{row.ingredients.join(", ")}</p>
          {row.copyCheck && <CopyWarning check={row.copyCheck} />}
          {rejectingId === row.id && (
            <div className="mt-3 rounded-lg border border-hf-tan-dark bg-hf-cream p-3">
              <label className="hf-type-small hf-type-strong text-hf-black" htmlFor={`reason-${row.id}`}>
                Begrundelse for afvisning
              </label>
              <textarea
                id={`reason-${row.id}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="hf-type-body mt-1 w-full rounded-lg border border-hf-tan-dark bg-hf-white p-2 text-hf-black"
              />
              <div className="hf-type-small hf-type-strong mt-2 flex gap-4">
                <button
                  type="button"
                  disabled={busyId === row.id || !reason.trim()}
                  onClick={() => decide(row.id, "REJECT", reason)}
                  className="hf-btn-text text-hf-black disabled:opacity-40"
                >
                  Afvis med begrundelse
                </button>
                <button type="button" onClick={() => setRejectingId(null)} className="hf-btn-text text-text-secondary">
                  Fortryd
                </button>
              </div>
            </div>
          )}
          <div className="hf-type-small hf-type-strong mt-2 flex gap-4">
            {(["APPROVE", "REJECT", "BLOCK"] as const).map((action) => (
              <button
                key={action}
                type="button"
                disabled={busyId === row.id}
                onClick={() => (action === "REJECT" && row.copyCheck ? setRejectingId(row.id) : decide(row.id, action))}
                className="hf-btn-text text-hf-black disabled:opacity-40"
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
