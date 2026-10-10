// Regler for søgestatistikken (docs/DECISIONS.md 2026-10-10). Rene funktioner
// uden imports, så `npm test` kan indlæse dem direkte.

// Indtastning bogstav for bogstav ("nesc" → "nescaf" → "nescafé") eller
// sletning tilbage er samme søgning, når den kommer inden for få sekunder.
export const TYPING_WINDOW_MS = 15_000;
// En ny søgning uden klik inden for to minutter er en raffinering af den forrige.
export const REFINEMENT_WINDOW_MS = 2 * 60_000;
// Sletter brugeren tilbage efter en søgning uden fuldt match, som stod mindst
// så længe ("nescafe azera" → "nescafe"), er det en raffinering, ikke indtastning.
export const MISS_PAUSE_MS = 2_500;
// Et klik på et resultat tilskrives den seneste søgning inden for ti minutter.
export const CLICK_WINDOW_MS = 10 * 60_000;

export function normalizeSearchQuery(query: string): string {
  return query
    .normalize("NFKD")
    .replace(/[̀-̧̂̈̃]/g, "")
    .normalize("NFC")
    .toLocaleLowerCase("da")
    .replace(/\s+/g, " ")
    .trim();
}

export function isTypingContinuation(previous: string, next: string): boolean {
  const a = normalizeSearchQuery(previous);
  const b = normalizeSearchQuery(next);
  if (!a || !b) return false;
  return a.startsWith(b) || b.startsWith(a);
}

type PreviousSearch = { query: string; updatedAt: Date; clickedAt: Date | null; fullMatchCount: number };

// "update": ret den forrige række (brugeren skriver stadig), "refine": ny række
// knyttet til den forrige, "new": ny, selvstændig søgning.
export function classifyNextSearch(previous: PreviousSearch | null, query: string, now: Date): "update" | "refine" | "new" {
  if (!previous) return "new";
  const age = now.getTime() - previous.updatedAt.getTime();
  const shorter = normalizeSearchQuery(query).length < normalizeSearchQuery(previous.query).length;
  const backFromMiss = shorter && previous.fullMatchCount === 0 && age >= MISS_PAUSE_MS;
  if (!previous.clickedAt && age <= TYPING_WINDOW_MS && !backFromMiss && isTypingContinuation(previous.query, query)) return "update";
  if (!previous.clickedAt && age <= REFINEMENT_WINDOW_MS && normalizeSearchQuery(previous.query) !== normalizeSearchQuery(query)) return "refine";
  return "new";
}

// Tydeligt meningsløse søgninger kræver ingen AI-vurdering: ingen bogstaver,
// samme tegn gentaget ("aaaa") eller tastatur-rækker ("asdf", "qwerty").
const KEYBOARD_RUNS = ["qwertyuiopå", "asdfghjklæø", "zxcvbnm"];

export function obviousNonsense(normalizedQuery: string): boolean {
  const letters = normalizedQuery.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return true;
  if (/^(.)\1+$/u.test(letters)) return true;
  if (letters.length >= 4 && KEYBOARD_RUNS.some((row) => row.includes(letters))) return true;
  return false;
}

export function deviceFromUserAgent(userAgent: string): string {
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iPhone";
  return "Computer";
}

// Hvilken skærm søgningen kom fra (web: Referer-stien).
export function screenFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const path = new URL(referer).pathname;
    return path === "/" ? "/" : path.replace(/\/[0-9a-z]{20,}$/i, "/[id]").slice(0, 80);
  } catch {
    return null;
  }
}
