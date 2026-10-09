import { dayPartOf, daysAgo, MAX_PROMPT_DAYS, type DayPart } from "@/lib/weigh-attire";

// Tidsangivelse til vejnings-popuppen: "i morges", "i går morges", "mandag
// morgen", "i tirsdags" (ugen før), ellers datoen (aldrig længere end en uge tilbage).
type T = (key: string, params?: Record<string, string | number>) => string;

export function weighWhen(at: Date, t: T, intlLocale: string, now = new Date()): { label: string; part: DayPart; today: boolean } {
  const part = dayPartOf(at);
  const ago = daysAgo(at, now);
  const sinceMonday = (now.getDay() + 6) % 7;
  const weekday = new Intl.DateTimeFormat(intlLocale, { weekday: "long" }).format(at);
  let label: string;
  if (ago <= 0) label = t(`weighIn.when.today.${part}`);
  else if (ago === 1) label = t(`weighIn.when.yesterday.${part}`);
  else if (ago <= sinceMonday) {
    // Samme uge (mandag-baseret): "mandag morgen".
    label = t("weighIn.when.weekday", { weekday, part: t(`weighIn.when.part.${part}`) });
  } else if (ago <= MAX_PROMPT_DAYS) label = t("weighIn.when.lastWeek", { weekday });
  else label = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "long" }).format(at);
  return { label, part, today: ago <= 0 };
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "for 2 timer siden" — til synk-status.
export function agoLabel(from: Date, t: T, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 2) return t("weighIn.ago.justNow");
  if (minutes < 60) return t("weighIn.ago.minutes", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t("weighIn.ago.hours", { n: hours });
  return t("weighIn.ago.days", { n: Math.round(hours / 24) });
}
