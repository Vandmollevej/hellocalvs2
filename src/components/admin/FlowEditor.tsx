"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlowPagePreview, PhonePreviewEditor } from "@/components/admin/PhonePreviewEditor";

type FlowPage = { id?: string; title: string; bodyHtml: string; buttonLabel: string };
type Flow = { id: string; name: string; description: string; enabled: boolean; pages: FlowPage[] };
type EditablePage = FlowPage & { key: string };

const fieldClass = "rounded-md border border-hf-tan-dark bg-hf-cream px-2.5 py-1.5 hf-type-body text-hf-black";

let nextKey = 0;
function withKey(page: FlowPage): EditablePage {
  nextKey += 1;
  return { ...page, key: page.id ?? `new-${nextKey}` };
}

// Opret et nyt flow og gå direkte til editoren.
export function NewFlowForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (!res.ok || !data?.id) {
        setError(data?.message ?? "Kunne ikke oprette flowet.");
        return;
      }
      router.push(`/admin/flows/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) void create();
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-4"
    >
      <input
        value={name}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        placeholder="Navn på nyt flow, fx 'Velkomst'"
        className={`min-w-0 flex-1 ${fieldClass}`}
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="hf-btn-primary"
      >
        Opret flow
      </button>
      {error && <p className="w-full hf-type-body text-hf-red-dark">{error}</p>}
    </form>
  );
}

// Flow-editoren: telefonen til venstre viser den valgte side, til højre
// redigeres flowet og dets sider. Alt gemmes samlet med "Gem".
export function FlowEditor({ flow }: { flow: Flow }) {
  const router = useRouter();
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description);
  const [enabled, setEnabled] = useState(flow.enabled);
  const [pages, setPages] = useState<EditablePage[]>(() => flow.pages.map(withKey));
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const current = pages[Math.min(selected, pages.length - 1)];
  const currentIndex = current ? pages.indexOf(current) : -1;

  function touch() {
    setDirty(true);
    setMessage(null);
  }

  function updatePage(patch: Partial<FlowPage>) {
    if (!current) return;
    setPages((list) => list.map((page) => (page.key === current.key ? { ...page, ...patch } : page)));
    touch();
  }

  function addPage() {
    setPages((list) => [...list, withKey({ title: "", bodyHtml: "", buttonLabel: "Næste" })]);
    setSelected(pages.length);
    touch();
  }

  function removePage(index: number) {
    if (!window.confirm(`Slet side ${index + 1}?`)) return;
    setPages((list) => list.filter((_, i) => i !== index));
    setSelected((value) => Math.max(0, value > index ? value - 1 : Math.min(value, pages.length - 2)));
    touch();
  }

  function movePage(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    setPages((list) => {
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelected(target);
    touch();
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          enabled,
          pages: pages.map(({ id, title, bodyHtml, buttonLabel }) => ({ id, title, bodyHtml, buttonLabel })),
        }),
      });
      const data = (await res.json().catch(() => null)) as { flow?: Flow; message?: string } | null;
      if (!res.ok || !data?.flow) {
        setMessage(data?.message ?? "Kunne ikke gemme.");
        return;
      }
      // Nye sider har fået id'er — læs dem ind, så næste gem opdaterer.
      setPages(data.flow.pages.map(withKey));
      setDirty(false);
      setMessage("Gemt ✓");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Slet flowet "${flow.name}" og alle dets sider?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/flows");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <PhonePreviewEditor
      preview={
        current ? (
          <FlowPagePreview
            title={current.title}
            html={current.bodyHtml}
            buttonLabel={current.buttonLabel}
            step={currentIndex}
            total={pages.length}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-[#FAF8F3] hf-type-body text-black/50">Ingen sider</div>
        )
      }
    >
      <div className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
          Navn
          <input
            value={name}
            maxLength={120}
            onChange={(event) => {
              setName(event.target.value);
              touch();
            }}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
          Beskrivelse (kun til admin)
          <input
            value={description}
            maxLength={500}
            onChange={(event) => {
              setDescription(event.target.value);
              touch();
            }}
            className={fieldClass}
          />
        </label>
        <label className="flex items-center gap-2 hf-type-body text-text-secondary">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              touch();
            }}
          />
          Aktiv (ellers kladde)
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="hf-type-strong text-hf-black">Sider</p>
        <ol className="flex flex-col gap-1">
          {pages.map((page, index) => (
            <li
              key={page.key}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 hf-type-body ${
                index === currentIndex ? "border-hf-green bg-hf-tan" : "border-hf-tan-dark bg-hf-white"
              }`}
            >
              <button type="button" onClick={() => setSelected(index)} className="min-w-0 flex-1 truncate text-left text-hf-black">
                {index + 1}. {page.title || "(uden titel)"}
              </button>
              <button
                type="button"
                onClick={() => movePage(index, -1)}
                disabled={index === 0}
                aria-label="Flyt op"
                className="px-1.5 text-text-secondary hover:text-hf-black disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => movePage(index, 1)}
                disabled={index === pages.length - 1}
                aria-label="Flyt ned"
                className="px-1.5 text-text-secondary hover:text-hf-black disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removePage(index)}
                aria-label="Slet side"
                className="px-1.5 text-hf-red-dark hover:opacity-80"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={addPage}
          className="hf-btn-secondary w-fit"
        >
          + Tilføj side
        </button>
      </div>

      {current && (
        <div className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <p className="hf-type-strong text-hf-black">Side {currentIndex + 1}</p>
          <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
            Overskrift
            <input
              value={current.title}
              maxLength={200}
              onChange={(event) => updatePage({ title: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
            Indhold (tekst eller HTML)
            <textarea
              rows={14}
              value={current.bodyHtml}
              onChange={(event) => updatePage({ bodyHtml: event.target.value })}
              className={`${fieldClass} hf-type-small font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
            Tekst på knappen
            <input
              value={current.buttonLabel}
              maxLength={60}
              onChange={(event) => updatePage({ buttonLabel: event.target.value })}
              className={fieldClass}
            />
          </label>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {message && <span className="mr-auto hf-type-body text-text-secondary">{message}</span>}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="hf-btn-danger"
        >
          Slet flow
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty || !name.trim()}
          className="hf-btn-primary"
        >
          Gem
        </button>
      </div>
    </PhonePreviewEditor>
  );
}
