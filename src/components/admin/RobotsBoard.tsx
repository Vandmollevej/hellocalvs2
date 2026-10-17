"use client";

import { useMemo, useState } from "react";
import { FilterDropdown } from "@/components/admin/FilterDropdown";
import { RobotRow } from "@/components/admin/RobotRow";
import { formatDateTime, scheduleTypeOf, type JobState } from "@/components/admin/useJobControl";
import type { JobDefinition } from "@/lib/jobs/registry";
import { ROBOT_CATEGORIES } from "@/lib/jobs/robot-categories";

// Oversigt over robotterne (docs/DECISIONS.md 2026-10-17): dashboard med fire
// bokse øverst, søgefelt, visningsvalg (faste/manuelle kørsler, on/off) og
// kategori som dropdowns, derefter tabellen.

export type RobotBoardItem = { job: JobDefinition; state: JobState; category: string };

const VIEW_OPTIONS = [
  { value: "fixed", label: "Faste kørsler" },
  { value: "manual", label: "Manuelle kørsler" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

function Box({ label, value, note, alert = false }: { label: string; value: string; note: string; alert?: boolean }) {
  return (
    <div className="hf-panel">
      <p className="hf-type-body text-text-secondary">{label}</p>
      <p className={`hf-type-hero mt-1 ${alert ? "text-hf-red-dark" : "text-hf-green-dark"}`}>{value}</p>
      <p className={`hf-type-small mt-auto pt-2 ${alert ? "text-hf-red-dark" : "text-text-muted"}`}>{note}</p>
    </div>
  );
}

export function RobotsBoard({ items }: { items: RobotBoardItem[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("");
  const [category, setCategory] = useState("");

  const stats = useMemo(() => {
    const active = items.filter((item) => item.state.enabled).length;
    const running = items.filter(
      (item) => item.state.lastStartedAt && (!item.state.lastRunAt || item.state.lastStartedAt > item.state.lastRunAt),
    ).length;
    const failed = items.filter((item) => item.state.lastStatus && item.state.lastStatus !== "OK");
    const latest = items
      .filter((item) => item.state.lastRunAt)
      .sort((a, b) => (b.state.lastRunAt! > a.state.lastRunAt! ? 1 : -1))[0];
    return { active, running, failed, latest };
  }, [items]);

  const needle = query.trim().toLowerCase();
  const visible = items.filter(({ job, state, category: cat }) => {
    if (category && cat !== category) return false;
    if (view === "on" && !state.enabled) return false;
    if (view === "off" && state.enabled) return false;
    const manual = scheduleTypeOf(state) === "manual";
    if (view === "fixed" && manual) return false;
    if (view === "manual" && !manual) return false;
    if (!needle) return true;
    return `${job.name} ${job.description} ${job.container ?? ""} ${cat}`.toLowerCase().includes(needle);
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Box
          label="Aktive robotter"
          value={String(stats.active)}
          note={`af ${items.length} i alt (${items.length - stats.active} slået fra)`}
        />
        <Box
          label="Kører nu"
          value={String(stats.running)}
          note={stats.running > 0 ? "Opdateres, når de er færdige" : "Ingen kører lige nu"}
        />
        <Box
          label="Fejlet sidst"
          value={String(stats.failed.length)}
          alert={stats.failed.length > 0}
          note={
            stats.failed.length > 0
              ? stats.failed
                  .slice(0, 3)
                  .map((item) => item.job.name)
                  .join(", ") + (stats.failed.length > 3 ? " m.fl." : "")
              : "Alle seneste kørsler gik godt"
          }
        />
        <Box
          label="Senest kørt"
          value={stats.latest ? formatDateTime(stats.latest.state.lastRunAt) : "–"}
          note={stats.latest ? stats.latest.job.name : "Ingen kørsler endnu"}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søg i robotter…"
          aria-label="Søg i robotter"
          className="hf-input min-w-[220px] flex-1"
        />
        <FilterDropdown label="Visning" options={VIEW_OPTIONS} value={view} allLabel="Alle" onChange={setView} />
        <FilterDropdown
          label="Kategori"
          options={ROBOT_CATEGORIES.map((name) => ({ value: name, label: name }))}
          value={category}
          allLabel="Alle kategorier"
          onChange={setCategory}
        />
      </div>

      <div className="overflow-x-auto hf-surface px-4">
        <table className="hf-type-body w-full min-w-[900px] text-left">
          <thead>
            <tr className="hf-table-section hf-type-small">
              <th className="py-2 pr-4">Robot</th>
              <th className="py-2 pr-4">On/Off</th>
              <th className="py-2 pr-4">Kør</th>
              <th className="py-2 pr-4">Cron-job</th>
              <th className="py-2 pr-4">Seneste kørsel</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ job, state }) => (
              <RobotRow key={job.key} job={job} state={state} />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="hf-type-body py-6 text-center text-text-muted">
                  Ingen robotter matcher.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
