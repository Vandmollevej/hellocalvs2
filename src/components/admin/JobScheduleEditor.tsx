"use client";

import type { ScheduleType, useJobControl } from "@/components/admin/useJobControl";

// Planvælger (Løbende / dagligt kl. / interval / kun manuelt) til admin
// "Cron-jobs" og "Robotter".
export function JobScheduleEditor({ control }: { control: ReturnType<typeof useJobControl> }) {
  const {
    scheduleType,
    setScheduleType,
    timeValue,
    setTimeValue,
    intervalValue,
    setIntervalValue,
    busy,
    notice,
    error,
    saveSchedule,
  } = control;

  return (
    <div className="hf-type-small flex flex-wrap items-center gap-2 text-text-secondary">
      <select
        value={scheduleType}
        onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
        aria-label="Plan"
        className="rounded-md border border-hf-tan-dark bg-page-bg px-2 py-1"
      >
        <option value="continuous">Løbende</option>
        <option value="time">Dagligt kl.</option>
        <option value="interval">Hvert … minut</option>
        <option value="manual">Kun ved &quot;Kør&quot;</option>
      </select>
      {scheduleType === "time" && (
        <input
          type="time"
          value={timeValue}
          onChange={(e) => setTimeValue(e.target.value)}
          aria-label="Tidspunkt"
          className="rounded-md border border-hf-tan-dark bg-page-bg px-2 py-1"
        />
      )}
      {scheduleType === "interval" && (
        <input
          inputMode="numeric"
          value={intervalValue}
          onChange={(e) => setIntervalValue(e.target.value.replace(/\D/g, ""))}
          aria-label="Minutter"
          className="w-20 rounded-md border border-hf-tan-dark bg-page-bg px-2 py-1"
        />
      )}
      <button type="button" disabled={busy} onClick={saveSchedule} className="hf-btn-secondary px-2.5 py-1 disabled:opacity-50">
        Gem plan
      </button>
      {notice && <span className="text-hf-green-dark">{notice}</span>}
      {error && <span className="text-hf-red-dark">{error}</span>}
    </div>
  );
}
