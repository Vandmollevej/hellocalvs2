// Popup'en "Du har vejet dig i morges" for smartvægt-vejninger (2026-10-09):
// hvilke vejninger der mangler svar, og hvordan dag/tidspunkt omtales. Der
// gås aldrig længere tilbage end sidste uge. Klientsikker (ingen Prisma).

export type PromptWeighIn = { id: string; weightKg: number; weighedAt: string; source: string; clothing: string | null };

export type PartOfDay = "night" | "morning" | "forenoon" | "afternoon" | "evening";

export type DayRef =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "thisWeek"; weekday: number }
  | { kind: "lastWeek"; weekday: number }
  | { kind: "date"; date: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Mandag = 0 … søndag = 6.
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export function startOfLastWeek(now: Date) {
  const monday = new Date(startOfDay(now).getTime() - mondayIndex(now) * DAY_MS);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7);
}

/** Vejninger fra smartvægte, der mangler svar, de nyeste sidst; højst tilbage til sidste uges mandag. */
export function pendingWeighIns(entries: PromptWeighIn[], now: Date): PromptWeighIn[] {
  const earliest = startOfLastWeek(now).getTime();
  return entries
    .filter((entry) => entry.source !== "MANUAL" && !entry.clothing)
    .filter((entry) => {
      const time = new Date(entry.weighedAt).getTime();
      return time >= earliest && time <= now.getTime();
    })
    .sort((a, b) => a.weighedAt.localeCompare(b.weighedAt));
}

export function partOfDay(date: Date): PartOfDay {
  const hour = date.getHours();
  if (hour < 5) return "night";
  if (hour < 10) return "morning";
  if (hour < 12) return "forenoon";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function dayRef(date: Date, now: Date): DayRef {
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
  if (diffDays <= 0) return { kind: "today" };
  if (diffDays === 1) return { kind: "yesterday" };
  const thisMonday = startOfDay(now).getTime() - mondayIndex(now) * DAY_MS;
  if (startOfDay(date).getTime() >= thisMonday) return { kind: "thisWeek", weekday: mondayIndex(date) };
  if (startOfDay(date).getTime() >= thisMonday - 7 * DAY_MS) return { kind: "lastWeek", weekday: mondayIndex(date) };
  return { kind: "date", date };
}
