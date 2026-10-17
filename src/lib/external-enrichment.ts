import { prisma } from "@/lib/prisma";
import { fetchOffProductRaw, mapOffRawProduct } from "@/lib/openFoodFacts";
import { applyOffRecordToProduct, offRecordFromStored, saveOffRecordSafely, type SavedOffRecord } from "@/lib/off-store";
import { addCertificationFilters } from "@/lib/product-certification-filters";
import { createExternalImageCutoutJob } from "@/lib/image-cutout-jobs";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import { languageCode } from "@/lib/product-language";
import { debugLog, errorText } from "@/lib/debug-log";

// Eksterne kilder flettes automatisk ind, så snart en vare scannes, oprettes
// eller fremsøges (bruger 2026-10-17, docs/DECISIONS.md). I dag er Open Food
// Facts (stregkoden) den eksterne kilde. Reglen er "kun huller fyldes":
// etikettens/fotoets data overskrives aldrig, et brand oprettes aldrig ud fra
// OFF alene, og næringstal tages kun, når OFF's energi passer med varens egen
// (samme vare/opskrift). Energien selv skønnes aldrig fra OFF her — den følger
// stadig stregkode-reserven (applyEanReserve).

export type ExternalEnrichmentReason = "scan" | "create" | "search" | "page" | "admin" | "sweep";

// Samme vare tjekkes højst så ofte (Product.sourceCheckedAt); OFF-svaret
// hentes igen, når det gemte er ældre end OFF_REFETCH_DAYS.
const RECHECK_HOURS = 24 * 7;
const OFF_REFETCH_DAYS = 30;
// OFF tillader ca. 100 vareopslag i minuttet; søgning kan sende mange varer på
// én gang, så kaldene køres to ad gangen i en begrænset kø.
const MAX_PARALLEL = 2;
const MAX_QUEUE = 300;
// OFF's næringstal bruges kun, når energien ligger inden for ±5 % af varens.
const KCAL_MATCH_TOLERANCE = 0.05;

const queue: (() => Promise<void>)[] = [];
const queued = new Set<string>();
let running = 0;

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const job = queue.shift()!;
    running += 1;
    void job().finally(() => {
      running -= 1;
      pump();
    });
  }
}

// Fire-and-forget: lægger varerne i køen og vender straks tilbage. Bruges fra
// opslag, søgning og varesiden, så brugeren aldrig venter på OFF.
export function queueExternalEnrichment(productIds: (string | null | undefined)[], reason: ExternalEnrichmentReason) {
  for (const id of productIds) {
    if (!id || queued.has(id) || queue.length >= MAX_QUEUE) continue;
    queued.add(id);
    queue.push(async () => {
      try {
        await enrichFromExternalSources(id, { reason });
      } catch (error) {
        console.error("External enrichment failed", id, error);
      } finally {
        queued.delete(id);
      }
    });
  }
  pump();
}

// Til søgeresultater og lister: én forespørgsel finder de varer (med
// stregkode), der ikke er tjekket for nylig, og kun de lægges i køen.
const recentlySeen = new Map<string, number>();
export function queueStaleExternalEnrichment(productIds: string[], reason: ExternalEnrichmentReason, limit = 20) {
  const now = Date.now();
  const ids = productIds.filter((id) => (recentlySeen.get(id) ?? 0) < now - 3600_000).slice(0, limit);
  if (!ids.length) return;
  for (const id of ids) recentlySeen.set(id, now);
  if (recentlySeen.size > 20_000) recentlySeen.clear();
  const cutoff = new Date(now - RECHECK_HOURS * 3600_000);
  void prisma.product
    .findMany({
      where: {
        id: { in: ids },
        status: { not: "REJECTED" },
        barcodes: { some: { blacklisted: false } },
        OR: [{ sourceCheckedAt: null }, { sourceCheckedAt: { lt: cutoff } }],
      },
      select: { id: true },
    })
    .then((rows) => queueExternalEnrichment(rows.map((row) => row.id), reason))
    .catch((error) => console.error("External enrichment queue failed", error));
}

export function kcalMatches(a: number | null | undefined, b: number | null | undefined): boolean {
  if (!a || !b || a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= KCAL_MATCH_TOLERANCE;
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length);

export async function enrichFromExternalSources(
  productId: string,
  options: { reason: ExternalEnrichmentReason; force?: boolean },
): Promise<{ checked: boolean; filled: string[] }> {
  // Gør krav på varen atomisk, så to samtidige opslag ikke henter dobbelt.
  const cutoff = new Date(Date.now() - RECHECK_HOURS * 3600_000);
  const claim = await prisma.product.updateMany({
    where: {
      id: productId,
      status: { not: "REJECTED" },
      barcodes: { some: { blacklisted: false } },
      ...(options.force ? {} : { OR: [{ sourceCheckedAt: null }, { sourceCheckedAt: { lt: cutoff } }] }),
    },
    data: { sourceCheckedAt: new Date() },
  });
  if (!claim.count) return { checked: false, filled: [] };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      brandId: true,
      imageUrl: true,
      pendingImageUrl: true,
      ingredientsText: true,
      allergens: true,
      additives: true,
      kcalPer100g: true,
      servingSizeGrams: true,
      saturatedFatPer100g: true,
      unsaturatedFatPer100g: true,
      transFatPer100g: true,
      cholesterolPer100g: true,
      vitaminAPer100g: true,
      vitaminCPer100g: true,
      micronutrientsPer100g: true,
      nutrientSources: true,
      nutritionExtra: true,
      packageSizeText: true,
      language: true,
      barcodes: { where: { blacklisted: false }, select: { code: true } },
    },
  });
  if (!product) return { checked: false, filled: [] };

  const filled: string[] = [];
  try {
    for (const { code } of product.barcodes) {
      if (!/^\d{6,14}$/.test(code)) continue;
      const record = await offRecordFor(code);
      if (!record) continue;
      filled.push(...(await mergeOffRecord(product, code, record)));
      break;
    }
  } catch (error) {
    await debugLog({
      category: "scan",
      event: "external_enrichment",
      level: "warn",
      message: `Eksterne kilder kunne ikke flettes ind: ${errorText(error)}`,
      productId,
      data: { reason: options.reason },
    });
    return { checked: true, filled };
  }
  if (filled.length) {
    await debugLog({
      category: "scan",
      event: "external_enrichment",
      level: "info",
      message: `Open Food Facts flettet ind (${options.reason}): ${filled.join(", ")}`,
      productId,
      data: { reason: options.reason, filled },
    });
  }
  return { checked: true, filled };
}

type CachedOff = { raw: Record<string, unknown>; brand: string | null; brandKnown: boolean; saved: SavedOffRecord | null; productId: string | null };

async function offRecordFor(barcode: string): Promise<CachedOff | null> {
  const select = { raw: true, brand: true, brandKnown: true, fetchedAt: true, productId: true } as const;
  let row = await prisma.offProductRecord.findUnique({ where: { barcode }, select });
  let saved: SavedOffRecord | null = null;
  const stale = !row || row.fetchedAt.getTime() < Date.now() - OFF_REFETCH_DAYS * 86400_000;
  if (stale) {
    const raw = await fetchOffProductRaw(barcode).catch(() => null);
    if (raw) {
      saved = await saveOffRecordSafely({ barcode, raw, source: "SCAN" });
      if (saved) row = await prisma.offProductRecord.findUnique({ where: { barcode }, select });
    }
  }
  if (!row) return null;
  return { raw: row.raw as Record<string, unknown>, brand: row.brand, brandKnown: row.brandKnown, saved, productId: row.productId };
}

type ProductForMerge = {
  id: string;
  brandId: string | null;
  imageUrl: string | null;
  pendingImageUrl: string | null;
  ingredientsText: string | null;
  allergens: string[];
  additives: string[];
  kcalPer100g: number;
  servingSizeGrams: number | null;
  saturatedFatPer100g: number | null;
  unsaturatedFatPer100g: number | null;
  transFatPer100g: number | null;
  cholesterolPer100g: number | null;
  vitaminAPer100g: number | null;
  vitaminCPer100g: number | null;
  micronutrientsPer100g: unknown;
  nutrientSources: unknown;
  nutritionExtra: unknown;
  packageSizeText: string | null;
  language: string | null;
};

async function mergeOffRecord(product: ProductForMerge, barcode: string, record: CachedOff): Promise<string[]> {
  // Posten hører allerede til en anden vare (samme stregkode flyttet) → rør den ikke.
  if (record.productId && record.productId !== product.id) return [];
  const off = mapOffRawProduct(record.raw, barcode);
  if (!off) return [];
  const filled: string[] = [];
  const data: Record<string, unknown> = {};

  // Brand: kun et brand, Brand-tabellen allerede kender (OFF's brand-felt kan
  // være producentens firmanavn — aldrig oprettet ud fra OFF alene).
  if (!product.brandId && record.brand && record.brandKnown) {
    const brand = await prisma.brand.findFirst({ where: { name: { equals: record.brand, mode: "insensitive" } }, select: { id: true } });
    if (brand) {
      data.brandId = brand.id;
      filled.push("brand");
    }
  }

  // Ingredienser kun på varens eget sprog (kolonnerne er altid originalen).
  const offLang = off.needsTranslation ? languageCode(off.sourceLang) : "da";
  if (isEmpty(product.ingredientsText) && off.ingredientsText && (!product.language || product.language === offLang)) {
    data.ingredientsText = off.ingredientsText;
    filled.push("ingredienser");
  }
  if (isEmpty(product.allergens) && off.allergens.length) {
    data.allergens = off.allergens;
    filled.push("allergener");
  }
  if (isEmpty(product.additives) && off.additives.length) {
    data.additives = off.additives;
    filled.push("tilsætningsstoffer");
  }
  if (isEmpty(product.packageSizeText) && off.packageSizeText) {
    data.packageSizeText = off.packageSizeText;
    filled.push("mængde");
  }

  // Næringstal: kun når OFF's energi passer med varens egen (samme opskrift).
  const sameRecipe = kcalMatches(product.kcalPer100g, off.kcalPer100g);
  if (sameRecipe) {
    const extended = [
      ["saturatedFatPer100g", off.saturatedFatPer100g],
      ["unsaturatedFatPer100g", off.unsaturatedFatPer100g],
      ["transFatPer100g", off.transFatPer100g],
      ["cholesterolPer100g", off.cholesterolPer100g],
      ["vitaminAPer100g", off.vitaminAPer100g],
      ["vitaminCPer100g", off.vitaminCPer100g],
    ] as const;
    for (const [key, value] of extended) {
      if (product[key] === null && value !== null) {
        data[key] = value;
        filled.push(key);
      }
    }
    if (product.servingSizeGrams === null && off.servingSizeGrams) {
      data.servingSizeGrams = off.servingSizeGrams;
      if (off.servingIsSlice) {
        data.servingSizeUnitSingular = "skive";
        data.servingSizeUnitPlural = "skiver";
      }
      filled.push("portion");
    }
    const extra = (product.nutritionExtra && typeof product.nutritionExtra === "object" ? product.nutritionExtra : {}) as Record<string, unknown>;
    const extraAdd = Object.fromEntries(Object.entries(off.nutritionExtraPer100 ?? {}).filter(([key, value]) => value != null && extra[key] == null));
    if (Object.keys(extraAdd).length) {
      data.nutritionExtra = { ...extra, ...extraAdd };
      filled.push(...Object.keys(extraAdd));
    }
    const micros = ((record.saved ?? (await offRecordFromStored(barcode)))?.nutrition?.micronutrients ?? {}) as Record<string, number>;
    const current = (product.micronutrientsPer100g && typeof product.micronutrientsPer100g === "object" ? product.micronutrientsPer100g : {}) as Record<string, number>;
    const microAdd = Object.fromEntries(Object.entries(micros).filter(([key]) => current[key] == null));
    if (Object.keys(microAdd).length) {
      const sources = (product.nutrientSources && typeof product.nutrientSources === "object" ? product.nutrientSources : {}) as Record<string, string>;
      data.micronutrientsPer100g = { ...current, ...microAdd };
      data.nutrientSources = { ...sources, ...Object.fromEntries(Object.keys(microAdd).map((key) => [key, "LABEL"])) };
      filled.push("mikronæringsstoffer");
    }
  }

  if (Object.keys(data).length) await prisma.product.update({ where: { id: product.id }, data });

  // Filtre, butikker og næringsfelter: filtrene udfyldes kun, hvor varen ikke
  // selv har en værdi.
  const saved = record.saved ?? (await offRecordFromStored(barcode));
  if (saved) {
    const existing = await prisma.productFilters.findUnique({ where: { productId: product.id } });
    const mergedFilters = existing
      ? Object.fromEntries(
          Object.entries(saved.filters).map(([key, value]) => {
            const own = (existing as Record<string, unknown>)[key];
            return [key, isEmpty(own) || own === false ? value : own];
          }),
        )
      : saved.filters;
    const nutrition = sameRecipe ? saved.nutrition : null;
    await applyOffRecordToProduct(product.id, barcode, { ...saved, filters: mergedFilters as SavedOffRecord["filters"], nutrition });
  } else {
    await prisma.offProductRecord.updateMany({ where: { barcode, productId: null }, data: { productId: product.id } });
  }
  if (off.certificationLabels.length) await addCertificationFilters(product.id, off.certificationLabels).catch(() => []);

  // Billede: mangler varen både billede og et billede på vej, hentes OFF's
  // forsidebillede ind via den sædvanlige fritlægning.
  if (!product.imageUrl && !product.pendingImageUrl && off.imageUrl) {
    const waiting = await prisma.imageCutoutJob.count({ where: { productId: product.id, status: "PENDING" } }).catch(() => 1);
    if (!waiting) {
      await createExternalImageCutoutJob(product.id, off.imageUrl);
      filled.push("billede");
    }
  }

  if (filled.length) await syncProductNutritionFeaturesSafely(product.id);
  return filled;
}

// Robot "external-sources-sweep": varer med stregkode, der aldrig er tjekket.
// Køres én ad gangen (OFF's grænse), nyeste først.
export async function sweepExternalSources(): Promise<string | null> {
  const rows = await prisma.product.findMany({
    where: { sourceCheckedAt: null, status: { not: "REJECTED" }, barcodes: { some: { blacklisted: false } } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true },
  });
  let filled = 0;
  for (const row of rows) {
    const result = await enrichFromExternalSources(row.id, { reason: "sweep" }).catch(() => null);
    if (result?.filled.length) filled += 1;
  }
  return rows.length ? `${rows.length} varer tjekket, ${filled} fik data fra Open Food Facts` : null;
}
