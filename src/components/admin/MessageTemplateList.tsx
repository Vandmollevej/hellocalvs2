"use client";

import Link from "next/link";
import { useState } from "react";
import { EVENT_GROUPS, EVENT_LABELS } from "@/lib/message-event-labels";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { MessageTemplateRow, TEMPLATE_COLUMNS, type MessageTemplateData } from "@/components/admin/MessageTemplateRow";

// Skabelonerne i grupper med overskrifter, med søgning og filtre øverst.
export function MessageTemplateList({ templates }: { templates: MessageTemplateData[] }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [status, setStatus] = useState("");

  const needle = search.trim().toLowerCase();
  const sections = EVENT_GROUPS.filter((entry) => !group || entry.label === group)
    .map((entry) => ({
      label: entry.label,
      items: entry.events
        .map((event) => templates.find((template) => template.event === event))
        .filter((template): template is MessageTemplateData => Boolean(template))
        .filter((template) => {
          if (status === "on" && !template.enabled) return false;
          if (status === "off" && template.enabled) return false;
          if (!needle) return true;
          return `${EVENT_LABELS[template.event] ?? ""} ${template.subject}`.toLowerCase().includes(needle);
        }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Søg i beskeder"
          className="hf-type-body hf-field min-w-[220px] flex-1 rounded-md border border-hf-tan-dark px-3"
        />
        <FilterDropdown
          label="Gruppe"
          allLabel="Alle grupper"
          value={group}
          onChange={setGroup}
          options={EVENT_GROUPS.map((entry) => ({ value: entry.label, label: entry.label }))}
        />
        <FilterDropdown
          label="Status"
          allLabel="Alle"
          value={status}
          onChange={setStatus}
          options={[
            { value: "on", label: "Aktive" },
            { value: "off", label: "Slået fra" },
          ]}
        />
        <Link href="/admin/messaging/kladde" className="hf-btn-secondary hf-btn--compact">
          Kladde
        </Link>
      </div>

      {sections.map((section) => (
        <section key={section.label} className="flex flex-col gap-2">
          <div className={`${TEMPLATE_COLUMNS} px-4`}>
            <h2 className="hf-type-body hf-type-strong text-hf-black">{section.label}</h2>
            <span className="hf-type-small invisible">Rediger</span>
            <span className="hf-type-small w-[63px] text-center text-text-muted">E-mail</span>
            <span className="hf-type-small w-[63px] text-center text-text-muted">Push</span>
            <span className="hf-type-small w-[63px] text-center text-text-muted">Aktiv</span>
          </div>
          <div className="hf-surface">
            {section.items.map((template) => (
              <MessageTemplateRow key={template.event} template={template} />
            ))}
          </div>
        </section>
      ))}
      {sections.length === 0 && <p className="hf-type-body text-text-secondary">Ingen beskeder matcher filteret.</p>}
    </div>
  );
}
