// "Scan varen igen" (docs/DECISIONS.md 2026-10-02) — klient-sikker regel for,
// hvornår /add/[id] viser banneret "Optjen 10 points", og hvilke af kameraets
// felter brugeren skal fotografere. Bruges både af banneret og af
// POST /api/products/[id]/rescan, så de to aldrig er uenige.

export type RescanStep = "front" | "nutrition" | "ingredients";

export const RESCAN_POINTS = 10;

// Vores egne online-varer (butikkernes produktark). De har godkendt næring og
// ingredienser — her mangler kun et ordentligt (fritlagt) forsidebillede.
const OWN_ONLINE_SOURCES = new Set(["REMA1000", "BILKA"]);

export type RescanCandidate = {
  externalSource?: string | null;
  imageUrl?: string | null;
  images?: { url: string; tags: string[] }[] | null;
  barcodes?: { code: string }[] | null;
  rescannedAt?: string | Date | null;
  privateOwnerId?: string | null;
};

// Et "ordentligt PNG": det fritlagte billede fra billedrobotten (gemt som
// .png) eller et billede tagget "Cutout" (docs/DECISIONS.md 2026-09-27).
export function hasProperCutout(product: RescanCandidate): boolean {
  const path = (product.imageUrl ?? "").split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".png")) return true;
  return (product.images ?? []).some((image) => image.tags.some((tag) => tag.toLowerCase() === "cutout"));
}

// Varer hentet automatisk ved stregkodeopslag (Open Food Facts, USDA) —
// ingen har set emballagen, så både billede, næring og indhold tjekkes.
const LOOKUP_SOURCES = new Set(["OPEN_FOOD_FACTS", "USDA"]);

// Tom liste = intet banner. Open Food Facts/USDA: alle tre felter (forside,
// energi, indhold). Egne online-varer uden PNG: kun forsiden. Kun første gang — er
// varen allerede scannet igen af nogen, vises banneret ikke mere.
export function rescanStepsFor(product: RescanCandidate): RescanStep[] {
  if (product.rescannedAt || product.privateOwnerId) return [];
  if (!product.barcodes?.length) return [];
  if (product.externalSource && LOOKUP_SOURCES.has(product.externalSource)) return ["front", "nutrition", "ingredients"];
  if (product.externalSource && OWN_ONLINE_SOURCES.has(product.externalSource) && !hasProperCutout(product)) {
    return ["front"];
  }
  return [];
}
