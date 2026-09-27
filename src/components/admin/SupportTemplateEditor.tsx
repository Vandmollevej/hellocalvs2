"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Template = { id?: string; title: string; body: string; sortOrder: number };

const EMPTY: Template = { title: "", body: "", sortOrder: 0 };

// Opret, ret og slet svarskabeloner (docs/DECISIONS.md 2026-09-26).
export function SupportTemplateEditor({ templates }: { templates: Template[] }) {
  return (
    <div className="flex flex-col gap-3">
      {templates.map((template) => (
        <TemplateForm key={template.id} initial={template} />
      ))}
      <TemplateForm key={`new-${templates.length}`} initial={EMPTY} />
    </div>
  );
}

function TemplateForm({ initial }: { initial: Template }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [sortOrder, setSortOrder] = useState(initial.sortOrder);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isNew = !initial.id;
  const dirty = title !== initial.title || body !== initial.body || sortOrder !== initial.sortOrder;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/support/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial.id, title, body, sortOrder }),
      });
      if (!res.ok) {
        setMessage("Udfyld titel og tekst.");
        return;
      }
      setMessage("Gemt");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial.id || !window.confirm(`Slet skabelonen "${initial.title}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/support/templates?id=${encodeURIComponent(initial.id)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-text-primary";

  return (
    <div className="hf-type-small flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-3">
      {isNew && <p className="hf-type-strong text-text-primary">Ny skabelon</p>}
      <div className="flex gap-2">
        <input
          value={title}
          maxLength={100}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titel, fx 'Tak for fejlrapporten'"
          className={`min-w-0 flex-1 ${fieldClass}`}
        />
        <label className="flex items-center gap-1 text-text-secondary">
          Rækkefølge
          <input
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(Number(event.target.value) || 0)}
            className={`w-16 ${fieldClass}`}
          />
        </label>
      </div>
      <textarea
        rows={4}
        maxLength={5000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Hej {{navn}}, tak for din besked …"
        className={`hf-type-body w-full p-2 ${fieldClass}`}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {message && <span className="mr-auto text-text-secondary">{message}</span>}
        {!isNew && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-md border border-border-strong px-2.5 py-1 text-hf-red-dark hover:bg-hf-tan disabled:opacity-50"
          >
            Slet
          </button>
        )}
        <button
          type="button"
          disabled={busy || !dirty || !title.trim() || !body.trim()}
          onClick={save}
          className="rounded-md bg-hf-green-dark px-3 py-1 text-hf-white disabled:opacity-50"
        >
          {isNew ? "Opret" : "Gem"}
        </button>
      </div>
    </div>
  );
}
