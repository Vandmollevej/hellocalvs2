// Søvnvinduet for én dato: dags-override (work_shifts) → ugedag
// (sleep_schedule) → generel standard (profilen). Delt af kalenderen og
// "Tilføj aktivitet", så begge viser samme stå-op-tid.

export type SleepDefaults = {
  defaultBedtime: string | null;
  defaultWakeTime: string | null;
};

export type SleepScheduleEntry = {
  weekday: number;
  bedtime: string;
  wakeTime: string;
};

export type WorkShiftEntry = {
  date: string;
  bedtime: string | null;
  wakeTime: string | null;
};

export type SleepWindow = { bedtime: number; wakeTime: number };

export function timeToMinutes(time: string | null | undefined) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Fejlretninger/FEJLLISTE.md #25: hvis kun ét af de to tidspunkter er sat
// nogen steder i kæden (dags-override → ugedag → generel standard), udregnes
// det andet som 7,5 times søvn derfra i stedet for at falde tilbage til to
// UAFHÆNGIGE faste tidspunkter (som ellers kunne give en søvnperiode på fx
// 3 eller 12 timer, hvis kun ét felt var sat). Kun når INGEN af dem er sat
// noget sted, bruges et fast standardvindue (23:00-06:30, 7,5 timer).
const FALLBACK_SLEEP_MINUTES = 7.5 * 60;

export function getSleepWindow(
  date: Date,
  defaults: SleepDefaults | null,
  weekdaySchedules: Record<number, SleepScheduleEntry>,
  workShifts: Record<string, WorkShiftEntry>,
): SleepWindow {
  const weekday = (date.getDay() + 6) % 7;
  const override = workShifts[isoDate(date)];
  const perDay = weekdaySchedules[weekday];
  const bedtime = timeToMinutes(override?.bedtime || perDay?.bedtime || defaults?.defaultBedtime);
  const wakeTime = timeToMinutes(override?.wakeTime || perDay?.wakeTime || defaults?.defaultWakeTime);

  if (bedtime !== null && wakeTime !== null) return { bedtime, wakeTime };
  if (bedtime !== null) return { bedtime, wakeTime: (bedtime + FALLBACK_SLEEP_MINUTES) % 1440 };
  if (wakeTime !== null) return { bedtime: (wakeTime - FALLBACK_SLEEP_MINUTES + 1440) % 1440, wakeTime };
  return { bedtime: 23 * 60, wakeTime: (23 * 60 + FALLBACK_SLEEP_MINUTES) % 1440 };
}

// En sengetid lige efter midnat (00:00-03:59) før stå-op-tiden er stadig en
// NAT-søvn — ikke dagsøvn efter en nattevagt.
export const LATE_BEDTIME_CUTOFF_MINUTES = 4 * 60;

export function isDaytimeSleep(window: SleepWindow) {
  return window.bedtime < window.wakeTime && window.bedtime >= LATE_BEDTIME_CUTOFF_MINUTES;
}

/**
 * Hvor aktivitets-banen starter: man træner ikke, mens man sover, så banen
 * begynder ved stå-op-tiden efter natten før (rundet ned til et kvarter).
 * Slutningen af dagen kendes ikke endnu, så banen går til midnat. Dagsøvn
 * (nattevagt) giver hele døgnet. Ligger den valgte start før stå-op (fx et
 * tryk i kalenderen kl. 05), starter banen dér, så starten altid kan ses.
 */
export function activityTrackStart(window: SleepWindow | null, startMinutes: number) {
  const wake = window && !isDaytimeSleep(window) ? Math.floor(window.wakeTime / 15) * 15 : 0;
  return Math.max(0, Math.min(wake, Math.floor(startMinutes / 15) * 15));
}
