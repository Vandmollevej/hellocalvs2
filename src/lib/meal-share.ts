"use client";

import { useCallback, useEffect, useState } from "react";

// Fælles måltid (docs/FAMILY.md): hvilke andre profiler en ny registrering
// også skal tilføjes til, og med hvilken portion (factor × den registrerede
// mængde). Gemmes kun i fanen (sessionStorage) og sendes med som `shareWith`
// til POST /api/registrations.

export type MealShareTarget = { profileId: string; factor: number };

const STORAGE_KEY = "hc_meal_share";
const EVENT = "hc-meal-share-change";

export const PORTION_FACTORS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function readMealShare(): MealShareTarget[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is MealShareTarget =>
            Boolean(item) && typeof item.profileId === "string" && typeof item.factor === "number"
        )
      : [];
  } catch {
    return [];
  }
}

export function writeMealShare(targets: MealShareTarget[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(targets));
  } catch {
    // Privat fane uden storage — valget gælder så kun indtil siden skiftes.
  }
  window.dispatchEvent(new Event(EVENT));
}

// Til request-bodyen: kun de profiler, der stadig må tastes ind for.
export function mealShareBody(allowedProfileIds?: string[]) {
  const targets = readMealShare().filter((target) => !allowedProfileIds || allowedProfileIds.includes(target.profileId));
  return targets.length > 0 ? { shareWith: targets } : {};
}

export function useMealShare() {
  const [targets, setTargets] = useState<MealShareTarget[]>([]);
  useEffect(() => {
    const sync = () => setTargets(readMealShare());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const update = useCallback((next: MealShareTarget[]) => writeMealShare(next), []);
  return { targets, update };
}
