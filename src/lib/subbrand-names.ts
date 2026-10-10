import { normalizeBrandName } from "@/lib/brand-match";

// Subbrandets navne (docs/DECISIONS.md 2026-10-10). Ren funktion, ingen
// DB-adgang, så både varesiden og serveren (src/lib/subbrand-logo.ts) kan
// bruge den. Et subbrand-logo hedder "<brand> <subbrand>" (fx "Ota Solgryn")
// eller subbrandet alene (fx "Kinder Bueno"); navnene sammenlignes
// normaliseret, så store/små bogstaver og tegnsætning ikke tæller. Samme regel
// bruges af logo-robottens import (scripts/logo-agent/import_logos.py).

/** Navnene, et subbrand-logo kan hedde — det mest præcise først. */
export function subbrandLogoNames(brandName: string | null | undefined, subbrand: string): string[] {
  const sub = subbrand.trim();
  if (!sub) return [];
  const brand = brandName?.trim();
  return brand ? [`${brand} ${sub}`, sub] : [sub];
}

/** Subbrandet er bare brandet igen og skal ikke stå to gange. */
export function subbrandRepeatsBrand(brandName: string | null | undefined, subbrand: string): boolean {
  return Boolean(brandName) && normalizeBrandName(brandName ?? "") === normalizeBrandName(subbrand);
}

/** Subbrandet, der skal vises over brandet — null når der intet er, eller det gentager brandet. */
export function displayedSubbrand(brandName: string | null | undefined, subbrand: string | null | undefined): string | null {
  const sub = subbrand?.trim();
  if (!sub || subbrandRepeatsBrand(brandName, sub)) return null;
  return sub;
}
