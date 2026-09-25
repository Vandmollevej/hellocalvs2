import type { AiAnalysisKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions, type AnalysisRegions } from "@/lib/ai-regions";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24) — erstatter
// "Advarsler". Datakilden er AI'ens egne analyser (AiProductAnalysis), som
// allerede har én confidence pr. foto-type og selve fotoet — de fire faner
// svarer 1:1 til de fire foto-typer. En analyse er "åben", indtil en admin
// har gemt en rettelse (correctedAt), og kun når AI'en var under målet.

export const UNCERTAINTY_TARGET = 0.9; // vejledende mål, blokerer aldrig et produkt

export const UNCERTAINTY_TABS = [
  { key: "product", kind: "FRONT", label: "Produkt" },
  { key: "energy", kind: "NUTRITION", label: "Energi" },
  { key: "content", kind: "INGREDIENTS", label: "Indhold" },
  { key: "ean", kind: "BARCODE", label: "EAN" },
] as const satisfies readonly { key: string; kind: AiAnalysisKind; label: string }[];

export type UncertaintyTabKey = (typeof UNCERTAINTY_TABS)[number]["key"];

// Redigerbare felter pr. fane. `key` er AI-feltets navn, så AI'ens
// uncertainRegions[].field kan kobles til det rigtige input (rød ramme).
export const UNCERTAINTY_FIELDS: Record<UncertaintyTabKey, { key: string; label: string; kind: "text" | "number" | "textarea" }[]> = {
  product: [
    { key: "productName", label: "Produktnavn", kind: "text" },
    { key: "subbrand", label: "Produktserie", kind: "text" },
    { key: "variant", label: "Variant", kind: "text" },
    { key: "packageSizeText", label: "Pakningsstørrelse", kind: "text" },
  ],
  energy: [
    { key: "kcalPer100g", label: "Energi (kcal)", kind: "number" },
    { key: "fatPer100g", label: "Fedt (g)", kind: "number" },
    { key: "saturatedFatPer100g", label: "heraf mættet (g)", kind: "number" },
    { key: "carbsPer100g", label: "Kulhydrat (g)", kind: "number" },
    { key: "sugarsPer100g", label: "heraf sukkerarter (g)", kind: "number" },
    { key: "fiberPer100g", label: "Kostfibre (g)", kind: "number" },
    { key: "proteinPer100g", label: "Protein (g)", kind: "number" },
    { key: "saltPer100g", label: "Salt (g)", kind: "number" },
  ],
  content: [{ key: "ingredientsText", label: "Ingrediensliste", kind: "textarea" }],
  ean: [{ key: "barcode", label: "EAN", kind: "text" }],
};

// GS1-kontrolciffer (EAN-8/UPC-A/EAN-13/GTIN-14). En stregkode med forkert
// kontrolciffer er med sikkerhed fejllæst → 100 % usikkerhed.
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export type UncertaintyRow = {
  analysisId: string;
  tab: UncertaintyTabKey;
  productId: string;
  productName: string;
  brandName: string | null;
  thumbnailUrl: string | null;
  photoUrl: string | null;
  productCreatedAt: string;
  uncertaintyPercent: number;
  regions: AnalysisRegions;
  // Nuværende værdier på produktet (det admin retter i) og AI'ens forslag.
  values: Record<string, string>;
  aiValues: Record<string, string>;
};

function uncertaintyPercent(kind: AiAnalysisKind, confidence: number | null, prediction: unknown): number | null {
  if (kind === "BARCODE") {
    const barcode = String((prediction as { barcode?: unknown } | null)?.barcode ?? "");
    if (barcode && !isValidGtin(barcode)) return 100;
  }
  if (confidence === null || confidence >= UNCERTAINTY_TARGET) return null;
  return Math.round((1 - Math.min(1, Math.max(0, confidence))) * 100);
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

const OPEN_WHERE = { productId: { not: null }, correctedAt: null } as const;

export async function listUncertainties(): Promise<UncertaintyRow[]> {
  const analyses = await prisma.aiProductAnalysis.findMany({
    where: OPEN_WHERE,
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: {
      product: {
        include: {
          brand: { select: { name: true } },
          barcodes: { select: { code: true } },
          nutritionFeatures: { select: { sugarsPer100g: true, fiberPer100g: true, saltPer100g: true } },
        },
      },
    },
  });

  const rows: UncertaintyRow[] = [];
  for (const analysis of analyses) {
    const product = analysis.product;
    if (!product) continue;
    const percent = uncertaintyPercent(analysis.kind, analysis.confidence, analysis.prediction);
    if (percent === null) continue;
    const tab = UNCERTAINTY_TABS.find((t) => t.kind === analysis.kind)!.key;
    const prediction = (analysis.prediction ?? {}) as Record<string, unknown>;
    const features = product.nutritionFeatures;
    const current: Record<UncertaintyTabKey, Record<string, string>> = {
      product: {
        productName: str(product.productType ?? product.name),
        subbrand: str(product.subbrand),
        variant: str(product.variant),
        packageSizeText: str(product.packageSizeText),
      },
      energy: {
        kcalPer100g: str(product.kcalPer100g),
        fatPer100g: str(product.fatPer100g),
        saturatedFatPer100g: str(product.saturatedFatPer100g),
        carbsPer100g: str(product.carbsPer100g),
        sugarsPer100g: str(features?.sugarsPer100g),
        fiberPer100g: str(features?.fiberPer100g),
        proteinPer100g: str(product.proteinPer100g),
        saltPer100g: str(features?.saltPer100g),
      },
      content: { ingredientsText: str(product.ingredientsText) },
      ean: { barcode: str(analysis.barcode ?? product.barcodes[0]?.code) },
    };
    rows.push({
      analysisId: analysis.id,
      tab,
      productId: product.id,
      productName: product.name,
      brandName: product.brand?.name ?? null,
      thumbnailUrl: product.imageUrl,
      photoUrl: analysis.imageUrl,
      productCreatedAt: product.createdAt.toISOString(),
      uncertaintyPercent: percent,
      regions: readRegions(analysis.regions),
      values: current[tab],
      aiValues: Object.fromEntries(UNCERTAINTY_FIELDS[tab].map((f) => [f.key, str(prediction[f.key])])),
    });
  }
  return rows;
}

// Rød prik ved "Uncertainties" i admin-menuen.
export async function hasOpenUncertainties(): Promise<boolean> {
  const candidates = await prisma.aiProductAnalysis.findMany({
    where: {
      ...OPEN_WHERE,
      OR: [{ confidence: { lt: UNCERTAINTY_TARGET } }, { kind: "BARCODE" }],
    },
    select: { kind: true, confidence: true, prediction: true },
    take: 500,
  });
  return candidates.some((a) => uncertaintyPercent(a.kind, a.confidence, a.prediction) !== null);
}
