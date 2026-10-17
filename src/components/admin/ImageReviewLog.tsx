"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Log over handlinger i Billedbehandling (docs/DECISIONS.md 2026-10-17). Hver
// bulk-handling er én linje, der foldes ud som accordion og kan fortrydes.

export type ReviewLogEntry = {
  id: string;
  action: string;
  itemCount: number;
  createdAt: string;
  undone: boolean;
  undoable: boolean;
  by: string | null;
  items: { id: string; title: string; imageUrl: string | null }[];
};

const ACTION_TEXT: Record<string, string> = { ACCEPT: "Accepterede", REJECT: "Afviste" };

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export function ImageReviewLog({ entries }: { entries: ReviewLogEntry[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function undo(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/image-review/log/${id}/undo`, { method: "POST" });
      if (!res.ok) setError("Kunne ikke fortryde handlingen.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (entries.length === 0) return <p className="hf-type-body text-text-secondary">Ingen handlinger endnu.</p>;

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
      {entries.map((entry) => (
        <details key={entry.id} className="hf-surface p-3">
          <summary className="hf-type-body flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
            <span className="hf-type-strong text-hf-black">
              {ACTION_TEXT[entry.action] ?? entry.action} {entry.itemCount} {entry.itemCount === 1 ? "billede" : "billeder"}
            </span>
            <span className="hf-type-caption">{formatTime(entry.createdAt)}</span>
            {entry.by && <span className="hf-type-caption">{entry.by}</span>}
            {entry.undone && <span className="hf-badge">Fortrudt</span>}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {entry.undoable && !entry.undone && (
              <div>
                <button type="button" className="hf-btn-secondary hf-btn--compact" disabled={busyId === entry.id} onClick={() => undo(entry.id)}>
                  {busyId === entry.id ? "Fortryder…" : "Fortryd hele handlingen"}
                </button>
              </div>
            )}
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {entry.items.map((item) => (
                <li key={item.id} className="hf-type-small flex items-center gap-3 text-hf-black">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" loading="lazy" className="h-10 w-10 rounded-md object-contain" />
                  )}
                  <span className="truncate">{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ))}
    </div>
  );
}
