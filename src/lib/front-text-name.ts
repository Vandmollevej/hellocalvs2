import { prisma } from "@/lib/prisma";
import { matchBrandInTexts, type BrandMatch } from "@/lib/brand-match";
import { loadKnownBrands, PINNED_BRANDS } from "@/lib/known-brands";
import { normalizeProductName } from "@/lib/product-naming";
import { nameCandidates, pickProductType } from "@/lib/front-text-name-rules";

// Reserve, når OpenAI ikke kunne læse forsiden (brugerens krav 2026-10-16:
// Änglamark-letmælken fik intet navn, intet brand og 0 kcal, selv om
// "LETMÆLK" stod stort på kartonen). Telefonens egen tekstlæsning af forsiden
// (frontOcrText) holdes op mod:
// - brand-databasen (kendte mærker, der står ordret i teksten), og
// - varenavne, der allerede findes i databasen (fx "Letmælk" findes på mange
//   varer) — ingen AI, så det virker også, når OpenAI er nede.

export async function productTypeFromText(texts: (string | null | undefined)[], exclude: string[] = []): Promise<string | null> {
  const candidates = nameCandidates(texts);
  if (!candidates.length) return null;
  const rows = await prisma.$queryRaw<{ name: string; count: number }[]>`
    SELECT "name", count(*)::int AS "count"
    FROM "products"
    WHERE lower("name") = ANY(${candidates}::text[])
      AND "discontinued" = false
      AND "privateOwnerId" IS NULL
    GROUP BY "name"`;
  const name = pickProductType(rows, exclude);
  return name ? normalizeProductName(name) : null;
}

export type FrontTextFallback = { brand: BrandMatch | null; productType: string | null };

export async function readFrontText(text: string | null | undefined): Promise<FrontTextFallback> {
  if (!text?.trim()) return { brand: null, productType: null };
  const { all } = await loadKnownBrands();
  const brand = matchBrandInTexts(text.split(/\n+/), all, PINNED_BRANDS);
  const productType = await productTypeFromText([text], brand ? [brand.name] : []);
  return { brand, productType };
}
