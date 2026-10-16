import { ALCOHOL_LABEL_EXEMPT_PERCENT } from "./alcohol-label.ts";

// Energi-trinnet i kameraflowet (brugerens krav 2026-10-16: "Det skal ikke
// fejle. For man kan ikke fortsætte flowet hvis det fejler"): trinnet er først
// klaret, når energien faktisk er læst — telefonens egen aflæsning eller AI'en
// på fotoet. Ellers tages billedet om. Ingen skøn.

export type EnergyReadValues = {
  basis?: string | null;
  kcalPer100g?: number | null;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
  alcoholPercent?: number | null;
};

const isValue = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// Komplet pr. 100 g/ml — eller en alkoholisk drik over 1,2 % vol, som efter
// EU-reglerne ikke skal have en næringstabel (energien regnes af % vol).
export function energyReadOk(read: EnergyReadValues | null | undefined): boolean {
  if (!read) return false;
  const per100 = read.basis === "100g" || read.basis === "100ml";
  if (per100 && isValue(read.kcalPer100g) && isValue(read.proteinPer100g) && isValue(read.carbsPer100g) && isValue(read.fatPer100g)) {
    return true;
  }
  return isValue(read.alcoholPercent) && read.alcoholPercent > ALCOHOL_LABEL_EXEMPT_PERCENT;
}

// OpenAI afviser kaldet, fordi kontoen ikke har kredit (429 insufficient_quota).
export function isAiQuotaError(message: string): boolean {
  return /insufficient_quota|credit_balance_exhausted|no credits remaining/i.test(message);
}
