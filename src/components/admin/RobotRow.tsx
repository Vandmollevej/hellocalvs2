"use client";

import type { JobDefinition } from "@/lib/jobs/registry";
import { describeNextRun } from "@/lib/jobs/schedule";
import { formatDateTime, formatDuration, useJobControl, type JobState } from "@/components/admin/useJobControl";
import { JobScheduleEditor } from "@/components/admin/JobScheduleEditor";

// Én række på admin "Robotter" (docs/DECISIONS.md 2026-09-28): robot,
// on/off-knap, KØR-knap, cron-job-kolonne og seneste kørsel.
export function RobotRow({ job, state }: { job: JobDefinition; state: JobState }) {
  const control = useJobControl(job.key, state);
  const { busy, running, runPending, toggleEnabled, runNow } = control;

  return (
    <tr className="border-b border-hf-tan-dark align-top">
      <td className="py-3 pr-4">
        <p className="hf-type-strong text-hf-black">{job.name}</p>
        <p className="hf-type-small max-w-md text-text-secondary">{job.description}</p>
        <p className="hf-type-small text-text-muted">Container: {job.container}</p>
      </td>
      <td className="py-3 pr-4">
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          aria-label={state.enabled ? "Slå fra" : "Slå til"}
          disabled={busy}
          onClick={toggleEnabled}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            state.enabled ? "bg-hf-green-dark" : "bg-hf-tan-dark"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-hf-white shadow transition-transform ${
              state.enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
        <p className="hf-type-small mt-1 text-text-muted">{state.enabled ? "On" : "Off"}</p>
      </td>
      <td className="py-3 pr-4">
        <button
          type="button"
          disabled={busy || runPending}
          onClick={runNow}
          className="hf-btn-primary px-3 py-1.5 disabled:opacity-50"
        >
          KØR
        </button>
        {running && <p className="hf-type-small mt-1 text-hf-green-dark">Kører nu…</p>}
        {runPending && !running && <p className="hf-type-small mt-1 text-text-muted">Startes inden for et minut</p>}
      </td>
      <td className="py-3 pr-4">
        <p className="hf-type-small mb-1 text-text-muted">
          {describeNextRun({
            enabled: state.enabled,
            runAtTime: state.runAtTime,
            intervalMinutes: state.intervalMinutes,
            runRequestedAt: null,
            lastStartedAt: null,
          })}
        </p>
        <JobScheduleEditor control={control} />
      </td>
      <td className="hf-type-small py-3 pr-4 text-text-muted">
        <p>{formatDateTime(state.lastRunAt)}</p>
        {state.lastStatus && (
          <p>
            <span className={state.lastStatus === "OK" ? "text-hf-green-dark" : "text-hf-red-dark"}>
              {state.lastStatus === "OK" ? "OK" : "Fejl"}
            </span>
            {state.lastDurationMs !== null && ` · ${formatDuration(state.lastDurationMs)}`}
          </p>
        )}
        {state.lastMessage && state.lastMessage !== "OK" && <p className="max-w-xs break-words">{state.lastMessage}</p>}
      </td>
    </tr>
  );
}
