import { REGIONS } from "@/lib/regions";

// Periode, land/region og abonnementstype til /admin/statistics
// (docs/DECISIONS.md 2026-09-27 "Admin: Statistik"). Ren modul uden Prisma,
// så filterkomponenten på klienten kan bruge de samme lister. Alle dags- og
// ugegrænser regnes i dansk tid.

export const STATS_TZ = "Europe/Copenhagen";

export const STATS_PRESETS = [
  { value: "today", label: "I dag" },
  { value: "week", label: "Denne uge" },
  { value: "7d", label: "Sidste 7 dage" },
  { value: "month", label: "Denne måned" },
  { value: "lastMonth", label: "Sidste måned" },
  { value: "3m", label: "Sidste 3 måneder" },
  { value: "6m", label: "Sidste 6 måneder" },
  { value: "1y", label: "Sidste år" },
  { value: "all", label: "For evigt" },
  { value: "custom", label: "Valgfri periode" },
] as const;
export type StatsPreset = (typeof STATS_PRESETS)[number]["value"];

export const STATS_TIERS = [
  { value: "all", label: "Alle" },
  { value: "free", label: "Gratis" },
  { value: "serious", label: "Seriøs" },
  { value: "family", label: "Seriøs Familie" },
] as const;
export type StatsTier = (typeof STATS_TIERS)[number]["value"];

export const REGION_GROUPS = [
  { value: "g:scandinavia", label: "Skandinavien", countries: ["DK", "SE", "NO"] },
  { value: "g:dach", label: "DACH (Tyskland, Østrig, Schweiz)", countries: ["DE", "AT", "CH"] },
  { value: "g:benelux", label: "Benelux", countries: ["NL", "BE"] },
  { value: "g:south", label: "Sydeuropa", countries: ["FR", "IT", "ES"] },
  { value: "g:ukie", label: "Storbritannien og Irland", countries: ["GB", "IE"] },
  { value: "g:northamerica", label: "Nordamerika", countries: ["US", "CA"] },
  { value: "g:oceania", label: "Oceanien", countries: ["AU", "NZ"] },
] as const;

export const COUNTRY_OPTIONS = REGIONS.map((r) => ({ value: r.code as string, label: r.label as string }));

export function countryLabel(code: string): string {
  return COUNTRY_OPTIONS.find((c) => c.value === code)?.label ?? code;
}

// null = alle lande.
export function regionFilterCountries(value: string): string[] | null {
  if (!value || value === "all") return null;
  const group = REGION_GROUPS.find((g) => g.value === value);
  if (group) return [...group.countries];
  return COUNTRY_OPTIONS.some((c) => c.value === value) ? [value] : null;
}

export type StatsFilterInput = {
  preset: StatsPreset;
  from?: string; // YYYY-MM-DD, kun ved "custom"
  to?: string; // YYYY-MM-DD inklusive, kun ved "custom"
  region: string;
  tier: StatsTier;
};

export function parseStatsFilter(params: Record<string, string | string[] | undefined>): StatsFilterInput {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const presetRaw = one("preset");
  const preset = STATS_PRESETS.some((p) => p.value === presetRaw) ? (presetRaw as StatsPreset) : "month";
  const tierRaw = one("tier");
  const tier = STATS_TIERS.some((t) => t.value === tierRaw) ? (tierRaw as StatsTier) : "all";
  const region = one("region") ?? "all";
  const isDay = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return { preset, from: isDay(one("from")), to: isDay(one("to")), region, tier };
}

// --- Tidszone-hjælpere -----------------------------------------------------

type Ymd = { y: number; m: number; d: number };

function tzParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STATS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

function tzOffsetMs(date: Date) {
  const p = tzParts(date);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

// Midnat (dansk tid) på en given kalenderdag; måned/dag må gerne løbe over.
export function zonedMidnight({ y, m, d }: Ymd): Date {
  const guess = Date.UTC(y, m - 1, d);
  const offset = tzOffsetMs(new Date(guess));
  let time = guess - offset;
  const offset2 = tzOffsetMs(new Date(time));
  if (offset2 !== offset) time = guess - offset2;
  return new Date(time);
}

export function zonedYmd(date: Date): Ymd {
  const p = tzParts(date);
  return { y: p.y, m: p.m, d: p.d };
}

function normalize({ y, m, d }: Ymd): Ymd {
  const date = new Date(Date.UTC(y, m - 1, d));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function ymdString({ y, m, d }: Ymd) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// --- Periode og tidsinddeling ----------------------------------------------

export type StatsGranularity = "hour" | "day" | "week" | "month";

export type ResolvedRange = {
  from: Date;
  to: Date; // eksklusiv
  prevFrom: Date; // lige så lang periode umiddelbart før
  label: string;
  granularity: StatsGranularity;
  fromDay: string;
  toDay: string; // inklusiv
};

export function resolveStatsRange(filter: StatsFilterInput, now: Date, earliest: Date): ResolvedRange {
  const today = zonedYmd(now);
  const tomorrow = zonedMidnight({ ...today, d: today.d + 1 });
  let from: Date;
  let to = tomorrow;
  let label = STATS_PRESETS.find((p) => p.value === filter.preset)?.label ?? "";

  switch (filter.preset) {
    case "today":
      from = zonedMidnight(today);
      break;
    case "week": {
      const weekday = (new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay() + 6) % 7; // mandag = 0
      from = zonedMidnight({ ...today, d: today.d - weekday });
      break;
    }
    case "7d":
      from = zonedMidnight({ ...today, d: today.d - 6 });
      break;
    case "month":
      from = zonedMidnight({ ...today, d: 1 });
      break;
    case "lastMonth":
      from = zonedMidnight({ y: today.y, m: today.m - 1, d: 1 });
      to = zonedMidnight({ ...today, d: 1 });
      break;
    case "3m":
      from = zonedMidnight({ ...today, m: today.m - 3, d: today.d + 1 });
      break;
    case "6m":
      from = zonedMidnight({ ...today, m: today.m - 6, d: today.d + 1 });
      break;
    case "1y":
      from = zonedMidnight({ ...today, y: today.y - 1, d: today.d + 1 });
      break;
    case "all":
      from = zonedMidnight(zonedYmd(earliest));
      break;
    case "custom": {
      const parse = (v?: string): Ymd | null => {
        if (!v) return null;
        const [y, m, d] = v.split("-").map(Number);
        return { y, m, d };
      };
      const f = parse(filter.from) ?? { ...today, d: today.d - 29 };
      const t = parse(filter.to) ?? today;
      from = zonedMidnight(f);
      to = zonedMidnight({ ...t, d: t.d + 1 });
      if (to <= from) to = zonedMidnight({ ...f, d: f.d + 1 });
      label = `${ymdString(normalize(f))} – ${ymdString(normalize(t))}`;
      break;
    }
  }

  const length = to.getTime() - from.getTime();
  const days = length / 86_400_000;
  const granularity: StatsGranularity = days <= 1.1 ? "hour" : days <= 62 ? "day" : days <= 370 ? "week" : "month";
  const lastDay = new Date(to.getTime() - 1);
  return {
    from,
    to,
    prevFrom: new Date(from.getTime() - length),
    label,
    granularity,
    fromDay: ymdString(zonedYmd(from)),
    toDay: ymdString(zonedYmd(lastDay)),
  };
}

export type StatsBucket = { key: string; label: string };

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// Nøgler matcher SQL'ens to_char(date_trunc(...), 'YYYY-MM-DD"T"HH24').
export function bucketKey(date: Date, granularity: StatsGranularity): string {
  const p = tzParts(date);
  let ymd: Ymd = { y: p.y, m: p.m, d: p.d };
  let hour = 0;
  if (granularity === "hour") hour = p.h;
  if (granularity === "week") {
    const weekday = (new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay() + 6) % 7;
    ymd = normalize({ ...ymd, d: ymd.d - weekday });
  }
  if (granularity === "month") ymd = { ...ymd, d: 1 };
  return `${ymdString(ymd)}T${String(hour).padStart(2, "0")}`;
}

export function listBuckets(range: ResolvedRange): StatsBucket[] {
  const buckets: StatsBucket[] = [];
  const g = range.granularity;
  let cursor = new Date(range.from);
  const seen = new Set<string>();
  let guard = 0;
  while (cursor < range.to && guard++ < 2000) {
    const key = bucketKey(cursor, g);
    if (!seen.has(key)) {
      seen.add(key);
      const [datePart, hourPart] = key.split("T");
      const [y, m, d] = datePart.split("-").map(Number);
      const label =
        g === "hour"
          ? `kl. ${hourPart}`
          : g === "month"
            ? `${MONTHS[m - 1]} ${String(y).slice(2)}`
            : `${d}. ${MONTHS[m - 1]}`;
      buckets.push({ key, label });
    }
    const ymd = zonedYmd(cursor);
    cursor =
      g === "hour"
        ? new Date(cursor.getTime() + 3_600_000)
        : g === "month"
          ? zonedMidnight({ y: ymd.y, m: ymd.m + 1, d: 1 })
          : zonedMidnight({ ...ymd, d: ymd.d + 1 });
  }
  return buckets;
}

