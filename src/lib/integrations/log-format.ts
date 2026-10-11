// Log over det, en integration har leveret (synkroniseringssiden, 2026-10-11):
// typer og visning af én række. Klientsikker (ingen Prisma) og uden importer
// via @/-aliaset, så filen også kan køres i node --test.

import { MEASUREMENT_TYPES } from "../calendar-measurements.ts";
import { ymdCph } from "./log-window.ts";

export type IntegrationLogEntry = {
  id: string;
  kind: "metric" | "weight" | "activity";
  /** HealthMetricType, "WEIGHT" eller den normaliserede sportstype. */
  type: string;
  /** Måling: værdien; vejning: kg; træning: varighed i minutter. */
  value: number;
  /** Træning: forbrændte kcal. */
  kcal: number | null;
  at: string;
  /** Dagssum (gemt kl. 00:00 UTC): vises som "Hele dagen" uden klokkeslæt. */
  daySum: boolean;
};

export type IntegrationLogResponse = {
  range: string;
  entries: IntegrationLogEntry[];
  /** Antal rækker i perioden, før listen blev kortet til de seneste. */
  total: number;
};

type Spec = { unit: string; digits: number; style?: "duration" | "clock" };

const COUNT: Spec = { unit: "", digits: 0 };
const BPM: Spec = { unit: "bpm", digits: 0 };
const MINUTES: Spec = { unit: "min", digits: 0, style: "duration" };
const MS: Spec = { unit: "ms", digits: 0 };

// Typer, som calendar-measurements ikke kender (kropsmålinger står dér).
const SPECS: Record<string, Spec> = {
  STEPS: COUNT,
  DISTANCE_KM: { unit: "km", digits: 1 },
  FLOORS_CLIMBED: COUNT,
  ACTIVE_ENERGY_KCAL: { unit: "kcal", digits: 0 },
  RESTING_ENERGY_KCAL: { unit: "kcal", digits: 0 },
  WATER_ML: { unit: "ml", digits: 0 },
  EXERCISE_MINUTES: MINUTES,
  STAND_MINUTES: MINUTES,
  ACTIVE_ZONE_MINUTES: MINUTES,
  RESTING_HEART_RATE_BPM: BPM,
  RESTING_HEART_RATE_MINUTES: MINUTES,
  HEART_RATE_MIN_BPM: BPM,
  HEART_RATE_MAX_BPM: BPM,
  HEART_RATE_RECOVERY_BPM: BPM,
  HEART_RATE_VARIABILITY_MS: MS,
  RESPIRATORY_RATE_BPM: { unit: "/min", digits: 1 },
  VO2_MAX: { unit: "ml/kg/min", digits: 1 },
  STRESS_SCORE: COUNT,
  EDA_RESPONSES: COUNT,
  CARDIO_LOAD: COUNT,
  RECOVERY_SCORE: COUNT,
  STRAIN_SCORE: { unit: "", digits: 1 },
  FITNESS_AGE_YEARS: { unit: "år", digits: 0 },
  QRS_INTERVAL_MS: MS,
  PR_INTERVAL_MS: MS,
  QT_INTERVAL_MS: MS,
  QTC_INTERVAL_MS: MS,
  SLEEP_MINUTES: MINUTES,
  SLEEP_IN_BED_MINUTES: MINUTES,
  SLEEP_AWAKE_MINUTES: MINUTES,
  SLEEP_REM_MINUTES: MINUTES,
  SLEEP_LIGHT_MINUTES: MINUTES,
  SLEEP_DEEP_MINUTES: MINUTES,
  SLEEP_START_MINUTE_OF_DAY: { unit: "", digits: 0, style: "clock" },
  SLEEP_END_MINUTE_OF_DAY: { unit: "", digits: 0, style: "clock" },
  SLEEP_SCORE: COUNT,
  SLEEP_EFFICIENCY_PERCENT: { unit: "%", digits: 0 },
  SLEEP_AWAKENINGS: COUNT,
  BODY_WATER_KG: { unit: "kg", digits: 1 },
  METABOLIC_AGE: { unit: "år", digits: 0 },
  VASCULAR_AGE: { unit: "år", digits: 0 },
  ELECTROCHEMICAL_SKIN_CONDUCTANCE: { unit: "µS", digits: 0 },
};

const BODY_SPECS = new Map<string, Spec>(MEASUREMENT_TYPES.map((m) => [m.type, { unit: m.unit, digits: m.digits }]));

export function valueSpec(type: string): Spec {
  return SPECS[type] ?? BODY_SPECS.get(type) ?? { unit: "", digits: 1 };
}

/** Vitaminer og mineraler (…_MG/_UG) står ikke i loggen. */
export const isMicronutrientType = (type: string) => /_(MG|UG)$/.test(type);

type Translate = (key: string, params?: Record<string, string | number>) => string;

function duration(minutes: number, t: Translate) {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return t("integrations.connected.minutes", { m });
  return m === 0 ? t("integrations.connected.hours", { h }) : t("integrations.connected.hoursMinutes", { h, m });
}

/** Klokkeslæt ud fra minutter efter midnat (søvn start/slut). */
function clock(minuteOfDay: number) {
  const total = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Værdien som tekst, fx "7 t 12 min", "62 bpm", "81,4 kg". `locale` er et Intl-tag (da-DK). */
export function formatLogValue(entry: IntegrationLogEntry, t: Translate, locale: string): string {
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);

  if (entry.kind === "weight") return `${number(entry.value, 1)} kg`;
  if (entry.kind === "activity") {
    const time = duration(entry.value, t);
    return entry.kcal && entry.kcal > 0 ? `${time} · ${number(entry.kcal, 0)} kcal` : time;
  }
  const spec = valueSpec(entry.type);
  if (spec.style === "duration") return duration(entry.value, t);
  if (spec.style === "clock") return clock(entry.value);
  const formatted = number(entry.value, spec.digits);
  return spec.unit ? `${formatted} ${spec.unit}` : formatted;
}

/** i18n-nøgle til navnet på en målingstype (alle typer findes under integrations.log.type). */
export const logTypeLabelKey = (type: string) => `integrations.log.type.${type}`;

/** Rækkerne grupperet pr. dansk kalenderdag, nyeste dag først (rækkefølgen inde i dagen bevares). */
export function groupLogByDay(entries: IntegrationLogEntry[]): { day: string; entries: IntegrationLogEntry[] }[] {
  const groups = new Map<string, IntegrationLogEntry[]>();
  for (const entry of entries) {
    // Dagssummer er gemt som datoen kl. 00:00 UTC — datoen er dagens egen.
    const day = entry.daySum ? entry.at.slice(0, 10) : ymdCph(new Date(entry.at));
    const list = groups.get(day);
    if (list) list.push(entry);
    else groups.set(day, [entry]);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => ({ day, entries: list }));
}
