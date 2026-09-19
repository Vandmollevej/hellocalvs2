import { barcodeMatchesRegion } from "@/lib/regions";

// Regional search ranking (2026-09-19, see docs/DECISIONS.md): text match is
// always dominant, and regional popularity/history/origin only reorder
// otherwise-comparable matches — a popular-but-wrong product can never
// outrank a clear text match. Low-popularity products additionally need more
// typed characters and a higher text similarity before they can surface.

export type SearchStat = {
  region: string;
  searchCount: number;
  clickCount: number;
};

export type HourStat = {
  region: string;
  hour: number;
  clickCount: number;
};

export type RankableProduct = {
  id: string;
  name: string;
  brand: { name: string } | null;
  originCountryCode?: string | null;
  barcodes: Array<{ code: string }>;
  regionSearchStats?: SearchStat[];
  regionHourStats?: HourStat[];
  // Region-scoped popularity of the product's *brand* (not just this one
  // product) — feeds the Søgealgoritmer "Region-specifikke brands/mærker"
  // weight (docs/DECISIONS.md, 2026-09-19). Absent/empty for brand-less
  // entries (e.g. a GenericIngredient), which simply contribute 0.
  brandRegionStats?: SearchStat[];
  // "Er verificeret med stregkode, mindst 2 billeder af produktet, billede
  // af varedeklaration og energifordeling" (Søgealgoritmer, 2026-09-19) —
  // computed by the caller from the product's own barcodes/images/
  // AiProductAnalysis rows, not stored on the row itself.
  isVerified?: boolean;
  // This user's own prior searches/clicks for this exact item (2026-09-19,
  // see UserProductSearchHistory in docs/DECISIONS.md) — feeds "Personligt
  // tidligere søgte produkter". Always 0 for an anonymous/demo request.
  personalSearchCount?: number;
  personalClickCount?: number;
  // Flat per-entity-type bias for the "Generiske ingredienser vs. varer"
  // weight: -1 for an ordinary Product, +1 for a GenericIngredient, 0 (the
  // default) for anything that should never move on this axis (e.g. the
  // HelloFresh-recipe Ingredient catalog). Multiplied by
  // SearchRankingWeights.genericVsProduct, which the caller supplies.
  entityBias?: number;
};

// Raw (pre-weight) signal values, exposed so the Søgealgoritmer admin page's
// live-test tool can show *why* an item ranked where it did — each value
// gets multiplied by the matching SearchRankingWeights field to get its
// contribution to the total score.
export type SearchRankingBreakdown = {
  similarity: number;
  regionalPopularity: number;
  timeOfDay: number;
  regionEan: number;
  verification: number;
  regionBrand: number;
  personalHistory: number;
  genericVsProduct: number;
};

export type RankedProduct<T extends RankableProduct> = {
  product: T;
  score: number;
  similarity: number;
  breakdown: SearchRankingBreakdown;
};

// Tunable secondary ranking parameters (Søgealgoritmer admin page,
// docs/DECISIONS.md 2026-09-19). Text similarity itself is deliberately
// NOT part of this type and always dominates (see the score formula below)
// — that principle is fixed product behavior, not something the admin page
// can turn off, only the secondary signals below can be tuned. Defaults
// below reproduce the exact pre-existing hardcoded behavior (18/4/12, the
// rest off), so an empty/unreachable SearchRankingConfig table changes
// nothing — see src/lib/search-ranking-config.ts.
export type SearchRankingWeights = {
  regionalPopularity: number; // pre-existing per-product region search/click popularity
  timeOfDay: number; // "Tid på dagen varen er søgt"
  regionEan: number; // "EAN-specifikke stregkoder for region"
  verification: number; // "Er verificeret med stregkode, ..."
  regionBrand: number; // "Region-specifikke brands/mærker"
  personalHistory: number; // "Personligt tidligere søgte produkter"
  genericVsProduct: number; // "Generiske ingredienser vs. varer" (signed: negative favors products, positive favors ingredients)
};

export const DEFAULT_SEARCH_RANKING_WEIGHTS: SearchRankingWeights = {
  regionalPopularity: 18,
  timeOfDay: 4,
  regionEan: 12,
  verification: 0,
  regionBrand: 0,
  personalHistory: 0,
  genericVsProduct: 0,
};

const LOW_POPULARITY_QUERY_PENALTY_MAX = 3;
const MIN_SIMILARITY = 0.18;
const LOW_POPULARITY_MIN_SIMILARITY = 0.42;

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

function bigrams(value: string): string[] {
  const normalized = normalize(value).replace(/\s+/g, " ");
  if (normalized.length < 2) return normalized ? [normalized] : [];
  const result: string[] = [];
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.push(normalized.slice(index, index + 2));
  }
  return result;
}

function diceSimilarity(left: string, right: string): number {
  const a = bigrams(left);
  const b = bigrams(right);
  if (a.length === 0 || b.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const gram of a) counts.set(gram, (counts.get(gram) ?? 0) + 1);

  let overlap = 0;
  for (const gram of b) {
    const count = counts.get(gram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length);
}

export function textSimilarity(query: string, productName: string, brandName?: string | null): number {
  const q = normalize(query);
  const name = normalize(productName);
  const brand = normalize(brandName ?? "");
  const searchable = `${name} ${brand}`.trim();

  if (!q || !searchable) return 0;
  if (name === q) return 1;
  if (name.startsWith(q)) return 0.97;
  if (searchable.startsWith(q)) return 0.94;
  if (name.includes(q)) return 0.88;
  if (searchable.includes(q)) return 0.82;

  return Math.max(diceSimilarity(q, name), diceSimilarity(q, searchable));
}

function regionalPopularity(product: RankableProduct, region: string): number {
  const stat = product.regionSearchStats?.find((entry) => entry.region === region);
  if (!stat) return 0;
  return Math.log1p(stat.clickCount * 3 + stat.searchCount);
}

function hourPopularity(product: RankableProduct, region: string, localHour: number): number {
  const stat = product.regionHourStats?.find(
    (entry) => entry.region === region && entry.hour === localHour
  );
  if (!stat) return 0;
  return Math.log1p(stat.clickCount);
}

function originBoost(product: RankableProduct, region: string): number {
  if (product.originCountryCode === region) return 1;
  if (product.originCountryCode === "US_CA" && (region === "US" || region === "CA")) return 1;
  if (product.barcodes.some((barcode) => barcodeMatchesRegion(barcode.code, region))) return 0.85;
  return 0;
}

function brandRegionalPopularity(product: RankableProduct, region: string): number {
  const stat = product.brandRegionStats?.find((entry) => entry.region === region);
  if (!stat) return 0;
  return Math.min(Math.log1p(stat.clickCount * 3 + stat.searchCount), 5);
}

function personalAffinity(product: RankableProduct): number {
  const searchCount = product.personalSearchCount ?? 0;
  const clickCount = product.personalClickCount ?? 0;
  if (searchCount === 0 && clickCount === 0) return 0;
  return Math.min(Math.log1p(clickCount * 3 + searchCount), 5);
}

// "Er verificeret med stregkode, mindst 2 billeder af produktet, billede af
// varedeklaration og energifordeling" (Søgealgoritmer, 2026-09-19) — a
// product only counts as verified once every one of these is true. The
// ingredients/nutrition *photo* requirement is checked via AiProductAnalysis
// rows (the guided camera flow's own record of a real photo having been
// analyzed for that kind), not just the presence of typed ingredientsText/
// macro fields, which a manually-typed product also has.
export function deriveIsVerified(product: {
  barcodeCount: number;
  imageCount: number;
  aiAnalyses?: Array<{ kind: string }>;
}): boolean {
  const kinds = new Set((product.aiAnalyses ?? []).map((analysis) => analysis.kind));
  return (
    product.barcodeCount > 0 &&
    product.imageCount >= 2 &&
    kinds.has("INGREDIENTS") &&
    kinds.has("NUTRITION")
  );
}

export function rankProducts<T extends RankableProduct>(
  products: T[],
  query: string,
  region: string,
  localHour: number,
  take: number,
  weights: SearchRankingWeights = DEFAULT_SEARCH_RANKING_WEIGHTS
): RankedProduct<T>[] {
  const popularityValues = products.map((product) => regionalPopularity(product, region));
  const maxPopularity = Math.max(0, ...popularityValues);

  return products
    .map((product, index) => {
      const similarity = textSimilarity(query, product.name, product.brand?.name);
      const popularity = popularityValues[index];
      const popularityRatio = maxPopularity > 0 ? popularity / maxPopularity : 0.5;
      const lowPopularity = Math.max(0, 1 - popularityRatio);

      // Low-priority products need more typed characters and a better text match
      // before they are allowed near the top of the suggestions.
      const extraChars = Math.round(lowPopularity * LOW_POPULARITY_QUERY_PENALTY_MAX);
      const minimumChars = 2 + extraChars;
      const minimumSimilarity =
        MIN_SIMILARITY +
        lowPopularity * (LOW_POPULARITY_MIN_SIMILARITY - MIN_SIMILARITY);

      if (normalize(query).length < minimumChars && lowPopularity > 0.34) return null;
      if (similarity < minimumSimilarity) return null;

      const regional = maxPopularity > 0 ? popularity / maxPopularity : 0;
      const hour = hourPopularity(product, region, localHour);
      const origin = originBoost(product, region);
      const brandRegional = brandRegionalPopularity(product, region);
      const personal = personalAffinity(product);

      // Text remains dominant. Every other signal below only reorders
      // otherwise-comparable matches, rather than letting a popular-but-wrong
      // or well-documented-but-wrong item outrank a clear text match.
      const hourCapped = Math.min(hour, 3);
      const verification = product.isVerified ? 1 : 0;
      const entityBias = product.entityBias ?? 0;

      const score =
        similarity * 100 +
        regional * weights.regionalPopularity +
        hourCapped * weights.timeOfDay +
        origin * weights.regionEan +
        verification * weights.verification +
        brandRegional * weights.regionBrand +
        personal * weights.personalHistory +
        entityBias * weights.genericVsProduct;

      const breakdown: SearchRankingBreakdown = {
        similarity,
        regionalPopularity: regional,
        timeOfDay: hourCapped,
        regionEan: origin,
        verification,
        regionBrand: brandRegional,
        personalHistory: personal,
        genericVsProduct: entityBias,
      };

      return { product, score, similarity, breakdown };
    })
    .filter((entry): entry is RankedProduct<T> => entry !== null)
    .sort((a, b) => b.score - a.score || b.similarity - a.similarity)
    .slice(0, take);
}
