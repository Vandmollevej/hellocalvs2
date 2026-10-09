"use client";

import type { JobDefinition } from "@/lib/jobs/registry";
import { describeNextRun } from "@/lib/jobs/schedule";
import { formatDateTime, formatDuration, useJobControl, type JobState } from "@/components/admin/useJobControl";
import { JobScheduleEditor } from "@/components/admin/JobScheduleEditor";

// Én række på admin "Cron-jobs" (docs/DECISIONS.md 2026-09-25).
export function CronJobRow({ job, state }: { job: JobDefinition; state: JobState }) {
  const control = useJobControl(job.key, state);
  const { busy, running, runPending, toggleEnabled, runNow } = control;

  return (
    <div className="hf-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="hf-type-strong flex items-center gap-2 text-hf-black">
            {job.name}
            <span
              className={`hf-type-micro rounded-full px-2 py-0.5 ${
                state.enabled ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"
              }`}
            >
              {state.enabled ? "Aktiv" : "Pauset"}
            </span>
            {running && <span className="hf-type-micro text-hf-green-dark">Kører nu…</span>}
            {runPending && !running && <span className="hf-type-micro text-text-muted">Startes inden for et minut</span>}
          </p>
          <p className="hf-type-body mt-1 text-text-secondary">{job.description}</p>
          <p className="hf-type-small mt-1 text-text-muted">
            {job.runtime === "app" ? "Kører i appen" : `Container: ${job.container}`} · Plan:{" "}
            {describeNextRun({
              enabled: state.enabled,
              runAtTime: state.runAtTime,
              intervalMinutes: state.intervalMinutes,
              runRequestedAt: null,
              lastStartedAt: null,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={toggleEnabled}
            className="hf-btn-secondary hf-btn--compact"
          >
            {state.enabled ? "Pause" : "Genoptag"}
          </button>
          <button
            type="button"
            disabled={busy || runPending}
            onClick={runNow}
            className="hf-btn-primary hf-btn--compact"
          >
            Kør nu
          </button>
        </div>
      </div>

      <JobScheduleEditor control={control} />

      <p className="hf-type-small text-text-muted">
        Sidst kørt: {formatDateTime(state.lastRunAt)}
        {state.lastStatus && (
          <>
            {" · "}
            <span className={state.lastStatus === "OK" ? "text-hf-green-dark" : "text-hf-red-dark"}>
              {state.lastStatus === "OK" ? "OK" : "Fejl"}
            </span>
            {state.lastDurationMs !== null && ` · ${formatDuration(state.lastDurationMs)}`}
          </>
        )}
        {state.lastMessage && state.lastMessage !== "OK" && <> · {state.lastMessage}</>}
      </p>
    </div>
  );
}
