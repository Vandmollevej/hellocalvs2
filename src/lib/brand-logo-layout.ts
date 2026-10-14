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

// Uden produktbillede står et logo stort midt i cirklen (brugerens regel
// 2026-10-14): har varen et subbrand med logo, er det subbrandets logo og
// brandet bliver stående dér, hvor det plejer; ellers brandets eget logo.
// Logoet må rage uden for cirklen, men højst i den ene retning: den lange side
// får CIRCLE_LOGO_LONG_PX (≈ 120 % af cirklen), den korte holder sig inde i
// cirklen (CIRCLE_LOGO_SHORT_PX). Et næsten kvadratisk logo rager slet ikke ud.

/** Den lange side af et logo i cirklen (px) — må være større end cirklen. */
export const CIRCLE_LOGO_LONG_PX = 216;
/** Den korte side af et logo i cirklen (px) — holder sig inde i cirklen. */
export const CIRCLE_LOGO_SHORT_PX = 150;

export type CircleLogo = { kind: "brand" | "subbrand"; url: string; name: string };

/** Logoet, der står stort i cirklen, når varen ikke har et produktbillede — ellers null. */
export function circleLogoFor(input: {
  brand: { name: string; logoUrl?: string | null } | null | undefined;
  subbrand: string | null;
  subbrandLogoUrl: string | null | undefined;
}): CircleLogo | null {
  if (input.subbrand && input.subbrandLogoUrl) {
    return { kind: "subbrand", url: input.subbrandLogoUrl, name: input.subbrand };
  }
  if (input.brand?.logoUrl) return { kind: "brand", url: input.brand.logoUrl, name: input.brand.name };
  return null;
}

/** Mål (px) for et logo med forholdet bredde/højde i cirklen: liggende rager ud i bredden, stående i højden. */
export function circleLogoSize(ratio: number | null): { width: number; height: number } {
  const r = ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const maxWidth = r >= 1 ? CIRCLE_LOGO_LONG_PX : CIRCLE_LOGO_SHORT_PX;
  const maxHeight = r >= 1 ? CIRCLE_LOGO_SHORT_PX : CIRCLE_LOGO_LONG_PX;
  const width = Math.min(maxWidth, maxHeight * r);
  return { width: Math.round(width), height: Math.round(width / r) };
}
