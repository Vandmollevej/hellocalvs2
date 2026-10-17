"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Fælles styring for admin "Cron-jobs" og "Robotter" (docs/DECISIONS.md
// 2026-09-25 og 2026-09-28): til/fra, kør nu og plan via samme API-rute.

export type JobState = {
  enabled: boolean;
  runAtTime: string | null;
  intervalMinutes: number | null;
  runRequestedAt: string | null;
  lastStartedAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
  lastDurationMs: number | null;
  /** Robot-QoS: forfalden, men venter på lavere belastning eller en spærretid (kun admin → Robotter). */
  qosWaitingSince?: string | null;
  qosWaitReason?: string | null;
};

// "continuous" = intervalMinutes 0: kører ved hvert tjek og venter hele tiden
// på nyt arbejde (fx billedrobottens fritlægning).
export type ScheduleType = "continuous" | "time" | "interval" | "manual";

export function scheduleTypeOf(state: Pick<JobState, "runAtTime" | "intervalMinutes">): ScheduleType {
  if (state.intervalMinutes === 0) return "continuous";
  if (state.runAtTime) return "time";
  if (state.intervalMinutes) return "interval";
  return "manual";
}

export function formatDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" }) : "Aldrig";
}

export function formatDuration(ms: number | null) {
  if (ms === null) return "";
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  return seconds < 120 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

export function useJobControl(jobKey: string, state: JobState) {
  const router = useRouter();
  const [scheduleType, setScheduleType] = useState<ScheduleType>(scheduleTypeOf(state));
  const [timeValue, setTimeValue] = useState(state.runAtTime ?? "03:00");
  const [intervalValue, setIntervalValue] = useState(String(state.intervalMinutes || 60));
  // Optimistisk til/fra: kontakten skifter ved første klik uden at vente på router.refresh().
  const [enabled, setEnabled] = useState(state.enabled);
  const [seenEnabled, setSeenEnabled] = useState(state.enabled);
  if (seenEnabled !== state.enabled) {
    setSeenEnabled(state.enabled);
    setEnabled(state.enabled);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const running = Boolean(state.lastStartedAt && (!state.lastRunAt || state.lastStartedAt > state.lastRunAt));
  const runPending = Boolean(state.runRequestedAt && (!state.lastStartedAt || state.runRequestedAt > state.lastStartedAt));

  async function send(body: Record<string, unknown>, successNotice: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/cron-jobs/${jobKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Kunne ikke gemme");
      setNotice(successNotice);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    void send({ enabled: next }, next ? "Slået til" : "Slået fra").then((ok) => {
      if (!ok) setEnabled(!next);
    });
  }

  function runNow() {
    void send({ runNow: true }, "Startes inden for et minut");
  }

  function saveSchedule() {
    const value = scheduleType === "time" ? timeValue : scheduleType === "interval" ? Number(intervalValue) : null;
    void send({ schedule: { type: scheduleType, value } }, "Plan gemt");
  }

  return {
    scheduleType,
    setScheduleType,
    timeValue,
    setTimeValue,
    intervalValue,
    setIntervalValue,
    enabled,
    busy,
    error,
    notice,
    running,
    runPending,
    toggleEnabled,
    runNow,
    saveSchedule,
  };
}
