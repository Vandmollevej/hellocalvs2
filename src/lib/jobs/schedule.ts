// Samme planregler som scripts/*/job_control.py (admin "Cron-jobs",
// docs/DECISIONS.md 2026-09-25) — hold dem ens.

export type JobScheduleState = {
  enabled: boolean;
  runAtTime: string | null;
  intervalMinutes: number | null;
  runRequestedAt: Date | null;
  lastStartedAt: Date | null;
};

const TIME_ZONE = "Europe/Copenhagen";

// Dato (YYYY-MM-DD) og minut-i-døgnet i dansk tid.
function copenhagenParts(date: Date): { day: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function parseRunAtTime(value: string | null | undefined): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value?.trim() ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isJobDue(state: JobScheduleState, now: Date = new Date()): boolean {
  const { enabled, runAtTime, intervalMinutes, runRequestedAt, lastStartedAt } = state;
  if (runRequestedAt && (!lastStartedAt || runRequestedAt > lastStartedAt)) return true;
  if (!enabled) return false;
  if (intervalMinutes) {
    return !lastStartedAt || now.getTime() - lastStartedAt.getTime() >= intervalMinutes * 60_000;
  }
  const scheduled = parseRunAtTime(runAtTime);
  if (scheduled !== null) {
    const today = copenhagenParts(now);
    if (today.minutes < scheduled) return false;
    if (!lastStartedAt) return true;
    const last = copenhagenParts(lastStartedAt);
    return last.day < today.day || (last.day === today.day && last.minutes < scheduled);
  }
  return !lastStartedAt;
}

// Til admin-siden: hvornår kører jobbet næste gang (omtrent), eller null.
export function describeNextRun(state: JobScheduleState): string {
  if (!state.enabled) return "Pauset";
  if (state.intervalMinutes) {
    const m = state.intervalMinutes;
    if (m === 1) return "Hvert minut";
    if (m === 60) return "Hver time";
    return m % 60 === 0 ? `Hver ${m / 60}. time` : `Hvert ${m}. minut`;
  }
  if (parseRunAtTime(state.runAtTime) !== null) return `Dagligt kl. ${state.runAtTime}`;
  return "Kun ved \"Kør nu\"";
}
