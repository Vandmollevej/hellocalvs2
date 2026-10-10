"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MessageTemplateData } from "@/components/admin/MessageTemplateRow";
import { MailPreview, PhonePreviewEditor, PreviewTabs, PushPreview } from "@/components/admin/PhonePreviewEditor";
import { Toggle } from "@/components/ui/Toggle";
import { channelFlags, channelFromFlags } from "@/lib/message-event-labels";

type View = "mail" | "push";

// Redigering af én besked-skabelon i telefon-editoren: mail og/eller
// pushnotifikation vises live på iPhone-rammen til venstre.
export function MessageTemplateEditor({ template, label }: { template: MessageTemplateData; label: string }) {
  const router = useRouter();
  const [form, setForm] = useState(template);
  const [saved, setSaved] = useState(template);
  const [view, setView] = useState<View>(template.channel === "PUSH" ? "push" : "mail");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const { email, push } = channelFlags(form.channel);
  const views: { value: View; label: string }[] = [];
  if (email) views.push({ value: "mail", label: "Mail" });
  if (push) views.push({ value: "push", label: "Notifikation" });
  const activeView = views.some((option) => option.value === view) ? view : views[0].value;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/message-templates/${template.event}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: form.channel,
          enabled: form.enabled,
          subject: form.subject,
          bodyHtml: form.bodyHtml,
        }),
      });
      if (!res.ok) {
        setMessage("Kunne ikke gemme.");
        return;
      }
      setSaved(form);
      setMessage("Gemt ✓");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "rounded-md border border-hf-tan-dark bg-hf-cream px-2.5 py-1.5 hf-type-body text-hf-black";

  return (
    <PhonePreviewEditor
      darkScreen={activeView === "push"}
      previewControls={
        views.length > 1 ? <PreviewTabs value={activeView} options={views} onChange={setView} /> : undefined
      }
      preview={
        activeView === "mail" ? (
          <MailPreview subject={form.subject} html={form.bodyHtml} />
        ) : (
          <PushPreview title={form.subject} body={form.bodyHtml} />
        )
      }
    >
      <h1 className="hf-type-title text-hf-black">{label}</h1>

      <div className="flex flex-col gap-2">
        <Toggle
          label="E-mail"
          checked={email}
          disabled={email && !push}
          onChange={(value) => setForm({ ...form, channel: channelFromFlags(value, push) })}
        />
        <Toggle
          label="Push"
          checked={push}
          disabled={push && !email}
          onChange={(value) => setForm({ ...form, channel: channelFromFlags(email, value) })}
        />
        <Toggle label="Aktiv" checked={form.enabled} onChange={(value) => setForm({ ...form, enabled: value })} />
      </div>

      <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
        {email ? "Emne (bruges også som titel på notifikationen)" : "Titel"}
        <input
          value={form.subject}
          onChange={(event) => setForm({ ...form, subject: event.target.value })}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
        Indhold (HTML, {"{{variabel}}"} erstattes ved afsendelse — eksempelværdier vises i telefonen)
        <textarea
          rows={18}
          value={form.bodyHtml}
          onChange={(event) => setForm({ ...form, bodyHtml: event.target.value })}
          className={`${fieldClass} hf-type-small font-mono`}
        />
      </label>
      {push && <p className="hf-type-small text-text-muted">Notifikationen viser teksten uden HTML-formatering.</p>}

      <div className="flex items-center justify-end gap-3">
        {message && <span className="mr-auto hf-type-body text-text-secondary">{message}</span>}
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => setForm(saved)}
          className="hf-btn-secondary h-12 px-4"
        >
          Fortryd
        </button>
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={save}
          className="hf-btn-primary h-12 px-4"
        >
          Gem
        </button>
      </div>
    </PhonePreviewEditor>
  );
}
