import { useSyncExternalStore } from "react";

// Settings → Sprog og region → Enheder (og startguidens første trin): which
// units body weight and height / body lengths are shown and typed in. A
// per-device preference, same localStorage-not-database pattern as
// src/lib/calendar-view-pref.ts. The database always stores kg and cm — this
// module only converts at the edge. Until the user chooses, the default is
// derived from their country (profile region, else the browser's region).
export type WeightUnit = "kg" | "lb" | "st";
export type HeightUnit = "cm" | "in";

export const WEIGHT_UNITS: WeightUnit[] = ["kg", "lb", "st"];
export const HEIGHT_UNITS: HeightUnit[] = ["cm", "in"];

export type UnitPrefs = { weight: WeightUnit; height: HeightUnit };

const KG_PER_LB = 0.45359237;
const LB_PER_ST = 14;
const CM_PER_IN = 2.54;

export const DEFAULT_UNITS: UnitPrefs = { weight: "kg", height: "cm" };

// USA/Canada/Liberia/Myanmar: pounds + inches. UK/Ireland: stones & pounds
// for body weight, inches for height. Everywhere else: metric.
export function defaultUnitsForRegion(region: string | null | undefined): UnitPrefs {
  switch ((region ?? "").toUpperCase()) {
    case "US":
    case "CA":
    case "LR":
    case "MM":
      return { weight: "lb", height: "in" };
    case "GB":
    case "IE":
      return { weight: "st", height: "in" };
    default:
      return DEFAULT_UNITS;
  }
}

function browserRegion(): string | null {
  if (typeof navigator === "undefined") return null;
  const tags = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const tag of tags) {
    try {
      const region = new Intl.Locale(tag).region;
      if (region) return region;
    } catch {
      // Ugyldigt sprog-tag — prøv næste.
    }
  }
  return null;
}

const STORAGE_KEY = "hellocal.units";
// Region from the profile (set at sign-up / in settings) beats the browser's.
const REGION_STORAGE_KEY = "hellocal.units.region";

type StoredPrefs = { weight?: WeightUnit; height?: HeightUnit };

function isWeightUnit(value: unknown): value is WeightUnit {
  return WEIGHT_UNITS.includes(value as WeightUnit);
}

function isHeightUnit(value: unknown): value is HeightUnit {
  return HEIGHT_UNITS.includes(value as HeightUnit);
}

function readStored(): { raw: string; stored: StoredPrefs; region: string | null } {
  let raw = "";
  let region: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY) ?? "";
    region = window.localStorage.getItem(REGION_STORAGE_KEY);
  } catch {
    // localStorage unavailable — fall back to the automatic default.
  }
  let stored: StoredPrefs = {};
  try {
    const parsed = raw ? (JSON.parse(raw) as StoredPrefs) : {};
    stored = {
      weight: isWeightUnit(parsed.weight) ? parsed.weight : undefined,
      height: isHeightUnit(parsed.height) ? parsed.height : undefined,
    };
  } catch {
    stored = {};
  }
  return { raw: `${raw}|${region ?? ""}`, stored, region };
}

let cachedKey: string | undefined;
let cachedPrefs: UnitPrefs = DEFAULT_UNITS;

function getSnapshot(): UnitPrefs {
  if (typeof window === "undefined") return DEFAULT_UNITS;
  const { raw, stored, region } = readStored();
  if (raw === cachedKey) return cachedPrefs;
  cachedKey = raw;
  const auto = defaultUnitsForRegion(region ?? browserRegion());
  cachedPrefs = { weight: stored.weight ?? auto.weight, height: stored.height ?? auto.height };
  return cachedPrefs;
}

function getServerSnapshot(): UnitPrefs {
  return DEFAULT_UNITS;
}

const listeners = new Set<() => void>();

function notify() {
  cachedKey = undefined;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY || event.key === REGION_STORAGE_KEY) {
      cachedKey = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persists an explicit unit choice and notifies every mounted `useUnits()`. */
export function saveUnits(next: Partial<UnitPrefs>) {
  if (typeof window === "undefined") return;
  const current = readStored().stored;
  const merged: StoredPrefs = { ...current, ...next };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage unavailable — ignore, same as calendar-view-pref.ts.
  }
  notify();
}

/** Remembers the profile region so the automatic default follows the user's country. */
export function setUnitsRegion(region: string | null | undefined) {
  if (typeof window === "undefined" || !region) return;
  try {
    if (window.localStorage.getItem(REGION_STORAGE_KEY) === region) return;
    window.localStorage.setItem(REGION_STORAGE_KEY, region);
  } catch {
    return;
  }
  notify();
}

/** Active weight/height units (explicit choice, else country default), reactive and SSR-safe. */
export function useUnits(): UnitPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ---------- Conversion (storage is always kg / cm) ----------

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Short unit label for a weight unit, as shown next to input fields. */
export function weightUnitLabel(unit: WeightUnit): string {
  return unit === "st" ? "st lb" : unit;
}

/** Short unit label for a length unit (height and body measurements). */
export function lengthUnitLabel(unit: HeightUnit): string {
  return unit;
}

function numberFormat(value: number, decimals: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(value);
}

/** "72,5 kg", "160 lb" or "11 st 5 lb". */
export function formatWeight(kg: number, unit: WeightUnit, locale = "da-DK"): string {
  if (unit === "kg") return `${numberFormat(kg, 1, locale)} kg`;
  const lb = kgToLb(kg);
  if (unit === "lb") return `${numberFormat(lb, 1, locale)} lb`;
  const stones = Math.floor(lb / LB_PER_ST);
  const rest = round1(lb - stones * LB_PER_ST);
  return rest >= LB_PER_ST
    ? `${stones + 1} st 0 lb`
    : `${stones} st ${numberFormat(rest, 1, locale)} lb`;
}

/** Just the number part in the unit, for pre-filling an input ("72,5", "160", "11 5"). */
export function weightToInputValue(kg: number, unit: WeightUnit): string {
  if (unit === "kg") return String(round1(kg)).replace(".", ",");
  const lb = kgToLb(kg);
  if (unit === "lb") return String(round1(lb)).replace(".", ",");
  const stones = Math.floor(lb / LB_PER_ST);
  const rest = round1(lb - stones * LB_PER_ST);
  return rest >= LB_PER_ST ? `${stones + 1} 0` : `${stones} ${String(rest).replace(".", ",")}`;
}

/**
 * Typed weight → kg, or null when it can't be read. kg/lb: one number (comma
 * or dot decimal). st: "11 5", "11st 5lb", "11:5" = stones + pounds; a single
 * number is read as (decimal) stones.
 */
export function parseWeightInput(raw: string, unit: WeightUnit): number | null {
  const text = raw.trim().toLowerCase().replace(",", ".");
  if (!text) return null;
  if (unit === "kg" || unit === "lb") {
    const value = Number(text.replace(/\s*(kg|lbs?)$/, ""));
    if (!Number.isFinite(value) || value <= 0) return null;
    return unit === "kg" ? value : lbToKg(value);
  }
  const numbers = text.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length === 0 || numbers.length > 2 || numbers.some((n) => !Number.isFinite(n))) return null;
  const lb = numbers.length === 2 ? numbers[0] * LB_PER_ST + numbers[1] : numbers[0] * LB_PER_ST;
  return lb > 0 ? lbToKg(lb) : null;
}

/** Height or body length: "175 cm" or "69 in". */
export function formatLength(cm: number, unit: HeightUnit, locale = "da-DK"): string {
  return unit === "cm"
    ? `${numberFormat(cm, 1, locale)} cm`
    : `${numberFormat(cmToIn(cm), 1, locale)} in`;
}

/** Number part for pre-filling an input in the unit ("175" / "68,9"). */
export function lengthToInputValue(cm: number, unit: HeightUnit): string {
  return String(round1(unit === "cm" ? cm : cmToIn(cm))).replace(".", ",");
}

/** Typed length → cm, or null. */
export function parseLengthInput(raw: string, unit: HeightUnit): number | null {
  const value = Number(raw.trim().toLowerCase().replace(",", ".").replace(/\s*(cm|in)$/, ""));
  if (!raw.trim() || !Number.isFinite(value) || value <= 0) return null;
  return unit === "cm" ? value : inToCm(value);
}
