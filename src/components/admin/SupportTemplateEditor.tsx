"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhonePreviewEditor, fillSampleVars } from "@/components/admin/PhonePreviewEditor";

type Template = { id?: string; title: string; body: string; sortOrder: number };

const EMPTY: Template = { title: "", body: "", sortOrder: 0 };

// Opret, ret og slet svarskabeloner (docs/DECISIONS.md 2026-09-26). Den
// skabelon man sidst har rørt, vises i telefon-editoren til venstre, som
// brugeren ser svaret i appens supportsamtale.
export function SupportTemplateEditor({ templates }: { templates: Template[] }) {
  const [preview, setPreview] = useState(templates[0]?.body ?? "");

  return (
    <PhonePreviewEditor preview={<SupportThreadPreview body={preview} />}>
      {templates.map((template) => (
        <TemplateForm key={template.id} initial={template} onPreview={setPreview} />
      ))}
      <TemplateForm key={`new-${templates.length}`} initial={EMPTY} onPreview={setPreview} />
    </PhonePreviewEditor>
  );
}

function SupportThreadPreview({ body }: { body: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-hf-cream text-hf-black">
      <div className="-mt-[54px] flex h-[108px] shrink-0 items-end justify-center pb-3" style={{ background: "var(--hf-color-appbar)" }}>
        <p className="text-[20px] font-bold leading-6 text-hf-white">Appen lukker ned</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <p className="hf-type-caption opacity-60">Sag HC-4821</p>
        <div className="ml-8 rounded-[8px] bg-hf-tan p-3">
          <p className="hf-type-caption opacity-60">Dig · 27.9.2026 09.12</p>
          <p className="hf-type-body mt-1">Appen lukker ned, når jeg scanner en stregkode.</p>
        </div>
        <div className="mr-8 rounded-[8px] bg-hf-green-light p-3">
          <p className="hf-type-caption opacity-60">Support · 27.9.2026 09.41</p>
          <p className="hf-type-body mt-1 whitespace-pre-wrap">{fillSampleVars(body) || "…"}</p>
        </div>
      </div>
    </div>
  );
}

function TemplateForm({ initial, onPreview }: { initial: Template; onPreview: (body: string) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isNew = !initial.id;
  const dirty = title !== initial.title || body !== initial.body;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/support/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial.id, title, body }),
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

  const fieldClass = "rounded-md border border-hf-tan-dark bg-hf-cream px-2 py-1 text-hf-black";

  return (
    <div
      onFocus={() => onPreview(body)}
      className="hf-type-small flex flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-3"
    >
      {isNew && <p className="hf-type-strong text-hf-black">Ny skabelon</p>}
      <input
        value={title}
        maxLength={100}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titel, fx 'Tak for fejlrapporten'"
        className={`w-full ${fieldClass}`}
      />
      <textarea
        rows={4}
        maxLength={5000}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          onPreview(event.target.value);
        }}
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
            className="rounded-md border border-hf-tan-dark px-2.5 py-1 text-hf-red-dark hover:bg-hf-tan disabled:opacity-50"
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
