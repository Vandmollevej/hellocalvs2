// Time periods the user can swipe between on the individual stat cards.

export type StatPeriodKey =
  | "today"
  | "last7"
  | "lastWeek"
  | "thisWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear";

export const STAT_PERIODS: { key: StatPeriodKey; label: string }[] = [
  { key: "today", label: "I dag" },
  { key: "last7", label: "Seneste 7 dage" },
  { key: "lastWeek", label: "Sidste uge" },
  { key: "thisWeek", label: "Denne uge" },
  { key: "thisMonth", label: "Denne måned" },
  { key: "lastMonth", label: "Sidste måned" },
  { key: "thisYear", label: "I år" },
  { key: "lastYear", label: "Sidste år" },
];

export const DEFAULT_STAT_PERIOD: StatPeriodKey = "today";

// En valgt periode er enten et af de faste presets ovenfor eller en
// brugervalgt fra-til-periode fra kalender-dropdown'en (StatPeriodPicker).
// Bruges til ÉT globalt periodevalg for hele statistiksiden — ikke længere
// ét valg pr. kort (den tidligere swipe-for-at-skifte-periode er fjernet).
export type StatPeriodSelection =
  | { kind: "preset"; key: StatPeriodKey }
  | { kind: "custom"; start: Date; end: Date };

export const DEFAULT_STAT_SELECTION: StatPeriodSelection = { kind: "preset", key: DEFAULT_STAT_PERIOD };

export function selectionRange(selection: StatPeriodSelection): { start: Date; end: Date } {
  return selection.kind === "custom" ? { start: selection.start, end: selection.end } : periodRange(selection.key);
}

export function selectionLabel(selection: StatPeriodSelection): string {
  if (selection.kind === "preset") {
    return STAT_PERIODS.find((p) => p.key === selection.key)?.label ?? "";
  }
  const format = (date: Date) => date.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
  const inclusiveEnd = new Date(selection.end);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
  return `${format(selection.start)} – ${format(inclusiveEnd)}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const day = startOfDay(date);
  const weekday = (day.getDay() + 6) % 7; // mandag = 0
  day.setDate(day.getDate() - weekday);
  return day;
}

export function periodRange(key: StatPeriodKey, now: Date = new Date()): { start: Date; end: Date } {
  const today = startOfDay(now);

  switch (key) {
    case "today": {
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return { start: today, end };
    }
    case "last7": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "thisWeek": {
      const start = startOfWeek(today);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    case "lastWeek": {
      const end = startOfWeek(today);
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      return { start, end };
    }
    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start, end };
    }
    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end };
    }
    case "thisYear": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    case "lastYear": {
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear(), 0, 1);
      return { start, end };
    }
  }
}

export function filterDaysInRange<T extends { dateKey: string }>(
  days: T[],
  range: { start: Date; end: Date },
): T[] {
  return days.filter((day) => {
    const [y, m, d] = day.dateKey.split("-").map(Number);
    const time = new Date(y, m, d).getTime();
    return time >= range.start.getTime() && time < range.end.getTime();
  });
}
