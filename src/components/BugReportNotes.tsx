"use client";

import { useEffect, useState } from "react";

type Note = { id: string; text: string; createdAt: string };

// Notesystem til en afventende fejlrapport (/profile/report-bug): viser
// brugerens tidligere noter og lader dem tilføje en ny. Data og regler
// ligger i /api/bug-reports/[id]/notes.
export function BugReportNotes({ bugReportId }: { bugReportId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/bug-reports/${bugReportId}/notes`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setNotes(data?.notes ?? []))
      .catch(() => setNotes([]));
  }, [bugReportId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/bug-reports/${bugReportId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke gemme noten");
        return;
      }
      setNotes((prev) => [...prev, data.note]);
      setText("");
    } catch {
      setError("Kunne ikke gemme noten — tjek din forbindelse og prøv igen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3 text-left">
      <span className="hf-type-label">Noter</span>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-[4px] border bg-hf-cream p-3"
              style={{ borderColor: "var(--hf-color-field-border)" }}
            >
              <p className="hf-type-caption text-text-secondary">
                {new Date(note.createdAt).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" })}
              </p>
              <p className="hf-type-body whitespace-pre-wrap">{note.text}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Skriv en note til din indberetning"
          aria-label="Ny note"
          className="hf-type-input w-full rounded-[4px] border bg-hf-cream p-3 outline-none"
          style={{ borderColor: "var(--hf-color-field-border)" }}
        />
        {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="hf-control hf-btn-secondary w-full disabled:opacity-50"
        >
          {saving ? "Gemmer…" : "Tilføj note"}
        </button>
      </form>
    </div>
  );
}
