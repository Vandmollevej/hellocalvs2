"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  MEAL_INPUT_LANGUAGE_STORAGE_KEY,
  defaultMealInputLanguage,
  readStoredMealInputLanguage,
  storeMealInputLanguage,
  type MealInputLanguageCode,
} from "@/lib/meal-input-language";

// Fælles for tale-siden og chat-siden: brugerens gemte flagvalg, ellers
// regionens sprog. Regionen hentes fra profilen (samme kilde som før).
// useSyncExternalStore, så server-renderingen (intet localStorage) ikke giver
// et forkert flag efter hydrering.
const CHANGE_EVENT = "hf-meal-input-language-change";

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === MEAL_INPUT_LANGUAGE_STORAGE_KEY) onChange();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useMealInputLanguage() {
  const [region, setRegion] = useState<string | null>(null);
  const stored = useSyncExternalStore(subscribe, readStoredMealInputLanguage, () => null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { region?: string } } | null) => {
        if (!cancelled && data?.user?.region) setRegion(data.user.region);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((code: MealInputLanguageCode) => {
    storeMealInputLanguage(code);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { language: stored ?? defaultMealInputLanguage(region), region, setLanguage };
}
