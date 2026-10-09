// Tøj ved vejning (2026-10-07): nøgen, undertøj, tøj, tøj + mobil i lommen.
// Gættet kommer fra en admin-styret algoritme (WeightAttireSettings): kig på de
// seneste vejninger med bekræftet tøj og tag det mest brugte valg omkring samme
// tidspunkt på dagen; mangler data, bruges standardreglen (før kl. 08 undertøj,
// ellers tøj med mobil i lommen). Klientsikker (ingen Prisma).

export const WEIGH_ATTIRES = ["NAKED", "UNDERWEAR", "CLOTHED", "CLOTHED_PHONE"] as const;
export type WeighAttire = (typeof WEIGH_ATTIRES)[number];

export function isWeighAttire(value: unknown): value is WeighAttire {
  return typeof value === "string" && (WEIGH_ATTIRES as readonly string[]).includes(value);
}

export type AttireSettings = {
  enabled: boolean;
  lookbackCount: number;
  windowHours: number;
  underwearBefore: number;
  syncStaleHours: number;
};

export const DEFAULT_ATTIRE_SETTINGS: AttireSettings = {
  enabled: true,
  lookbackCount: 10,
  windowHours: 1.5,
  underwearBefore: 8,
  syncStaleHours: 48,
};

export type AttireHistoryItem = { weighedAt: string | Date; attire: WeighAttire | null };

const hourOf = (value: string | Date) => {
  const date = new Date(value);
  return date.getHours() + date.getMinutes() / 60;
};

// Afstand på et 24-timers ur (23:30 ligger tæt på 00:30).
function clockDistance(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 - diff);
}

export function defaultAttireFor(at: Date, settings: AttireSettings): WeighAttire {
  return hourOf(at) < settings.underwearBefore ? "UNDERWEAR" : "CLOTHED_PHONE";
}

/** history: nyeste først. Kun rækker med bekræftet tøj tæller. */
export function suggestAttire(at: Date, history: AttireHistoryItem[], settings: AttireSettings): WeighAttire {
  if (!settings.enabled) return defaultAttireFor(at, settings);
  const recent = history.filter((item) => item.attire).slice(0, Math.max(1, settings.lookbackCount));
  const target = hourOf(at);
  const near = recent.filter((item) => clockDistance(hourOf(item.weighedAt), target) <= settings.windowHours);
  if (near.length === 0) return defaultAttireFor(at, settings);

  const counts = new Map<WeighAttire, number>();
  for (const item of near) counts.set(item.attire as WeighAttire, (counts.get(item.attire as WeighAttire) ?? 0) + 1);
  // Uafgjort: det nyeste valg vinder (near er nyeste først, Map bevarer indsættelsesrækkefølge).
  let best: WeighAttire = near[0].attire as WeighAttire;
  for (const [attire, count] of counts) if (count > (counts.get(best) ?? 0)) best = attire;
  return best;
}

// "I går morges", "mandag morgen", "i tirsdags", ellers dato. Aldrig længere end en uge tilbage.
export const MAX_PROMPT_DAYS = 7;

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(at: Date, now = new Date()) {
  return Math.round((startOfDay(now).getTime() - startOfDay(at).getTime()) / 86_400_000);
}

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPartOf(at: Date): DayPart {
  const hour = at.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18) return "evening";
  return "night";
}
