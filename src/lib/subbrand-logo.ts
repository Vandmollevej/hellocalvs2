import { prisma } from "@/lib/prisma";
import { normalizeBrandName } from "@/lib/brand-match";
import { displayedSubbrand, subbrandLogoNames, subbrandRepeatsBrand } from "@/lib/subbrand-names";

// Subbrandets logo (docs/DECISIONS.md 2026-10-10): tabellen subbrand_logos
// slås op på navnene fra src/lib/subbrand-names.ts. Logo-uploaden i admin
// genkender en fil som subbrand ud fra subbrand-navnene på varerne.

const CACHE_MS = 60_000;
let logoIndex: { at: number; byKey: Map<string, string> } | null = null;

async function logoUrlsByKey() {
  if (logoIndex && Date.now() - logoIndex.at < CACHE_MS) return logoIndex.byKey;
  // Nyeste først: to stavemåder af samme navn → det senest satte logo vinder.
  const rows = await prisma.subbrandLogo.findMany({
    select: { name: true, logoUrl: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeBrandName(row.name);
    if (key && !byKey.has(key)) byKey.set(key, row.logoUrl);
  }
  logoIndex = { at: Date.now(), byKey };
  return byKey;
}

let subbrandIndex: { at: number; byKey: Map<string, string> } | null = null;

// Alle subbrand-navne på varerne (begge stavemåder), til at genkende en logofil.
async function subbrandNamesByKey() {
  if (subbrandIndex && Date.now() - subbrandIndex.at < 20_000) return subbrandIndex.byKey;
  const rows = await prisma.$queryRaw<{ subbrand: string; brand: string | null }[]>`
    SELECT DISTINCT p.subbrand, b.name AS brand
    FROM products p
    LEFT JOIN brands b ON b.id = p."brandId"
    WHERE p.subbrand IS NOT NULL AND btrim(p.subbrand) <> ''
    ORDER BY p.subbrand, b.name
  `;
  const byKey = new Map<string, string>();
  for (const row of rows) {
    if (subbrandRepeatsBrand(row.brand, row.subbrand)) continue;
    for (const name of subbrandLogoNames(row.brand, row.subbrand)) {
      const key = normalizeBrandName(name);
      if (key && !byKey.has(key)) byKey.set(key, name);
    }
  }
  subbrandIndex = { at: Date.now(), byKey };
  return byKey;
}

export function invalidateSubbrandLogoCache() {
  logoIndex = null;
  subbrandIndex = null;
}

/** Subbrandets logo, hvis der findes et — ellers null. */
export async function findSubbrandLogoUrl(
  brandName: string | null | undefined,
  subbrand: string | null | undefined,
): Promise<string | null> {
  const shown = displayedSubbrand(brandName, subbrand);
  if (!shown) return null;
  const byKey = await logoUrlsByKey();
  for (const name of subbrandLogoNames(brandName, shown)) {
    const url = byKey.get(normalizeBrandName(name));
    if (url) return url;
  }
  return null;
}

/** Subbrandets navn, som det står på varerne, når et filnavn hedder som det. */
export async function findSubbrandName(fileBaseName: string): Promise<string | null> {
  const key = normalizeBrandName(fileBaseName);
  if (!key) return null;
  return (await subbrandNamesByKey()).get(key) ?? null;
}
