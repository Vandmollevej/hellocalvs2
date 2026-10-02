// Billede-dagbogens billeder og de små hjælpere, som siden, karrusellen og
// fuldskærmsvisningen deler.

export type DiaryPhoto = {
  id: string;
  /** Object URL for the stored Blob (se photo-diary-store.ts). */
  url: string;
  takenAt: string;
};

// Ældste først: karrusellen og fuldskærmsvisningen viser billederne
// kronologisk fra venstre mod højre.
export function sortOldestFirst(photos: DiaryPhoto[]): DiaryPhoto[] {
  return [...photos].sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
}

// Plads i en ring af `count` billeder — også for negative tal, så
// karrusellen kan køre i loop begge veje.
export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

// Før/efter-sammenligningen (PhotoCompare): standardparret er det ældste
// billede som "før" og det aktive som "efter". Står det ældste i midten,
// bruges det nyeste som "efter", så de to aldrig er det samme billede.
// `photos` er ældst først. Under to billeder er der intet at sammenligne.
export function defaultComparePair(
  photos: DiaryPhoto[],
  activeIndex: number,
): { beforeId: string; afterId: string } | null {
  if (photos.length < 2) return null;
  const before = photos[0];
  const active = photos[activeIndex];
  const after = active && active.id !== before.id ? active : photos[photos.length - 1];
  return { beforeId: before.id, afterId: after.id };
}

// Skillelinjens/tonings placering i procent (0–100) ud fra fingerens x.
export function comparePercentAt(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return 50;
  const pct = ((clientX - left) / width) * 100;
  return Math.min(100, Math.max(0, pct));
}

// Største boks med billedets forhold (bredde/højde), der kan stå inde i
// en flade på `width` × `height` — så skillelinjen følger selve billedet og
// ikke den sorte luft omkring det.
export function fitContain(
  ratio: number,
  width: number,
  height: number,
): { width: number; height: number } {
  if (!(ratio > 0) || !(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  if (width / height > ratio) return { width: Math.round(height * ratio), height: Math.round(height) };
  return { width: Math.round(width), height: Math.round(width / ratio) };
}

// Hele kalenderdage mellem to billeder (lokal tid), uanset rækkefølge.
export function daysBetweenPhotos(a: string, b: string): number {
  const dayStart = (value: string) => {
    const date = new Date(value);
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  };
  return Math.round(Math.abs(dayStart(b) - dayStart(a)) / 86_400_000);
}

export function formatPhotoDay(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatPhotoTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
