// Tidsvinduer for integrationens log på synkroniseringssiden (2026-10-11).
// Dage regnes altid i dansk tid (docs/REGLER.md). Ingen importer, så filen kan
// køres direkte i node --test og bruges både af serveren og klienten.

export const LOG_RANGES = ["today", "yesterday", "week", "month", "year", "all"] as const;
export type LogRange = (typeof LOG_RANGES)[number];

/** Valgene i historik-dropdownen (i dag står altid for sig selv over den). */
export const HISTORY_RANGES = ["yesterday", "week", "month", "year", "all"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export function isLogRange(value: unknown): value is LogRange {
  return typeof value === "string" && (LOG_RANGES as readonly string[]).includes(value);
}

export const LOG_TIME_ZONE = "Europe/Copenhagen";

/** Kalenderdag (ÅÅÅÅ-MM-DD) i dansk tid. */
export const ymdCph = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: LOG_TIME_ZONE }).format(date);

function offsetMinutes(at: number) {
  const part =
    new Intl.DateTimeFormat("en-US", { timeZone: LOG_TIME_ZONE, timeZoneName: "longOffset" })
      .formatToParts(new Date(at))
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = part.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** Tidspunktet, hvor en dansk kalenderdag begynder (midnat i dansk tid). */
export function startOfDayCph(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let instant = guess - offsetMinutes(guess) * 60_000;
  instant = guess - offsetMinutes(instant) * 60_000; // ret ved sommertidsskift
  return new Date(instant);
}

function shiftYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const HISTORY_DAYS: Record<Exclude<LogRange, "today" | "all">, number> = {
  yesterday: 1,
  week: 7,
  month: 30,
  year: 365,
};

/**
 * [from, to) for en periode. "today" = fra midnat og frem; historikken slutter
 * ved midnat i dag, så den aldrig gentager det, der står under "I dag".
 * from/to = null betyder ubegrænset.
 */
export function logWindow(range: LogRange, now: Date = new Date()): { from: Date | null; to: Date | null } {
  const today = ymdCph(now);
  const midnight = startOfDayCph(today);
  if (range === "today") return { from: midnight, to: null };
  if (range === "all") return { from: null, to: midnight };
  return { from: startOfDayCph(shiftYmd(today, -HISTORY_DAYS[range])), to: midnight };
}
