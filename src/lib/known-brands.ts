import { prisma } from "@/lib/prisma";
import { normalizeBrandName, type BrandCandidate } from "@/lib/brand-match";

// Hvor mange brandnavne AI'en får med som støtteliste i forside- og
// stregkode-aflæsningen.
export const PROMPT_BRAND_LIMIT = 750;

// Kædernes egne mærker i danske supermarkeder. De er altid med i AI'ens
// støtteliste og i Brand-tabellen, uanset hvor få varer de har endnu —
// ØGO (Nettos økologi) havde én vare og kom aldrig med (brugerens test
// 2026-10-15: posen blev læst som "DAGO").
export const PINNED_BRANDS = [
  "ØGO",
  "Salling",
  "Salling Organic",
  "Gestus",
  "Princip",
  "Levevis",
  "Premieur",
  "Coop",
  "Coop 365",
  "Änglamark",
  "Xtra",
  "Irma",
  "Smagsløget",
  "REMA 1000",
  "First Price",
  "Grøn Balance",
  "Budget",
  "Milbona",
  "Pilos",
  "Solevita",
  "Dulano",
  "Crownfield",
  "Freeway",
  "Combino",
  "Alesto",
  "Deluxe",
];

let pinnedEnsured = false;

type BrandRow = { id: string; name: string; _count: { products: number } };

function readBrands(): Promise<BrandRow[]> {
  return prisma.brand.findMany({
    select: { id: true, name: true, _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

// Opretter de faste mærker, der mangler (sammenlignet normaliseret, så fx
// "Rema 1000" ikke får en "REMA 1000"-dublet), én gang pr. proces — så
// matchBrand/matchBrandInTexts kan koble varen til dem fra første scanning.
async function withPinnedBrands(rows: BrandRow[]): Promise<BrandRow[]> {
  if (pinnedEnsured) return rows;
  const existing = new Set(rows.map((row) => normalizeBrandName(row.name)));
  const missing = PINNED_BRANDS.filter((name) => !existing.has(normalizeBrandName(name)));
  try {
    if (missing.length) await prisma.brand.createMany({ data: missing.map((name) => ({ name })), skipDuplicates: true });
    pinnedEnsured = true;
  } catch (error) {
    console.error("Could not ensure pinned brands", error);
    return rows;
  }
  return missing.length ? readBrands() : rows;
}

// Alle brands (til matchBrand) + de navne, AI'en får som støtte: de faste
// kædemærker først, derefter de mest brugte brands — ikke de første
// alfabetisk (den liste sluttede ved "Dr. Oetker").
export async function loadKnownBrands(): Promise<{ all: BrandCandidate[]; promptNames: string[] }> {
  const rows = await withPinnedBrands(await readBrands());
  const pinned = new Set(PINNED_BRANDS.map(normalizeBrandName));
  const mostUsed = rows
    .filter((row) => !pinned.has(normalizeBrandName(row.name)))
    .sort((a, b) => b._count.products - a._count.products)
    .map((row) => row.name);
  const promptNames = [...PINNED_BRANDS, ...mostUsed].slice(0, PROMPT_BRAND_LIMIT);
  return { all: rows.map(({ id, name }) => ({ id, name })), promptNames };
}
