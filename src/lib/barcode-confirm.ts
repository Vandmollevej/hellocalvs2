// Bekræftelse af en live stregkode-aflæsning (docs/DECISIONS.md 2026-10-03):
// én enkelt aflæsning fra ét billede er ikke nok. Tætte stribede mønstre
// (cowboystof, riller, tastaturer) kan af og til afkodes som en gyldig
// EAN/UPC-kode — især UPC-E og EAN-8, hvis kontrolciffer kun fanger hver
// tiende tilfældige kode. En ægte stregkode giver den samme kode billede
// efter billede; støj gør ikke.

export const BARCODE_CONFIRM_READS = 3;
export const BARCODE_CONFIRM_WINDOW_MS = 1500;

export type BarcodeSighting = { code: string; at: number };

// Lægger en aflæsning til historikken og siger, om koden nu er set nok
// gange inden for vinduet. Returnerer en ny historik (ældre end vinduet
// smides ud).
export function recordBarcodeSighting(
  history: readonly BarcodeSighting[],
  code: string,
  at: number,
): { history: BarcodeSighting[]; confirmed: boolean } {
  const recent = history.filter((sighting) => at - sighting.at <= BARCODE_CONFIRM_WINDOW_MS);
  recent.push({ code, at });
  const matches = recent.filter((sighting) => sighting.code === code).length;
  return { history: recent, confirmed: matches >= BARCODE_CONFIRM_READS };
}
