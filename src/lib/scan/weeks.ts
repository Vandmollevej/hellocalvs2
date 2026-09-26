// ISO-uger (mandag–søndag) til Historik/Ikke afregnet og admin-ugeoversigten.

export type IsoWeek = { year: number; week: number; start: Date; end: Date; key: string };

export function isoWeekOf(date: Date): IsoWeek {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() || 7) - 1));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { year, week, start, end, key: `${year}-W${String(week).padStart(2, "0")}` };
}

const SHORT_DATE = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" });

export function formatWeekPeriod(week: IsoWeek) {
  return `${SHORT_DATE.format(week.start)} – ${SHORT_DATE.format(week.end)}`;
}

// Grupperer rækker pr. ISO-uge, nyeste uge først.
export function groupByIsoWeek<T>(rows: T[], dateOf: (row: T) => Date) {
  const groups = new Map<string, { week: IsoWeek; rows: T[] }>();
  for (const row of rows) {
    const week = isoWeekOf(dateOf(row));
    const group = groups.get(week.key) ?? { week, rows: [] };
    group.rows.push(row);
    groups.set(week.key, group);
  }
  return [...groups.values()].sort((a, b) => b.week.start.getTime() - a.week.start.getTime());
}

export function formatKroner(ore: number) {
  return `${(ore / 100).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`;
}
