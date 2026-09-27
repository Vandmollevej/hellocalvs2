"use client";

import { regionFromTimeZone, type LanguageSignals } from "@/lib/regions";

// Samler sprogsignalerne i browseren ved stregkode-scanningen (brugerens valg
// 2026-09-27): telefonens land ud fra tidszonen (kun landet, ingen position),
// appens eget sprog og telefonens sprog. Fastfryses i produkt-draften.
export function readLanguageSignals(appLanguage: string | null | undefined): LanguageSignals {
  let timeZone: string | null = null;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timeZone = null;
  }
  const phoneLanguages =
    typeof navigator !== "undefined"
      ? [...(navigator.languages?.length ? navigator.languages : [navigator.language])].filter(Boolean).slice(0, 3)
      : [];
  return {
    locationCountry: regionFromTimeZone(timeZone),
    appLanguage: appLanguage ?? null,
    phoneLanguages,
  };
}
