// Brand-logoets plads på produktcirklen (varesiden, 180 px cirkel).
//
// Logoet står med bunden i cirklens bund. Dets venstre kant må ikke røre
// cirklen: den lægges lige uden for cirklens kant ud for logoets overkant, plus
// lidt luft (ejerens regel 2026-10-07: "luft mellem Ø'et og cirklen"). Et lavt
// logo kan stå længere inde end et højt, fordi cirklen buer ind mod bunden.
//
// Subbrandet (logo eller navn) står oven over brandet med SUBBRAND_GAP_PX luft
// og samme regel for venstre kant (brugerens ønske 2026-10-10).

export const PRODUCT_CIRCLE_PX = 180;
/** Logoets maksimale boks (px) — samme mål som className på varesiden. */
export const BRAND_LOGO_MAX_WIDTH_PX = 95;
export const BRAND_LOGO_MAX_HEIGHT_PX = 66;
/** Højden på brandnavnet i fed grøn tekst (hf-type-title, linjehøjde 22 px). */
export const BRAND_NAME_HEIGHT_PX = 22;
/** Luft mellem brandet og subbrandet over det. */
export const SUBBRAND_GAP_PX = 6;

const AIR_PX = 8;

/** Højden brandet fylder ved cirklen: logoets rendrede højde, navnets linje eller 0 uden brand. */
export function brandSlotHeight(brand: { logoUrl?: string | null } | null | undefined, logoRatio: number | null): number {
  if (!brand) return 0;
  return brand.logoUrl ? brandLogoRenderedHeight(logoRatio) : BRAND_NAME_HEIGHT_PX;
}

/** Hvor højt subbrandet står over cirklens bund: over brandet med luft, eller i bunden uden brand. */
export function subbrandBottomPx(brandHeightPx: number): number {
  return brandHeightPx > 0 ? Math.round(brandHeightPx + SUBBRAND_GAP_PX) : 0;
}

/** Den rendrede højde af et logo med forholdet bredde/højde, fittet ind i logoets boks. */
export function brandLogoRenderedHeight(ratio: number | null): number {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return BRAND_LOGO_MAX_HEIGHT_PX;
  return Math.min(BRAND_LOGO_MAX_HEIGHT_PX, BRAND_LOGO_MAX_WIDTH_PX / ratio);
}

/**
 * Venstre kant (px fra cirklens venstre kant) for et logo/navn med den givne
 * højde, hvis bund står `bottomPx` over cirklens bund.
 */
export function brandLogoLeftPx(heightPx: number, bottomPx = 0): number {
  const radius = PRODUCT_CIRCLE_PX / 2;
  const top = PRODUCT_CIRCLE_PX - bottomPx - heightPx;
  const bottom = PRODUCT_CIRCLE_PX - bottomPx;
  // Cirklen er bredest ud for det punkt i elementets højde, der er nærmest midten.
  const nearest = Math.min(Math.max(radius, top), bottom);
  const dy = Math.min(Math.abs(nearest - radius), radius);
  const edgeX = radius + Math.sqrt(radius * radius - dy * dy);
  return Math.round(edgeX + AIR_PX);
}
