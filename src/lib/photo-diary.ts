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
