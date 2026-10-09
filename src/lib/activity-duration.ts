// Tid på Tilføj → Aktivitet: varighed som timer + minutter og et
// sluttidspunkt, der følger med begge veje. Starttidspunktet er værdien fra
// et datetime-local-felt ("YYYY-MM-DDTHH:MM").

const DAY_MINUTES = 24 * 60;

export function clockToMinutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(clock);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Varighed i hele minutter fra felterne "timer" og "minutter" (tomme = 0). */
export function durationMinutes(hours: string, minutes: string): number {
  const h = hours.trim() === "" ? 0 : Number(hours);
  const m = minutes.trim() === "" ? 0 : Number(minutes);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) return 0;
  return Math.round(h * 60 + m);
}

/** Deler minutter op i felterne igen (fx 95 → "1" og "35"). */
export function splitDuration(total: number): { hours: string; minutes: string } {
  const safe = Math.max(0, Math.round(total));
  return { hours: String(Math.floor(safe / 60)), minutes: String(safe % 60) };
}

/** Sluttidspunkt "HH:MM" = start + varighed (går over midnat). */
export function endClock(startedAt: string, minutes: number): string {
  const start = clockToMinutes(startedAt.split("T")[1] ?? "");
  if (start === null || !(minutes >= 0)) return "";
  const end = (((start + Math.round(minutes)) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

/**
 * Varighed ud fra et nyt sluttidspunkt. Ligger slut før (eller lig) start,
 * er aktiviteten gået over midnat. Null ved ugyldig tid.
 */
export function minutesUntil(startedAt: string, end: string): number | null {
  const start = clockToMinutes(startedAt.split("T")[1] ?? "");
  const stop = clockToMinutes(end);
  if (start === null || stop === null) return null;
  const diff = stop - start;
  return diff > 0 ? diff : diff + DAY_MINUTES;
}

/** Ny startværdi "YYYY-MM-DDTHH:MM" med samme dag og et nyt klokkeslæt. */
export function setStartClock(startedAt: string, clock: string): string {
  return `${startedAt.split("T")[0]}T${clock.slice(0, 5)}`;
}

/** Plus/minus i femminutters trin: går til næste/forrige hele 5 min (mindst 5, højst 24 t). */
export function stepDuration(total: number, direction: 1 | -1): number {
  const safe = Math.max(0, Math.round(total));
  const next = direction === 1 ? Math.floor(safe / 5) * 5 + 5 : Math.ceil(safe / 5) * 5 - 5;
  return Math.min(DAY_MINUTES, Math.max(5, next));
}
