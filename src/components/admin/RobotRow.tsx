"use client";

import { useState } from "react";
import Link from "next/link";
import type { JobDefinition } from "@/lib/jobs/registry";
import { describeNextRun } from "@/lib/jobs/schedule";
import { formatDateTime, formatDuration, useJobControl, type JobState } from "@/components/admin/useJobControl";
import { Toggle } from "@/components/ui/Toggle";
import { JobScheduleEditor } from "@/components/admin/JobScheduleEditor";

// Én række på admin "Robotter" (docs/DECISIONS.md 2026-09-28): robot,
// on/off-knap, KØR-knap, cron-job-kolonne og seneste kørsel (med hvor meget
// der blev udført). Lange beskrivelser foldes sammen bag "Læs mere".
export function RobotRow({ job, state }: { job: JobDefinition; state: JobState }) {
  const control = useJobControl(job.key, state);
  const { busy, running, runPending, toggleEnabled, runNow, enabled } = control;
  const [expanded, setExpanded] = useState(false);
  const longDescription = job.description.length > 110;

  return (
    <tr className="border-b border-hf-tan-dark align-top">
      <td className="py-3 pr-4">
        <p className="hf-type-strong text-hf-black">{job.name}</p>
        <p className={`hf-type-caption max-w-md ${longDescription && !expanded ? "line-clamp-2" : ""}`}>
          {job.description}
        </p>
        <p className="hf-type-small text-text-muted">
          {job.runtime === "app" ? "Kører i appen (nattekørsel)" : `Container: ${job.container}`}
        </p>
        {longDescription && (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="hf-btn-text hf-btn--inline mt-1"
          >
            {expanded ? "Vis mindre" : "Læs mere"}
          </button>
        )}
      </td>
      <td className="py-3 pr-4">
        <Toggle checked={enabled} ariaLabel={enabled ? "Slå fra" : "Slå til"} disabled={busy} onChange={toggleEnabled} />
        <p className="hf-type-small mt-1 text-text-muted">{enabled ? "On" : "Off"}</p>
      </td>
      <td className="py-3 pr-4">
        <button
          type="button"
          disabled={busy || runPending}
          onClick={runNow}
          className="hf-btn-primary hf-btn--compact w-fit"
        >
          KØR
        </button>
        {running && <p className="hf-type-small mt-1 text-hf-green-dark">Kører nu…</p>}
        {runPending && !running && <p className="hf-type-small mt-1 text-text-muted">Startes inden for et minut</p>}
        {!running && !runPending && enabled && state.qosWaitingSince && (
          <p className="hf-type-small mt-1 max-w-[12rem] text-hf-red-dark">
            Venter siden {formatDateTime(state.qosWaitingSince)}: {state.qosWaitReason}
          </p>
        )}
      </td>
      <td className="py-3 pr-4">
        <p className="hf-type-small mb-1 text-text-muted">
          {describeNextRun({
            enabled,
            runAtTime: state.runAtTime,
            intervalMinutes: state.intervalMinutes,
            runRequestedAt: null,
            lastStartedAt: null,
          })}
        </p>
        <JobScheduleEditor control={control} />
      </td>
      <td className="hf-type-small h-px py-3 pr-4 text-text-muted">
        <div className="flex h-full flex-col justify-between gap-2">
          <div>
            <p>{formatDateTime(state.lastRunAt)}</p>
            {state.lastStatus && (
              <p>
                <span className={state.lastStatus === "OK" ? "text-hf-green-dark" : "text-hf-red-dark"}>
                  {state.lastStatus === "OK" ? "OK" : "Fejl"}
                </span>
                {state.lastDurationMs !== null && ` · ${formatDuration(state.lastDurationMs)}`}
              </p>
            )}
            {state.lastMessage && state.lastMessage !== "OK" && (
              <p className="max-w-xs break-words text-text-secondary">{state.lastMessage}</p>
            )}
          </div>
          <Link href="/admin/log?tab=cron" className="hf-type-small text-hf-green-dark underline">
            Se log
          </Link>
        </div>
      </td>
    </tr>
  );
}
