"use client";

import Link from "next/link";
import { useState } from "react";
import { EVENT_LABELS, channelFlags, channelFromFlags } from "@/lib/message-event-labels";
import { fillSampleVars } from "@/components/admin/PhonePreviewEditor";
import { Toggle } from "@/components/ui/Toggle";

export type MessageTemplateData = {
  event: string;
  channel: string;
  enabled: boolean;
  subject: string;
  bodyHtml: string;
};

// Kolonnerne (Rediger, E-mail, Push, Aktiv) deles med overskriftsrækken i
// MessageTemplateList; Aktiv står altid yderst til højre.
export const TEMPLATE_COLUMNS = "grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-6";

// Listen viser kanaler og til/fra direkte; selve indholdet redigeres i
// telefon-editoren på /admin/messaging/[event].
export function MessageTemplateRow({ template }: { template: MessageTemplateData }) {
  const [form, setForm] = useState(template);
  const { email, push } = channelFlags(form.channel);

  async function save(patch: Partial<MessageTemplateData>) {
    setForm({ ...form, ...patch });
    await fetch(`/api/admin/message-templates/${template.event}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  return (
    <div className={`${TEMPLATE_COLUMNS} border-b border-hf-tan-dark px-4 py-3 last:border-b-0`}>
      <div className="min-w-0">
        <p className="hf-type-strong text-hf-black">{EVENT_LABELS[template.event] ?? "Besked"}</p>
        <p className="hf-type-small truncate text-text-muted">{fillSampleVars(form.subject)}</p>
      </div>
      <Link href={`/admin/messaging/${template.event}`} className="hf-btn-text text-hf-green-dark">
        Rediger
      </Link>
      <Toggle
        ariaLabel="E-mail"
        checked={email}
        disabled={email && !push}
        onChange={(value) => save({ channel: channelFromFlags(value, push) })}
      />
      <Toggle
        ariaLabel="Push"
        checked={push}
        disabled={push && !email}
        onChange={(value) => save({ channel: channelFromFlags(email, value) })}
      />
      <Toggle ariaLabel="Aktiv" checked={form.enabled} onChange={(value) => save({ enabled: value })} />
    </div>
  );
}
