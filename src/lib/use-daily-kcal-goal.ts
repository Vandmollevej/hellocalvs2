"use client";

import { useSyncExternalStore } from "react";
import { DAILY_KCAL_GOAL, resolveDailyKcalGoal } from "@/lib/goals";

// Client-side copy of the user's daily kcal limit (User.dailyKcalGoal), shared
// by every screen so a change from the suggestion popup shows up everywhere at
// once. Starts at the default and is filled from /api/profile once per load.
let current = DAILY_KCAL_GOAL;
let requested = false;
const listeners = new Set<() => void>();

export function setDailyKcalGoal(kcal: number) {
  if (kcal === current) return;
  current = kcal;
  listeners.forEach((listener) => listener());
}

function load() {
  if (requested) return;
  requested = true;
  fetch("/api/profile")
    .then((res) => (res.ok ? (res.json() as Promise<{ user?: { dailyKcalGoal?: number | null } }>) : null))
    .then((data) => {
      if (data?.user) setDailyKcalGoal(resolveDailyKcalGoal(data.user));
    })
    .catch(() => {
      requested = false;
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

export function useDailyKcalGoal(): number {
  return useSyncExternalStore(subscribe, () => current, () => DAILY_KCAL_GOAL);
}
