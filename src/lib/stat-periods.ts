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

export const DEFAULT_STAT_PERIOD: StatPeriodKey = "last7";

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
