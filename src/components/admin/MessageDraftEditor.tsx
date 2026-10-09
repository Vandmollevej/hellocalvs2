"use client";

import { useEffect, useState } from "react";
import type { MessageTemplateData } from "@/components/admin/MessageTemplateRow";
import { MailPreview, PhonePreviewEditor, PreviewTabs, PushPreview } from "@/components/admin/PhonePreviewEditor";
import { Toggle } from "@/components/ui/Toggle";
import { EVENT_LABELS, channelFlags, channelFromFlags } from "@/lib/message-event-labels";

type View = "mail" | "push";
type Draft = { channel: string; subject: string; bodyHtml: string };

const STORAGE_KEY = "hello-cal-admin-besked-kladde";
const EMPTY: Draft = { channel: "EMAIL", subject: "", bodyHtml: "" };

function readDraft(): Draft {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...EMPTY, ...(JSON.parse(stored) as Partial<Draft>) };
  } catch {
    // Ingen lagring tilgængelig — start med en tom kladde.
  }
  return EMPTY;
}

// Sandkasse til nye beskeder: intet her sendes eller gemmes i databasen.
// Kladden huskes kun i denne browser, så man kan fortsætte senere.
export function MessageDraftEditor({ templates }: { templates: MessageTemplateData[] }) {
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [view, setView] = useState<View>("mail");

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ingen lagring tilgængelig — kladden virker stadig, den huskes bare ikke.
    }
  }, [draft]);

  const { email, push } = channelFlags(draft.channel);
  const views: { value: View; label: string }[] = [];
  if (email) views.push({ value: "mail", label: "Mail" });
  if (push) views.push({ value: "push", label: "Notifikation" });
  const activeView = views.some((option) => option.value === view) ? view : views[0].value;
  const fieldClass = "rounded-md border border-hf-tan-dark bg-hf-cream px-2.5 py-1.5 hf-type-body text-hf-black";

  function copyFrom(event: string) {
    const source = templates.find((template) => template.event === event);
    if (source) setDraft({ channel: source.channel, subject: source.subject, bodyHtml: source.bodyHtml });
  }

  return (
    <PhonePreviewEditor
      darkScreen={activeView === "push"}
      previewControls={
        views.length > 1 ? <PreviewTabs value={activeView} options={views} onChange={setView} /> : undefined
      }
      preview={
        activeView === "mail" ? (
          <MailPreview subject={draft.subject} html={draft.bodyHtml} />
        ) : (
          <PushPreview title={draft.subject} body={draft.bodyHtml} />
        )
      }
    >
      <div>
        <h1 className="hf-type-title text-hf-black">Kladde</h1>
        <p className="mt-1 hf-type-body text-text-secondary">
          Sandkasse til at skrive en ny besked. Intet her sendes eller aktiveres — kladden gemmes kun i din browser.
        </p>
      </div>

      <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
        Start fra en eksisterende besked
        <select
          value=""
          onChange={(event) => copyFrom(event.target.value)}
          className={`hf-field ${fieldClass}`}
        >
          <option value="">Vælg besked …</option>
          {templates.map((template) => (
            <option key={template.event} value={template.event}>
              {EVENT_LABELS[template.event] ?? "Besked"}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <Toggle
          label="E-mail"
          checked={email}
          disabled={email && !push}
          onChange={(value) => setDraft({ ...draft, channel: channelFromFlags(value, push) })}
        />
        <Toggle
          label="Push"
          checked={push}
          disabled={push && !email}
          onChange={(value) => setDraft({ ...draft, channel: channelFromFlags(email, value) })}
        />
      </div>

      <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
        {email ? "Emne (bruges også som titel på notifikationen)" : "Titel"}
        <input
          value={draft.subject}
          onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 hf-type-small text-text-secondary">
        Indhold (HTML, {"{{variabel}}"} vises med eksempelværdier i telefonen)
        <textarea
          rows={18}
          value={draft.bodyHtml}
          onChange={(event) => setDraft({ ...draft, bodyHtml: event.target.value })}
          className={`${fieldClass} hf-type-small font-mono`}
        />
      </label>

      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={!draft.subject && !draft.bodyHtml}
          onClick={() => setDraft(EMPTY)}
          className="hf-btn-secondary h-12 px-4"
        >
          Ryd kladde
        </button>
      </div>
    </PhonePreviewEditor>
  );
}
