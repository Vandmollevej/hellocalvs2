// Hvordan et råfoto (før fritlægningen) fylder varecirklen (bruger 2026-10-17).
//
// Et (næsten) kvadratisk foto — brugerens eget forsidefoto — dækker hele
// cirklen (design.md §6.12, 2026-10-16). Et højt eller bredt foto, fx en
// karton fra Open Food Facts, ville blive zoomet langt ind af "cover"; det
// vises derfor helt (contain) på hvid bund, så hele varen ses.

export type PhotoFit = "cover" | "contain";

// Højst 25 % skævhed tæller som kvadratisk.
const SQUARE_TOLERANCE = 1.25;

export function photoFitFor(width: number, height: number): PhotoFit {
  if (!(width > 0) || !(height > 0)) return "cover";
  const ratio = width >= height ? width / height : height / width;
  return ratio > SQUARE_TOLERANCE ? "contain" : "cover";
}
