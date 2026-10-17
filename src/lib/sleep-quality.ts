// Oplevelse af søvn (docs/DECISIONS.md 2026-09-26): a 1–5 rating of last
// night's sleep, stored per day in SleepQualityEntry.

export const SLEEP_QUALITY_RATINGS = [1, 2, 3, 4, 5] as const;

// Hvor ofte søvnspørgsmålet stilles (User.sleepQualityFrequency, samme valg som
// screeninger). MANUAL = spørg aldrig selv; brugeren vurderer fra Søvn-siden.
export const SLEEP_QUALITY_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "MANUAL"] as const;
export type SleepQualityFrequency = (typeof SLEEP_QUALITY_FREQUENCIES)[number];

export function isSleepQualityFrequency(value: unknown): value is SleepQualityFrequency {
  return typeof value === "string" && (SLEEP_QUALITY_FREQUENCIES as readonly string[]).includes(value);
}

/** Antal dage tilbage (inkl. i dag) uden vurdering, før der spørges igen; null = spørg aldrig. */
export function sleepPromptWindowDays(frequency: unknown): number | null {
  if (frequency === "MANUAL") return null;
  if (frequency === "WEEKLY") return 7;
  if (frequency === "MONTHLY") return 30;
  return 1;
}

export function isValidSleepQualityRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Local calendar date as "YYYY-MM-DD" (the day the user woke up). */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The overlay is shown at most once per day per device: the day it was last
// shown (answered or closed) is remembered here.
const LAST_PROMPT_KEY = "hellocal.sleepQuality.lastPromptDate";

export function readLastSleepPromptDate(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_PROMPT_KEY);
  } catch {
    return null;
  }
}

export function saveLastSleepPromptDate(dateKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_PROMPT_KEY, dateKey);
  } catch {
    // localStorage unavailable — the server-side entry check still applies.
  }
}

export async function saveSleepQuality(dateKey: string, rating: number) {
  const response = await fetch("/api/sleep-quality", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: dateKey, rating }),
  });
  if (!response.ok) throw new Error("save failed");
}

export async function fetchSleepQuality(from: string, to = from): Promise<{ date: string; rating: number }[]> {
  const response = await fetch(`/api/sleep-quality?from=${from}&to=${to}`);
  if (!response.ok) throw new Error("fetch failed");
  const data = (await response.json()) as { entries: { date: string; rating: number }[] };
  return data.entries;
}
