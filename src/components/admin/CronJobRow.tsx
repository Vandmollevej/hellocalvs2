"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobDefinition } from "@/lib/jobs/registry";
import { describeNextRun } from "@/lib/jobs/schedule";

type JobState = {
  enabled: boolean;
  runAtTime: string | null;
  intervalMinutes: number | null;
  runRequestedAt: string | null;
  lastStartedAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
  lastDurationMs: number | null;
};

type ScheduleType = "time" | "interval" | "manual";

function formatDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" }) : "Aldrig";
}

function formatDuration(ms: number | null) {
  if (ms === null) return "";
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  return seconds < 120 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

// Én række på admin "Cron-jobs" (docs/DECISIONS.md 2026-09-25).
export function CronJobRow({ job, state }: { job: JobDefinition; state: JobState }) {
  const router = useRouter();
  const initialType: ScheduleType = state.runAtTime ? "time" : state.intervalMinutes ? "interval" : "manual";
  const [scheduleType, setScheduleType] = useState<ScheduleType>(initialType);
  const [timeValue, setTimeValue] = useState(state.runAtTime ?? "03:00");
  const [intervalValue, setIntervalValue] = useState(String(state.intervalMinutes ?? 60));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const running = Boolean(state.lastStartedAt && (!state.lastRunAt || state.lastStartedAt > state.lastRunAt));
  const runPending = Boolean(state.runRequestedAt && (!state.lastStartedAt || state.runRequestedAt > state.lastStartedAt));

  async function send(body: Record<string, unknown>, successNotice: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/cron-jobs/${job.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Kunne ikke gemme");
      setNotice(successNotice);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setBusy(false);
    }
  }

  function saveSchedule() {
    const value = scheduleType === "time" ? timeValue : scheduleType === "interval" ? Number(intervalValue) : null;
    void send({ schedule: { type: scheduleType, value } }, "Plan gemt");
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium text-text-primary">
            {job.name}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                state.enabled ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"
              }`}
            >
              {state.enabled ? "Aktiv" : "Pauset"}
            </span>
            {running && <span className="text-[11px] text-hf-green-dark">Kører nu…</span>}
            {runPending && !running && <span className="text-[11px] text-text-muted">Startes inden for et minut</span>}
          </p>
          <p className="mt-1 text-sm text-text-secondary">{job.description}</p>
          <p className="mt-1 text-xs text-text-muted">
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
            onClick={() => send({ enabled: !state.enabled }, state.enabled ? "Pauset" : "Genoptaget")}
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-text-secondary hover:bg-hf-tan disabled:opacity-50"
          >
            {state.enabled ? "Pause" : "Genoptag"}
          </button>
          <button
            type="button"
            disabled={busy || runPending}
            onClick={() => send({ runNow: true }, "Startes inden for et minut")}
            className="rounded-md bg-hf-green-dark px-3 py-1.5 text-xs text-hf-white disabled:opacity-50"
          >
            Kør nu
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <span>Kør:</span>
        <select
          value={scheduleType}
          onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
          className="rounded-md border border-border-strong bg-page-bg px-2 py-1"
        >
          <option value="time">Dagligt kl.</option>
          <option value="interval">Hvert … minut</option>
          <option value="manual">Kun ved &quot;Kør nu&quot;</option>
        </select>
        {scheduleType === "time" && (
          <input
            type="time"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            className="rounded-md border border-border-strong bg-page-bg px-2 py-1"
          />
        )}
        {scheduleType === "interval" && (
          <input
            inputMode="numeric"
            value={intervalValue}
            onChange={(e) => setIntervalValue(e.target.value.replace(/\D/g, ""))}
            className="w-20 rounded-md border border-border-strong bg-page-bg px-2 py-1"
          />
        )}
        <button
          type="button"
          disabled={busy}
          onClick={saveSchedule}
          className="rounded-md border border-border-strong px-2.5 py-1 hover:bg-hf-tan disabled:opacity-50"
        >
          Gem plan
        </button>
        {notice && <span className="text-hf-green-dark">{notice}</span>}
        {error && <span className="text-hf-red-dark">{error}</span>}
      </div>

      <p className="text-xs text-text-muted">
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
