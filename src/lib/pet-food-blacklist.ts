import barcodeData from "@/data/pet-food-barcodes.json";
import patternData from "@/data/pet-food-patterns.json";
import { prisma } from "@/lib/prisma";

// Dyrefoder-filteret (docs/PET-FOOD-FILTER.md, docs/DECISIONS.md 2026-10-07): brugere må ikke kunne
// uploade dyrefoder som madvarer. Tre lag:
//  1. Stregkodeliste: stregkoder scrapet fra dyrefoder hos danske og tyske butikker.
//  2. Ordmønstre: "stærke" ord (ét træf blokerer), dyrefodermærker (hele ord) og "svage" ord
//     (kræver flere forskellige træf) fra analysen af de scrapede produkttekster.
//  3. Admin-rettelser: admin kan under Indstillinger → Dyrefoder-filter tilføje, slå fra og
//     gendanne ord/mærker/stregkoder og ændre antal svage træf. Rettelserne ligger i
//     `pet_food_filter_edits` og lægges oven på standardlisterne i src/data/pet-food-*.json.
// Standardlisterne ændres ved at genscrape og committe filerne; admin-rettelserne gælder med det samme
// (cachen opdateres højst 60 sekunder senere).

// Beskederne ligger i pet-food-messages.ts (også brugt af klientkomponenter).
export { PET_FOOD_BLOCKED_MESSAGE } from "@/lib/pet-food-messages";

export type FilterList = "strong" | "weak" | "brand" | "barcode";
export type FilterEditRow = { list: string; value: string; action: string };

type PatternData = { strong: string[]; brands: string[]; weak: string[]; minWeakHits: number };
const patterns = patternData as PatternData;

// Stregkoder sammenlignes uden foranstillede nuller, så EAN-13, UPC-A og
// GTIN-14 af samme vare matcher hinanden.
export function normaliseBarcode(code: string): string {
  return code.replace(/\D/g, "").replace(/^0+/, "");
}

export const BASELINE = {
  strong: patterns.strong.map((term) => term.toLowerCase()),
  weak: patterns.weak.map((term) => term.toLowerCase()),
  brands: (patterns.brands ?? []).map((term) => term.toLowerCase()),
  minWeakHits: patterns.minWeakHits,
  barcodes: new Set<string>((barcodeData as string[]).map(normaliseBarcode).filter(Boolean)),
};

export type EffectiveFilter = {
  strong: string[];
  weak: string[];
  brands: string[];
  minWeakHits: number;
  /** Stregkoder lagt til af admin. */
  extraBarcodes: Set<string>;
  /** Standard-stregkoder slået fra af admin (frikendt som menneskemad). */
  removedBarcodes: Set<string>;
};

export const SETTING_MIN_WEAK = "minWeakHits=";

// Standardlisterne + admin-rettelser (ren funktion, bruges også af admin-siden og testen).
export function buildFilter(edits: FilterEditRow[]): EffectiveFilter {
  const removed = (list: FilterList) =>
    new Set(edits.filter((e) => e.list === list && e.action === "REMOVE").map((e) => e.value));
  const added = (list: FilterList) =>
    edits.filter((e) => e.list === list && e.action === "ADD").map((e) => e.value);
  const merge = (base: string[], list: FilterList) => {
    const gone = removed(list);
    return [...base.filter((term) => !gone.has(term)), ...added(list).filter((term) => !base.includes(term))];
  };
  const setting = edits.find((e) => e.list === "setting" && e.value.startsWith(SETTING_MIN_WEAK));
  const minWeak = setting ? Number(setting.value.slice(SETTING_MIN_WEAK.length)) : NaN;
  return {
    strong: merge(BASELINE.strong, "strong"),
    weak: merge(BASELINE.weak, "weak"),
    brands: merge(BASELINE.brands, "brand"),
    minWeakHits: Number.isFinite(minWeak) && minWeak >= 1 ? minWeak : BASELINE.minWeakHits,
    extraBarcodes: new Set(added("barcode").map(normaliseBarcode)),
    removedBarcodes: new Set([...removed("barcode")].map(normaliseBarcode)),
  };
}

export function isBarcodeBlocked(filter: EffectiveFilter, code: string | null | undefined): boolean {
  if (!code) return false;
  const normalised = normaliseBarcode(code);
  if (normalised.length < 6 || filter.removedBarcodes.has(normalised)) return false;
  return BASELINE.barcodes.has(normalised) || filter.extraBarcodes.has(normalised);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function includesWholeWord(text: string, term: string): boolean {
  const pattern = new RegExp("(^|[^a-zæøåäöü0-9])" + escapeRegExp(term) + "([^a-zæøåäöü0-9]|$)");
  return pattern.test(text);
}

function includesWord(text: string, term: string): boolean {
  // Korte svage ord ("hund", "kat") må kun matche som helt ord, ikke inde i
  // fx "hundrede" eller "katalog".
  if (term.length > 5) return text.includes(term);
  return includesWholeWord(text, term);
}

export type TextMatch = { list: "strong" | "brand" | "weak"; match: string };

// Felterne sættes sammen med " | ", så et udtryk aldrig kan ramme på tværs af to felter.
export function matchText(filter: EffectiveFilter, texts: Array<string | null | undefined>): TextMatch | null {
  const text = texts
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" | ")
    .toLowerCase();
  if (!text) return null;

  for (const term of filter.strong) {
    if (text.includes(term)) return { list: "strong", match: term };
  }
  for (const brand of filter.brands) {
    if (includesWholeWord(text, brand)) return { list: "brand", match: brand };
  }
  const weakHits = filter.weak.filter((term) => includesWord(text, term));
  if (weakHits.length >= filter.minWeakHits) return { list: "weak", match: weakHits.join(", ") };
  return null;
}

// --- Cache af det effektive filter (admin-rettelser læses fra databasen) -----------------------

const CACHE_MS = 60_000;
let cache: { at: number; filter: EffectiveFilter } | null = null;

export function invalidatePetFoodFilterCache() {
  cache = null;
}

export async function loadPetFoodFilter(): Promise<EffectiveFilter> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.filter;
  let filter: EffectiveFilter;
  try {
    const edits = await prisma.petFoodFilterEdit.findMany({ select: { list: true, value: true, action: true } });
    filter = buildFilter(edits);
  } catch (error) {
    // Uden database (eller ved fejl) gælder standardlisterne — spærringen må aldrig falde væk.
    console.error("Pet food filter edits could not be read, using the defaults", error);
    filter = buildFilter([]);
  }
  cache = { at: Date.now(), filter };
  return filter;
}

export async function isBlacklistedPetFoodBarcode(code: string | null | undefined): Promise<boolean> {
  if (!code) return false;
  return isBarcodeBlocked(await loadPetFoodFilter(), code);
}

/** Returnerer det mønster, der udløste spærringen, eller null. */
export async function petFoodTextMatch(...texts: Array<string | null | undefined>): Promise<string | null> {
  const hit = matchText(await loadPetFoodFilter(), texts);
  return hit ? hit.match : null;
}

export async function petFoodBlockReason(input: {
  barcode?: string | null;
  texts?: Array<string | null | undefined>;
}): Promise<{ reason: "barcode" | "text"; match: string } | null> {
  const filter = await loadPetFoodFilter();
  if (isBarcodeBlocked(filter, input.barcode)) {
    return { reason: "barcode", match: normaliseBarcode(input.barcode ?? "") };
  }
  const hit = matchText(filter, input.texts ?? []);
  return hit ? { reason: "text", match: hit.match } : null;
}
