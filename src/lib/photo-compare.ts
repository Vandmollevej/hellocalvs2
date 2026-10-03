// Før/efter-sammenligning i billede-dagbogen: de rene regler bag skyderen,
// så komponenterne kun står for visningen.

/** Skyderen starter på midten. */
export const COMPARE_START_PERCENT = 50;

/** Højde/bredde-forhold, der bruges, indtil før-billedet er indlæst. */
export const COMPARE_FALLBACK_RATIO = 3 / 4;

const KEY_STEP_PERCENT = 5;
const PAGE_STEP_PERCENT = 25;

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return COMPARE_START_PERCENT;
  return Math.min(100, Math.max(0, value));
}

/** Skyderens placering (0–100 %) ud fra fingerens/musens x i billedfeltet. */
export function percentFromPointer(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return COMPARE_START_PERCENT;
  return clampPercent(((clientX - left) / width) * 100);
}

/** Ny placering efter et tastetryk, eller null hvis tasten ikke flytter skyderen. */
export function percentFromKey(current: number, key: string): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return clampPercent(current - KEY_STEP_PERCENT);
    case "ArrowRight":
    case "ArrowUp":
      return clampPercent(current + KEY_STEP_PERCENT);
    case "PageDown":
      return clampPercent(current - PAGE_STEP_PERCENT);
    case "PageUp":
      return clampPercent(current + PAGE_STEP_PERCENT);
    case "Home":
      return 0;
    case "End":
      return 100;
    default:
      return null;
  }
}

/** Billedfeltets bredde/højde-forhold ud fra før-billedets naturlige mål. */
export function compareRatio(naturalWidth: number, naturalHeight: number): number {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return COMPARE_FALLBACK_RATIO;
  return naturalWidth / naturalHeight;
}

/** De billeder, man kan vælge som efter-billede: alle undtagen før-billedet. */
export function afterCandidates<T extends { id: string }>(photos: T[], beforeId: string): T[] {
  return photos.filter((photo) => photo.id !== beforeId);
}
