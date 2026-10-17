// Træningspas på Tilføj → Aktivitet (brugerens ønske 2026-10-17): flere
// øvelser gemt under samme træning. Øvelserne ligger i rækkefølge efter
// hinanden fra passets starttidspunkt og deler ét sessionId.

export type SessionItem = { sportType: string; durationMinutes: number };

export const SESSION_DEFAULT_MINUTES = 15;
export const SESSION_MAX_ITEMS = 30;

/** Gyldige øvelser fra en request-body (ukendte felter og 0-minutter droppes). */
export function parseSessionItems(value: unknown): SessionItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > SESSION_MAX_ITEMS) return null;
  const items: SessionItem[] = [];
  for (const raw of value) {
    const item = raw as { sportType?: unknown; durationMinutes?: unknown };
    const minutes = Number(item?.durationMinutes);
    if (typeof item?.sportType !== "string" || !item.sportType || !(minutes > 0) || minutes > 24 * 60) return null;
    items.push({ sportType: item.sportType, durationMinutes: Math.round(minutes) });
  }
  return items;
}

/** Starttidspunkt for hver øvelse: den ene starter, når den forrige slutter. */
export function sessionStarts(start: Date, items: SessionItem[]): Date[] {
  let offset = 0;
  return items.map((item) => {
    const at = new Date(start.getTime() + offset * 60_000);
    offset += item.durationMinutes;
    return at;
  });
}

