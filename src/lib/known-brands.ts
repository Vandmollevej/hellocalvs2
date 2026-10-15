import { prisma } from "@/lib/prisma";
import type { BrandCandidate } from "@/lib/brand-match";

// Hvor mange brandnavne AI'en får med som støtteliste i forside- og
// stregkode-aflæsningen.
export const PROMPT_BRAND_LIMIT = 750;

// Alle brands (til matchBrand) + de navne, AI'en får som støtte. Støttelisten
// er de mest brugte brands, ikke de første alfabetisk: med ~3.000 brands
// sluttede den alfabetiske liste ved "Dr. Oetker", så AI'en aldrig så fx ØGO
// og læste Nettos ØGO-pose som "DAGO" (brugerens test 2026-10-15).
export async function loadKnownBrands(): Promise<{ all: BrandCandidate[]; promptNames: string[] }> {
  const rows = await prisma.brand.findMany({
    select: { id: true, name: true, _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
  const promptNames = [...rows]
    .sort((a, b) => b._count.products - a._count.products)
    .slice(0, PROMPT_BRAND_LIMIT)
    .map((row) => row.name);
  return { all: rows.map(({ id, name }) => ({ id, name })), promptNames };
}
