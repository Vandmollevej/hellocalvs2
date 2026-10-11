"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PriorityDot } from "@/components/admin/SupportInboxFilters";

type Priority = "HIGH" | "NORMAL" | "LOW";
type Template = { id: string; title: string; body: string };

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
  userName,
  templates,
}: {
  id: string;
  status: "OPEN" | "RESOLVED";
  priority: Priority;
  awaitingReply: boolean;
  userName: string;
  templates: Template[];
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

  // Skabelonen tilføjes efter den tekst, der allerede står; {{navn}} bliver
  // til brugerens navn.
  function insertTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const snippet = template.body.replace(/\{\{\s*navn\s*\}\}/gi, userName);
    setKind("REPLY");
    setText((current) => (current.trim() ? `${current.trimEnd()}\n\n${snippet}` : snippet));
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

  const buttonClass = "hf-btn-secondary hf-btn--compact hf-btn--inline";

  return (
    <div className="hf-type-small flex flex-col gap-3 hf-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-secondary">Prioritet:</span>
        <div className="flex flex-wrap gap-1">
          {PRIORITIES.map((option) => (
            <button
              key={option.key}
              type="button"
              disabled={busy}
              onClick={() => option.key !== priority && patch({ priority: option.key })}
              aria-pressed={priority === option.key}
              className="hf-choice"
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

      <div className="flex flex-col gap-2 border-t border-hf-tan-dark pt-3">
        <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {(["REPLY", "NOTE"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              aria-pressed={kind === option}
              className="hf-choice"
            >
              {option === "REPLY" ? "Svar til bruger" : "Intern note"}
            </button>
          ))}
        </div>
        <select
          value=""
          onChange={(event) => insertTemplate(event.target.value)}
          className="hf-input hf-input--compact"
          aria-label="Indsæt svarskabelon"
        >
          <option value="">{templates.length ? "Indsæt skabelon…" : "Ingen skabeloner endnu"}</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </select>
        <Link href="/admin/support/templates" className="hf-btn-text">
          Rediger skabeloner
        </Link>
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
          className={`hf-input w-full ${kind === "NOTE" ? "hf-input--note" : ""}`}
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
                className="hf-btn-brand hf-btn--compact hf-btn--inline"
              >
                Send svar
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => send(false)}
              className="hf-btn-brand hf-btn--compact hf-btn--inline"
            >
              Gem note
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
