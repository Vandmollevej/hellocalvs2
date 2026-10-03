// Vand i kalenderen (brugerens regel 2026-10-02): vand vises aldrig som
// "0 kcal", men som et glas-ikon med mængden i cl. Vand kommer fra to steder:
// WaterEntry (/water/create, mængde i ml) og en almindelig registrering af en
// vare, der er vand (fx "Flaskevand" fra søgningen, 0 kcal, mængde i gram).

const WATER_TITLE_PATTERN = /(^|\s)(flaske|kilde|mineral|dansk|poste|drikke)?vand\b|(^|\s)water\b|(^|\s)aqua\b/i;

export type WaterLikeRegistration = {
  titleSnapshot: string;
  kcalSnapshot: number;
  amountGrams?: number | null;
  classification?: { isDrink?: boolean } | null;
};

/** En registrering tæller som vand, når den er kaloriefri og enten hedder vand eller er en drikkevare. */
export function isWaterRegistration(registration: WaterLikeRegistration): boolean {
  if (Math.round(registration.kcalSnapshot) !== 0) return false;
  if (WATER_TITLE_PATTERN.test(registration.titleSnapshot)) return true;
  return Boolean(registration.classification?.isDrink);
}

/** Mængden af en vand-registrering i ml (1 g vand ≈ 1 ml). */
export function waterRegistrationMl(registration: WaterLikeRegistration): number {
  const grams = registration.amountGrams ?? 0;
  return grams > 0 ? grams : 0;
}

/** "25 cl", "33 cl", "1,5 l"-stil undgås bevidst: kalenderen siger altid cl. */
export function formatCl(ml: number, locale = "da-DK"): string {
  const cl = ml / 10;
  const digits = Number.isInteger(cl) || cl >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(cl)} cl`;
}
