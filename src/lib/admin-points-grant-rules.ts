// Regler for Admin → Brugere → Tildel points (docs/DECISIONS.md 2026-10-03).
// Rene funktioner uden server-imports, så de kan bruges i både API, admin-UI
// og tests.

// Højst svarende til én gratis måned (FREE_MONTH_COST) pr. tildeling. Holdes
// som literal her (i stedet for import), så filen kan køres direkte af
// node --test; testen tjekker, at tallet følger FREE_MONTH_COST.
export const ADMIN_GRANT_MAX_POINTS = 300;
export const ADMIN_GRANT_NOTE_MIN = 3;
export const ADMIN_GRANT_NOTE_MAX = 500;

// "Maks én gang om måneden": næste tildeling tidligst samme dato måneden
// efter den seneste. Findes datoen ikke (31. jan → feb), bruges månedens
// sidste dag.
export function nextAdminGrantAllowedAt(lastGrantAt: Date): Date {
  const next = new Date(lastGrantAt);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, daysInMonth));
  return next;
}

export function canGrantAdminPoints(lastGrantAt: Date | null, now: Date = new Date()): boolean {
  return !lastGrantAt || now.getTime() >= nextAdminGrantAllowedAt(lastGrantAt).getTime();
}

export type AdminGrantInput = { amount: number; note: string };

export function validateAdminGrantInput(raw: { amount?: unknown; note?: unknown }):
  | { ok: true; value: AdminGrantInput }
  | { ok: false; message: string } {
  const amount = typeof raw.amount === "string" ? Number(raw.amount) : raw.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > ADMIN_GRANT_MAX_POINTS) {
    return { ok: false, message: `Antal points skal være et helt tal mellem 1 og ${ADMIN_GRANT_MAX_POINTS}.` };
  }
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length < ADMIN_GRANT_NOTE_MIN) {
    return { ok: false, message: "Skriv en begrundelse (fx hvad der kompenseres for)." };
  }
  if (note.length > ADMIN_GRANT_NOTE_MAX) {
    return { ok: false, message: `Begrundelsen må højst være ${ADMIN_GRANT_NOTE_MAX} tegn.` };
  }
  return { ok: true, value: { amount, note } };
}
