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
    <div className="hf-type-caption flex flex-wrap items-center gap-2">
      <select
        value={scheduleType}
        onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
        aria-label="Plan"
        className="hf-input"
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
          className="hf-input"
        />
      )}
      {scheduleType === "interval" && (
        <input
          inputMode="numeric"
          value={intervalValue}
          onChange={(e) => setIntervalValue(e.target.value.replace(/\D/g, ""))}
          aria-label="Minutter"
          className="hf-input w-20"
        />
      )}
      <button type="button" disabled={busy} onClick={saveSchedule} className="hf-btn-secondary hf-btn--compact w-fit disabled:opacity-50">
        Gem plan
      </button>
      {notice && <span className="text-hf-green-dark">{notice}</span>}
      {error && <span className="text-hf-red-dark">{error}</span>}
    </div>
  );
}
