// Settings → Visning → Forside: brugerens fem pulszoner (bpm) og hvilken zone
// tal-slideren viser tid i. Pr. enhed i localStorage, som de øvrige
// forside-valg (src/lib/frontpage-stats.ts).

import { useSyncExternalStore } from "react";
import { DEFAULT_PULSE_ZONES, type PulseZone } from "@/lib/frontpage-goal-math";

export type PulseZoneSettings = { zones: PulseZone[]; selected: number };

const STORAGE_KEY = "hellocal.frontpage.pulseZones";
const DEFAULTS: PulseZoneSettings = { zones: DEFAULT_PULSE_ZONES, selected: 2 };

function parse(raw: string | null): PulseZoneSettings {
  if (!raw) return DEFAULTS;
  try {
    const value = JSON.parse(raw) as Partial<PulseZoneSettings>;
    const zones = Array.isArray(value.zones) ? value.zones : [];
    const valid =
      zones.length === DEFAULT_PULSE_ZONES.length &&
      zones.every((zone) => Number.isFinite(zone?.min) && Number.isFinite(zone?.max) && zone.min <= zone.max);
    const selected = Number.isInteger(value.selected) ? Math.min(4, Math.max(0, value.selected as number)) : DEFAULTS.selected;
    return { zones: valid ? zones : DEFAULTS.zones, selected };
  } catch {
    return DEFAULTS;
  }
}

let cachedRaw: string | null | undefined;
let cached: PulseZoneSettings = DEFAULTS;
const listeners = new Set<() => void>();

function getSnapshot(): PulseZoneSettings {
  if (typeof window === "undefined") return DEFAULTS;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULTS;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = parse(raw);
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function savePulseZoneSettings(settings: PulseZoneSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage utilgængelig — ignorér, som i frontpage-stats.ts.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

export function usePulseZoneSettings(): PulseZoneSettings {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);
}
