// Kalenderens åbne dag (DayDetails over månedsvisningen) huskes, så den ikke
// forsvinder, når brugeren forlader /calendar (fx åbner en registrering) og
// kommer tilbage — Next.js genmonterer siden ved hver navigation, så ren
// React-state er væk. To lag, i prioriteret rækkefølge:
//
// 1. URL'en: `/calendar?date=YYYY-MM-DD` sættes med replaceState, mens dagen
//    er åben. Browserens/appens Tilbage-knap lander derfor på samme dag.
// 2. sessionStorage: når brugeren i stedet trykker "Kalender" i bundmenuen
//    (ren `/calendar`), genåbnes den sidst åbne dag, hvis den blev forladt
//    inden for OPEN_DAY_MAX_AGE_MS. Lukker brugeren selv dagsvisningen
//    (tilbagepil, Escape, valg af anden visning), slettes den.
//
// Datoen gemmes som lokal kalenderdato (ikke ISO-tidsstempel), så den ikke
// skrider en dag ved tidszoner.

import { localDateKey } from "@/lib/sleep-quality";

const OPEN_DAY_PARAM = "date";
const OPEN_DAY_STORAGE_KEY = "hellocal.kalender.openDay";
const OPEN_DAY_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Lokal dato ud fra `YYYY-MM-DD`; null hvis strengen ikke er en gyldig dato. */
export function parseDateKey(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return localDateKey(date) === value ? date : null;
}

function readStoredOpenDay(now: number): Date | null {
  try {
    const raw = window.sessionStorage.getItem(OPEN_DAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { date, savedAt } = parsed as { date?: unknown; savedAt?: unknown };
    if (typeof savedAt !== "number" || now - savedAt > OPEN_DAY_MAX_AGE_MS) return null;
    return parseDateKey(typeof date === "string" ? date : null);
  } catch {
    return null;
  }
}

/**
 * Dagen kalenderen skal åbne i ved indlæsning: først `?date=` i URL'en,
 * ellers en nyligt forladt dag fra sessionStorage. Null = ingen åben dag.
 */
export function readOpenDay(now = Date.now()): Date | null {
  if (typeof window === "undefined") return null;
  const fromUrl = parseDateKey(new URLSearchParams(window.location.search).get(OPEN_DAY_PARAM));
  return fromUrl ?? readStoredOpenDay(now);
}

/**
 * Spejler den åbne dag i URL'en (`?date=`) og sessionStorage. Null fjerner
 * begge dele. Rører ikke andre query-parametre (fx `view=day`).
 */
export function syncOpenDay(date: Date | null, now = Date.now()) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (date) url.searchParams.set(OPEN_DAY_PARAM, localDateKey(date));
  else url.searchParams.delete(OPEN_DAY_PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) window.history.replaceState(window.history.state, "", next);
  try {
    if (date) {
      window.sessionStorage.setItem(OPEN_DAY_STORAGE_KEY, JSON.stringify({ date: localDateKey(date), savedAt: now }));
    } else {
      window.sessionStorage.removeItem(OPEN_DAY_STORAGE_KEY);
    }
  } catch {
    // sessionStorage utilgængelig (privat tilstand m.m.) — URL'en bærer dagen alene.
  }
}
