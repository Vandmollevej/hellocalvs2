// Brand-logoets plads på produktcirklen (varesiden, 180 px cirkel).
//
// Logoet står med bunden i cirklens bund. Dets venstre kant må ikke røre
// cirklen: den lægges lige uden for cirklens kant ud for logoets overkant, plus
// lidt luft (ejerens regel 2026-10-07: "luft mellem Ø'et og cirklen"). Et lavt
// logo kan stå længere inde end et højt, fordi cirklen buer ind mod bunden.

export const PRODUCT_CIRCLE_PX = 180;
/** Logoets maksimale boks (px) — samme mål som className på varesiden. */
export const BRAND_LOGO_MAX_WIDTH_PX = 95;
export const BRAND_LOGO_MAX_HEIGHT_PX = 66;
/** Højden på brandnavnet i fed grøn tekst (hf-type-title, linjehøjde 22 px). */
export const BRAND_NAME_HEIGHT_PX = 22;

const AIR_PX = 8;

/** Den rendrede højde af et logo med forholdet bredde/højde, fittet ind i logoets boks. */
export function brandLogoRenderedHeight(ratio: number | null): number {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return BRAND_LOGO_MAX_HEIGHT_PX;
  return Math.min(BRAND_LOGO_MAX_HEIGHT_PX, BRAND_LOGO_MAX_WIDTH_PX / ratio);
}

/** Venstre kant (px fra cirklens venstre kant) for et logo/navn med den givne højde. */
export function brandLogoLeftPx(heightPx: number): number {
  const radius = PRODUCT_CIRCLE_PX / 2;
  const top = PRODUCT_CIRCLE_PX - heightPx;
  const dy = top - radius;
  const edgeX = dy <= 0 ? PRODUCT_CIRCLE_PX : radius + Math.sqrt(radius * radius - dy * dy);
  return Math.round(edgeX + AIR_PX);
}
