// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-25). Tallene er AI'ens
// sikkerhed (0–1), ikke usikkerhed.
//
// - Under UNCERTAINTY_TARGET (90 %): vises på Uncertainties (vejledende mål).
// - Under URGENT_BELOW (70 %): rød markering, sorteres øverst.
// - Under HIDE_FROM_SEARCH_BELOW (50 %): produktet skjules i søgningen,
//   indtil en admin har gennemgået analysen.
export const UNCERTAINTY_TARGET = 0.9;
export const URGENT_BELOW = 0.7;
export const HIDE_FROM_SEARCH_BELOW = 0.5;
