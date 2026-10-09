// Tøj ved vejning (2026-10-09): en liste af til/fra-valg (undertøj, bukser, top,
// sweater, sko, mobil m.m. i lommen, efter toiletbesøg). Intet valgt = nøgen.
// Gættet kommer fra en admin-styret algoritme (WeightAttireSettings): kig på de
// seneste vejninger med bekræftet tøj og tag det mest brugte sæt omkring samme
// tidspunkt på dagen; mangler data, bruges standardreglen (før kl. 08 undertøj,
// ellers tøj med mobil i lommen). Klientsikker (ingen Prisma).
//
// `attire` (NAKED/UNDERWEAR/CLOTHED/CLOTHED_PHONE) bliver i databasen som
// bekræftelsesmærke (null = ikke bekræftet) og afledt grovsammenfatning af
// valgene; de præcise valg ligger i `attireItems`.

export const ATTIRE_ITEMS = ["UNDERWEAR", "PANTS", "TOP", "SWEATER", "SHOES", "POCKET_ITEMS", "AFTER_TOILET"] as const;
export type AttireItem = (typeof ATTIRE_ITEMS)[number];

export function isAttireItem(value: unknown): value is AttireItem {
  return typeof value === "string" && (ATTIRE_ITEMS as readonly string[]).includes(value);
}

/** Gyldige, unikke valg i fast rækkefølge; ukendte værdier kasseres. Ikke-liste => null. */
export function parseAttireItems(value: unknown): AttireItem[] | null {
  if (!Array.isArray(value)) return null;
  return ATTIRE_ITEMS.filter((item) => value.includes(item));
}

export const WEIGH_ATTIRES = ["NAKED", "UNDERWEAR", "CLOTHED", "CLOTHED_PHONE"] as const;
export type WeighAttire = (typeof WEIGH_ATTIRES)[number];

export function isWeighAttire(value: unknown): value is WeighAttire {
  return typeof value === "string" && (WEIGH_ATTIRES as readonly string[]).includes(value);
}

const CLOTHING_ITEMS: readonly AttireItem[] = ["PANTS", "TOP", "SWEATER", "SHOES"];

/** Grovsammenfatning gemt i `attire`; tom liste = nøgen. */
export function attireFromItems(items: readonly AttireItem[]): WeighAttire {
  if (items.includes("POCKET_ITEMS")) return "CLOTHED_PHONE";
  if (items.some((item) => CLOTHING_ITEMS.includes(item))) return "CLOTHED";
  if (items.includes("UNDERWEAR")) return "UNDERWEAR";
  return "NAKED";
}

/** Ældre vejninger uden `attireItems`: udled valgene af det gamle ene valg. */
export function itemsFromAttire(attire: WeighAttire): AttireItem[] {
  switch (attire) {
    case "NAKED":
      return [];
    case "UNDERWEAR":
      return ["UNDERWEAR"];
    case "CLOTHED":
      return ["UNDERWEAR", "PANTS", "TOP"];
    case "CLOTHED_PHONE":
      return ["UNDERWEAR", "PANTS", "TOP", "POCKET_ITEMS"];
  }
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

export type AttireHistoryItem = { weighedAt: string | Date; items: AttireItem[] };

const hourOf = (value: string | Date) => {
  const date = new Date(value);
  return date.getHours() + date.getMinutes() / 60;
};

// Afstand på et 24-timers ur (23:30 ligger tæt på 00:30).
function clockDistance(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 - diff);
}

export function defaultAttireFor(at: Date, settings: AttireSettings): AttireItem[] {
  return itemsFromAttire(hourOf(at) < settings.underwearBefore ? "UNDERWEAR" : "CLOTHED_PHONE");
}

/** history: nyeste først. Kun bekræftede vejninger er med (tom liste = bekræftet nøgen). */
export function suggestAttire(at: Date, history: AttireHistoryItem[], settings: AttireSettings): AttireItem[] {
  if (!settings.enabled) return defaultAttireFor(at, settings);
  const recent = history.slice(0, Math.max(1, settings.lookbackCount));
  const target = hourOf(at);
  const near = recent.filter((item) => clockDistance(hourOf(item.weighedAt), target) <= settings.windowHours);
  if (near.length === 0) return defaultAttireFor(at, settings);

  const counts = new Map<string, number>();
  for (const item of near) {
    const key = item.items.join(",");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Uafgjort: det nyeste sæt vinder (near er nyeste først, Map bevarer indsættelsesrækkefølge).
  let bestKey = near[0].items.join(",");
  for (const [key, count] of counts) if (count > (counts.get(bestKey) ?? 0)) bestKey = key;
  return parseAttireItems(bestKey ? bestKey.split(",") : []) ?? [];
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
