import type { AiAnalysisKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions, type AnalysisRegions } from "@/lib/ai-regions";
import { UNCERTAINTY_TARGET, URGENT_BELOW } from "@/lib/uncertainty-thresholds";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24/25) — erstatter
// "Advarsler". To datakilder:
// - AiProductAnalysis (AI'ens aflæsning af forside/næring/ingredienser/EAN,
//   confidence 0–1) → fanerne Produkt, Energi, Indhold, EAN.
// - ProductMatchCheck (den lokale billedrobots match mellem et foto og
//   forsidefotoet, confidence 0–100) → fanen Billeder.
// En række er åben, indtil en admin har gennemgået den (reviewedAt/REVIEWED),
// og kun når sikkerheden er under målet.

export { UNCERTAINTY_TARGET };

export const UNCERTAINTY_TABS = [
  { key: "product", label: "Produkt" },
  { key: "energy", label: "Energi" },
  { key: "content", label: "Indhold" },
  { key: "ean", label: "EAN" },
  { key: "images", label: "Billeder" },
] as const;

export type UncertaintyTabKey = (typeof UNCERTAINTY_TABS)[number]["key"];

const TAB_BY_KIND: Record<AiAnalysisKind, UncertaintyTabKey> = {
  FRONT: "product",
  NUTRITION: "energy",
  INGREDIENTS: "content",
  BARCODE: "ean",
};

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
  images: [],
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
  id: string;
  source: "analysis" | "matchCheck";
  tab: UncertaintyTabKey;
  productId: string;
  productName: string;
  brandName: string | null;
  thumbnailUrl: string | null;
  photoUrl: string | null;
  // Billeder-fanen: forsidefotoet, som photoUrl er sammenlignet med.
  comparePhotoUrl: string | null;
  photoTypeLabel: string | null;
  productCreatedAt: string;
  uncertaintyPercent: number;
  urgent: boolean;
  regions: AnalysisRegions;
  // Nuværende værdier på produktet (det admin retter i) og AI'ens forslag.
  values: Record<string, string>;
  aiValues: Record<string, string>;
};

// Sikkerhed 0–1 for en AI-analyse, eller null når den ikke hører hjemme på
// listen (sikker nok eller uden confidence).
export function analysisConfidence(kind: AiAnalysisKind, confidence: number | null, prediction: unknown): number | null {
  if (kind === "BARCODE") {
    const barcode = String((prediction as { barcode?: unknown } | null)?.barcode ?? "");
    if (barcode && !isValidGtin(barcode)) return 0;
  }
  if (confidence === null || confidence >= UNCERTAINTY_TARGET) return null;
  return Math.min(1, Math.max(0, confidence));
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

const PHOTO_TYPE_LABEL: Record<AiAnalysisKind, string> = {
  FRONT: "Forside",
  NUTRITION: "Næringsdeklaration",
  INGREDIENTS: "Ingrediensliste",
  BARCODE: "Stregkode",
};

async function analysisRows(): Promise<UncertaintyRow[]> {
  const analyses = await prisma.aiProductAnalysis.findMany({
    where: { productId: { not: null }, reviewedAt: null },
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
    const confidence = analysisConfidence(analysis.kind, analysis.confidence, analysis.prediction);
    if (confidence === null) continue;
    const tab = TAB_BY_KIND[analysis.kind];
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
      images: {},
    };
    rows.push({
      id: analysis.id,
      source: "analysis",
      tab,
      productId: product.id,
      productName: product.name,
      brandName: product.brand?.name ?? null,
      thumbnailUrl: product.imageUrl,
      // Forsideanalysen har intet eget foto — forsidefotoet er produktets billede.
      photoUrl: analysis.kind === "FRONT" ? product.imageUrl : analysis.imageUrl,
      comparePhotoUrl: null,
      photoTypeLabel: PHOTO_TYPE_LABEL[analysis.kind],
      productCreatedAt: product.createdAt.toISOString(),
      uncertaintyPercent: Math.round((1 - confidence) * 100),
      urgent: confidence < URGENT_BELOW,
      regions: readRegions(analysis.regions),
      values: current[tab],
      aiValues: Object.fromEntries(UNCERTAINTY_FIELDS[tab].map((f) => [f.key, str(prediction[f.key])])),
    });
  }
  return rows;
}

async function matchCheckRows(): Promise<UncertaintyRow[]> {
  const checks = await prisma.productMatchCheck.findMany({
    where: { status: "PENDING", confidence: { lt: UNCERTAINTY_TARGET * 100 } },
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: {
      product: { include: { brand: { select: { name: true } } } },
      analysis: { select: { imageUrl: true } },
    },
  });
  return checks.map((check) => {
    const confidence = Math.min(1, Math.max(0, (check.confidence ?? 0) / 100));
    return {
      id: check.id,
      source: "matchCheck" as const,
      tab: "images" as const,
      productId: check.product.id,
      productName: check.product.name,
      brandName: check.product.brand?.name ?? null,
      thumbnailUrl: check.product.imageUrl,
      photoUrl: check.analysis.imageUrl,
      comparePhotoUrl: check.product.imageUrl,
      photoTypeLabel: PHOTO_TYPE_LABEL[check.photoType],
      productCreatedAt: check.product.createdAt.toISOString(),
      uncertaintyPercent: Math.round((1 - confidence) * 100),
      urgent: confidence < URGENT_BELOW,
      regions: { ocrRegion: null, uncertainRegions: [] },
      values: {},
      aiValues: {},
    };
  });
}

export async function listUncertainties(): Promise<UncertaintyRow[]> {
  const [analyses, matchChecks] = await Promise.all([analysisRows(), matchCheckRows()]);
  return [...analyses, ...matchChecks];
}

// Rød prik ved "Uncertainties" i admin-menuen.
export async function hasOpenUncertainties(): Promise<boolean> {
  const [analyses, matchCheck] = await Promise.all([
    prisma.aiProductAnalysis.findMany({
      where: {
        productId: { not: null },
        reviewedAt: null,
        OR: [{ confidence: { lt: UNCERTAINTY_TARGET } }, { kind: "BARCODE" }],
      },
      select: { kind: true, confidence: true, prediction: true },
      take: 500,
    }),
    prisma.productMatchCheck.findFirst({
      where: { status: "PENDING", confidence: { lt: UNCERTAINTY_TARGET * 100 } },
      select: { id: true },
    }),
  ]);
  return Boolean(matchCheck) || analyses.some((a) => analysisConfidence(a.kind, a.confidence, a.prediction) !== null);
}
