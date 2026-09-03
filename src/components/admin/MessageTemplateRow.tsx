"use client";

import { useState } from "react";

export type MessageTemplateData = {
  event: string;
  channel: string;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
};

const EVENT_LABELS: Record<string, string> = {
  ACCOUNT_CREATED: "Konto oprettet",
  EMAIL_VERIFICATION: "E-mail-verifikation",
  PASSWORD_RESET: "Glemt kodeord",
  FRIEND_REFERRAL: "Invitér en ven — belønning givet",
  PRODUCT_APPROVED: "Produkt godkendt",
  PRODUCT_REJECTED: "Produkt afvist",
  PRODUCT_ESCALATION_ADMIN: "Admin: produkt venter >48 timer",
  BUG_REPORT_ESCALATION_ADMIN: "Admin: fejlrapport venter >48 timer",
  BUG_REPORT_RESOLVED: "Fejlrapport løst",
  POINTS_AWARDED: "Points tildelt",
  FRIEND_FORWARD_RECEIVED: "Videresendelse modtaget",
};

export function MessageTemplateRow({ template }: { template: MessageTemplateData }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(template);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(patch: Partial<MessageTemplateData>) {
    const next = { ...form, ...patch };
    setForm(next);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/message-templates/${template.event}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border-strong bg-surface-2">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-medium text-text-primary">{EVENT_LABELS[template.event] ?? template.event}</p>
          <p className="truncate text-xs text-text-muted">{form.subject}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <select
            value={form.channel}
            onChange={(e) => save({ channel: e.target.value })}
            className="rounded-md border border-border-strong px-2 py-1 text-xs"
          >
            <option value="EMAIL">E-mail</option>
            <option value="PUSH">Push</option>
            <option value="BOTH">Begge</option>
          </select>
          <button
            type="button"
            role="switch"
            aria-checked={form.enabled}
            onClick={() => save({ enabled: !form.enabled })}
            className={`relative h-6 w-10 rounded-full transition-colors ${form.enabled ? "bg-hf-green" : "bg-hf-tan-dark"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                form.enabled ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-hf-green-dark underline"
          >
            {expanded ? "Luk" : "Rediger"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border-strong p-4">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Emne
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              onBlur={() => save({ subject: form.subject })}
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Indhold (HTML, {"{{variabel}}"} erstattes ved afsendelse)
            <textarea
              rows={5}
              value={form.bodyHtml}
              onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
              onBlur={() => save({ bodyHtml: form.bodyHtml })}
              className="rounded-md border border-border-strong px-2 py-1.5 font-mono text-xs"
            />
          </label>
          {saving && <span className="text-xs text-text-muted">Gemmer…</span>}
          {saved && !saving && <span className="text-xs text-hf-green-dark">Gemt ✓</span>}
        </div>
      )}
    </div>
  );
}
