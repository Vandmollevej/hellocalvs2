"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PriorityDot } from "@/components/admin/SupportInboxFilters";

type Priority = "HIGH" | "NORMAL" | "LOW";

const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "HIGH", label: "Høj" },
  { key: "NORMAL", label: "Normal" },
  { key: "LOW", label: "Lav" },
];

// Handlinger på én supportsag (docs/DECISIONS.md 2026-09-26): prioritet,
// status, "besvaret"-markering og svar/intern note.
export function SupportThreadActions({
  id,
  status,
  priority,
  awaitingReply,
}: {
  id: string;
  status: "OPEN" | "RESOLVED";
  priority: Priority;
  awaitingReply: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"REPLY" | "NOTE">("REPLY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) setError("Kunne ikke gemme ændringen.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function send(resolve: boolean) {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, kind, resolve }),
      });
      if (!res.ok) {
        setError(kind === "NOTE" ? "Noten kunne ikke gemmes." : "Svaret kunne ikke sendes.");
        return;
      }
      setText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    "rounded-md border border-border-strong px-2.5 py-1 text-text-secondary hover:bg-hf-tan disabled:opacity-50";

  return (
    <div className="hf-type-small flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-secondary">Prioritet:</span>
        <div className="flex overflow-hidden rounded-md border border-border-strong">
          {PRIORITIES.map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={busy}
              onClick={() => option.key !== priority && patch({ priority: option.key })}
              className={`flex items-center gap-1.5 px-2.5 py-1 ${
                priority === option.key ? "bg-hf-green-dark text-hf-white" : "text-text-secondary hover:bg-hf-tan"
              }`}
            >
              <PriorityDot priority={option.key} />
              {option.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {status === "OPEN" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => patch({ awaitingReply: !awaitingReply })}
              className={buttonClass}
            >
              {awaitingReply ? "Marker som besvaret" : "Marker som ikke besvaret"}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: status === "OPEN" ? "RESOLVED" : "OPEN" })}
            className={buttonClass}
          >
            {status === "OPEN" ? "Marker som løst" : "Genåbn"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-strong pt-3">
        <div className="flex overflow-hidden self-start rounded-md border border-border-strong">
          {(["REPLY", "NOTE"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`px-2.5 py-1 ${
                kind === option ? "bg-hf-green-dark text-hf-white" : "text-text-secondary hover:bg-hf-tan"
              }`}
            >
              {option === "REPLY" ? "Svar til bruger" : "Intern note"}
            </button>
          ))}
        </div>
        <textarea
          rows={6}
          maxLength={5000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            kind === "REPLY"
              ? "Skriv dit svar. Brugeren får det i appen og på mail."
              : "Kun synlig for admin — brugeren ser den aldrig."
          }
          className={`hf-type-body w-full rounded-md border bg-surface-1 p-2 text-text-primary ${
            kind === "NOTE" ? "border-dashed border-hf-warning" : "border-border-strong"
          }`}
        />
        {error && (
          <p role="alert" className="text-hf-red-dark">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {kind === "REPLY" ? (
            <>
              <button type="button" disabled={busy || !text.trim()} onClick={() => send(true)} className={buttonClass}>
                Send og marker som løst
              </button>
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={() => send(false)}
                className="rounded-md bg-hf-green-dark px-3 py-1 text-hf-white disabled:opacity-50"
              >
                Send svar
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => send(false)}
              className="rounded-md bg-hf-green-dark px-3 py-1 text-hf-white disabled:opacity-50"
            >
              Gem note
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
