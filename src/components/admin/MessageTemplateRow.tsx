"use client";

import Link from "next/link";
import { useState } from "react";
import { EVENT_LABELS } from "@/lib/message-event-labels";

export type MessageTemplateData = {
  event: string;
  channel: string;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
};

// Listen viser kanal og til/fra direkte; selve indholdet redigeres i
// telefon-editoren på /admin/messaging/[event].
export function MessageTemplateRow({ template }: { template: MessageTemplateData }) {
  const [form, setForm] = useState(template);

  async function save(patch: Partial<MessageTemplateData>) {
    setForm({ ...form, ...patch });
    await fetch(`/api/admin/message-templates/${template.event}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  return (
    <div className="rounded-lg border border-hf-tan-dark bg-hf-white">
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="hf-type-strong text-hf-black">{EVENT_LABELS[template.event] ?? template.event}</p>
          <p className="hf-type-small truncate text-text-muted">{form.subject}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <select
            value={form.channel}
            onChange={(e) => save({ channel: e.target.value })}
            className="hf-type-small hf-field rounded-md border border-hf-tan-dark px-2"
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
            className={`relative h-[28px] w-[63px] rounded-full transition-colors ${form.enabled ? "bg-hf-green" : "bg-hf-tan-dark"}`}
          >
            <span
              className={`absolute left-[2px] top-[2px] h-[24px] w-[38px] rounded-full bg-hf-white shadow transition-transform ${
                form.enabled ? "translate-x-[21px]" : "translate-x-0"
              }`}
            />
          </button>
          <Link href={`/admin/messaging/${template.event}`} className="hf-btn-text text-hf-green-dark">
            Rediger
          </Link>
        </div>
      </div>
    </div>
  );
}
