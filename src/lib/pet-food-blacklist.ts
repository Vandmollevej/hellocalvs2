import barcodeData from "@/data/pet-food-barcodes.json";
import patternData from "@/data/pet-food-patterns.json";

// Dyrefoder-spærring (brugerens ønske 2026-10-06): brugere må ikke kunne
// uploade dyrefoder som madvarer. To lag:
//  1. Stregkode-spærreliste: alle stregkoder scrapet fra dyrefoder hos Bilka,
//     Nemlig, Maxi Zoo, Zooplus og SPAR (Produklter/Blacklistede produkter).
//  2. Ordmønstre fra Fable-analysen af de scrapede produkttekster — fanger
//     nye dyrefoderprodukter, der ikke er på stregkodelisten.

export const PET_FOOD_BLOCKED_MESSAGE =
  "Dyrefoder kan ikke oprettes i Hello Cal. Hello Cal er kun til mad og drikke til mennesker.";

// Stregkoder sammenlignes uden foranstillede nuller, så EAN-13, UPC-A og
// GTIN-14 af samme vare matcher hinanden.
function normaliseBarcode(code: string): string {
  return code.replace(/\D/g, "").replace(/^0+/, "");
}

const blacklistedBarcodes = new Set<string>(
  (barcodeData as string[]).map(normaliseBarcode).filter(Boolean),
);

type PatternData = { strong: string[]; brands: string[]; weak: string[]; minWeakHits: number };
const patterns = patternData as PatternData;
const strongTerms = patterns.strong.map((term) => term.toLowerCase());
const weakTerms = patterns.weak.map((term) => term.toLowerCase());
// Dyrefoder-mærker (Royal Canin, Whiskas, Rocco ...) matches kun som hele ord,
// så "brit" ikke rammer "britisk" og "pro plan" ikke rammer "alpro plant".
const brandTerms = (patterns.brands ?? []).map((term) => term.toLowerCase());

export function isBlacklistedPetFoodBarcode(code: string | null | undefined): boolean {
  if (!code) return false;
  const normalised = normaliseBarcode(code);
  return normalised.length >= 6 && blacklistedBarcodes.has(normalised);
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

/** Returnerer det mønster, der udløste spærringen, eller null. */
export function petFoodTextMatch(...texts: Array<string | null | undefined>): string | null {
  const text = texts
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" | ")
    .toLowerCase();
  if (!text) return null;

  for (const term of strongTerms) {
    if (text.includes(term)) return term;
  }

  for (const brand of brandTerms) {
    if (includesWholeWord(text, brand)) return brand;
  }

  const weakHits = weakTerms.filter((term) => includesWord(text, term));
  if (weakHits.length >= patterns.minWeakHits) return weakHits.join(", ");
  return null;
}

export function petFoodBlockReason(input: {
  barcode?: string | null;
  texts?: Array<string | null | undefined>;
}): { reason: "barcode" | "text"; match: string } | null {
  if (isBlacklistedPetFoodBarcode(input.barcode)) {
    return { reason: "barcode", match: normaliseBarcode(input.barcode ?? "") };
  }
  const match = petFoodTextMatch(...(input.texts ?? []));
  return match ? { reason: "text", match } : null;
}
