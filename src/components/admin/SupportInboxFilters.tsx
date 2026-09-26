"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SupportInboxFilter, SupportInboxStatus } from "@/lib/support-inbox";

const PRIORITIES = [
  { key: "HIGH", label: "Høj" },
  { key: "NORMAL", label: "Normal" },
  { key: "LOW", label: "Lav" },
] as const;

const STATUSES: { key: SupportInboxStatus; label: string }[] = [
  { key: "open", label: "Åbne" },
  { key: "unanswered", label: "Ikke besvaret" },
  { key: "resolved", label: "Løste" },
  { key: "all", label: "Alle" },
];

// Filterlinje til Support-indbakken (docs/DECISIONS.md 2026-09-26). Filteret
// ligger i URL'en, så siden kan genindlæses/bogmærkes med samme visning.
export function SupportInboxFilters({ filter }: { filter: SupportInboxFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filter.q);

  function apply(next: Partial<SupportInboxFilter>) {
    const merged = { ...filter, q, ...next };
    const params = new URLSearchParams();
    if (merged.sort !== "oldest") params.set("sort", merged.sort);
    if (merged.status !== "open") params.set("status", merged.status);
    if (merged.priorities.length !== PRIORITIES.length) params.set("prio", merged.priorities.join(","));
    if (merged.q) params.set("q", merged.q);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function togglePriority(key: (typeof PRIORITIES)[number]["key"], checked: boolean) {
    const set = new Set(filter.priorities);
    if (checked) set.add(key);
    else set.delete(key);
    apply({ priorities: PRIORITIES.map((p) => p.key).filter((k) => set.has(k)) });
  }

  return (
    <div className="hf-type-small flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-border-strong">
          {STATUSES.map((status) => (
            <button
              key={status.key}
              type="button"
              onClick={() => apply({ status: status.key })}
              className={`px-2.5 py-1 ${
                filter.status === status.key ? "bg-hf-green-dark text-hf-white" : "text-text-secondary hover:bg-hf-tan"
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-text-secondary">
          Sortér
          <select
            value={filter.sort}
            onChange={(event) => apply({ sort: event.target.value === "newest" ? "newest" : "oldest" })}
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-text-primary"
          >
            <option value="oldest">Ældste øverst</option>
            <option value="newest">Senest modtaget øverst</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-text-secondary">Prioritet:</span>
        {PRIORITIES.map((priority) => (
          <label key={priority.key} className="flex items-center gap-1.5 text-text-primary">
            <input
              type="checkbox"
              checked={filter.priorities.includes(priority.key)}
              onChange={(event) => togglePriority(priority.key, event.target.checked)}
              className="h-4 w-4 accent-hf-green-dark"
            />
            <PriorityDot priority={priority.key} />
            {priority.label}
          </label>
        ))}
        <form
          className="ml-auto flex min-w-0 flex-1 gap-2 sm:max-w-xs"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ q: q.trim() });
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Søg emne, navn, e-mail, sagsnr."
            className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-text-primary"
          />
        </form>
      </div>
    </div>
  );
}

export function PriorityDot({ priority }: { priority: "HIGH" | "NORMAL" | "LOW" }) {
  const color = priority === "HIGH" ? "bg-hf-red-dark" : priority === "NORMAL" ? "bg-hf-warning" : "bg-hf-gray";
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}
