import type { AiAnalysisKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions, type AnalysisRegions } from "@/lib/ai-regions";
import { cached, invalidateCache } from "@/lib/ttl-cache";
import { UNCERTAINTY_TARGET, URGENT_BELOW } from "@/lib/uncertainty-thresholds";

// Admin "Uncertainties" (docs/DECISIONS.md 2026-09-24/25) — erstatter
// "Advarsler". To datakilder:
// - AiProductAnalysis (AI'ens aflæsning af forside/næring/ingredienser/EAN,
//   confidence 0–1) → fanerne Produkt, Energi, Indhold, EAN.
// - ProductMatchCheck (den lokale billedrobots match mellem et foto og
//   forsidefotoet, confidence 0–100) → fanen Billeder.
// En række er åben, indtil en admin har gennemgået den (reviewedAt/REVIEWED),
// og kun når sikkerheden er under målet.
//
// Hastighed (docs/DECISIONS.md 2026-10-11): listen er delt i lette
// oversigtsrækker (UncertaintySummary, hentes gradvist og caches 30 s) og
// detaljer til redigerings-lightboxen (getUncertaintyDetail, hentes først
// når man trykker "Rediger").

export { UNCERTAINTY_TARGET };

export const UNCERTAINTY_TABS = [
  { key: "product", label: "Vare" },
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

const KIND_BY_TAB: Partial<Record<UncertaintyTabKey, AiAnalysisKind>> = {
  product: "FRONT",
  energy: "NUTRITION",
  content: "INGREDIENTS",
  ean: "BARCODE",
};

// Redigerbare felter pr. fane. `key` er AI-feltets navn, så AI'ens
// uncertainRegions[].field kan kobles til det rigtige input (rød ramme).
export const UNCERTAINTY_FIELDS: Record<UncertaintyTabKey, { key: string; label: string; kind: "text" | "number" | "textarea" }[]> = {
  product: [
    { key: "productName", label: "Varenavn", kind: "text" },
    { key: "subbrand", label: "Vareserie", kind: "text" },
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

// Fuld række til redigerings-lightboxen.
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

// Let række til selve listen (ingen regioner, værdier eller foto-adresser).
export type UncertaintySummary = Pick<
  UncertaintyRow,
  | "id"
  | "source"
  | "tab"
  | "productId"
  | "productName"
  | "brandName"
  | "thumbnailUrl"
  | "photoTypeLabel"
  | "productCreatedAt"
  | "uncertaintyPercent"
  | "urgent"
>;

export type UncertaintySort = "uncertainty" | "created" | "name";

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

// ---------- Cache ----------

const LIST_CACHE_MS = 30_000;
const DOT_CACHE_MS = 60_000;
// Højst så mange rækker pr. fane (nyeste først), som før.
const SUMMARY_LIMIT = 2000;

export function invalidateUncertaintyCache() {
  invalidateCache("uncertainties:");
}

// ---------- Lette lister ----------

const productSummarySelect = {
  id: true,
  name: true,
  imageUrl: true,
  createdAt: true,
  brand: { select: { name: true } },
} as const;

type SummaryProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  createdAt: Date;
  brand: { name: string } | null;
};

function summaryFor(
  base: { id: string; source: "analysis" | "matchCheck"; tab: UncertaintyTabKey; photoTypeLabel: string | null },
  product: SummaryProduct,
  confidence: number,
): UncertaintySummary {
  return {
    id: base.id,
    source: base.source,
    tab: base.tab,
    productId: product.id,
    productName: product.name,
    brandName: product.brand?.name ?? null,
    thumbnailUrl: product.imageUrl,
    photoTypeLabel: base.photoTypeLabel,
    productCreatedAt: product.createdAt.toISOString(),
    uncertaintyPercent: Math.round((1 - confidence) * 100),
    urgent: confidence < URGENT_BELOW,
  };
}

async function analysisSummaries(tab: UncertaintyTabKey): Promise<UncertaintySummary[]> {
  const kind = KIND_BY_TAB[tab];
  if (!kind) return [];
  // Slettede varer (admin, docs/DECISIONS.md 2026-10-11) står ikke i køen.
  const where = { kind, productId: { not: null }, reviewedAt: null, product: { deletedAt: null } } as const;

  if (kind === "BARCODE") {
    // Stregkoder: den ugyldige kontrolciffer afgøres på selve koden.
    const analyses = await prisma.aiProductAnalysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: SUMMARY_LIMIT,
      select: { id: true, kind: true, confidence: true, prediction: true, product: { select: productSummarySelect } },
    });
    return analyses.flatMap((analysis) => {
      if (!analysis.product) return [];
      const confidence = analysisConfidence(analysis.kind, analysis.confidence, analysis.prediction);
      if (confidence === null) return [];
      return [summaryFor({ id: analysis.id, source: "analysis", tab, photoTypeLabel: PHOTO_TYPE_LABEL[kind] }, analysis.product, confidence)];
    });
  }

  const analyses = await prisma.aiProductAnalysis.findMany({
    where: { ...where, confidence: { lt: UNCERTAINTY_TARGET } },
    orderBy: { createdAt: "desc" },
    take: SUMMARY_LIMIT,
    select: { id: true, confidence: true, product: { select: productSummarySelect } },
  });
  return analyses.flatMap((analysis) => {
    if (!analysis.product || analysis.confidence === null) return [];
    const confidence = Math.min(1, Math.max(0, analysis.confidence));
    return [summaryFor({ id: analysis.id, source: "analysis", tab, photoTypeLabel: PHOTO_TYPE_LABEL[kind] }, analysis.product, confidence)];
  });
}

async function matchCheckSummaries(): Promise<UncertaintySummary[]> {
  const checks = await prisma.productMatchCheck.findMany({
    where: { status: "PENDING", confidence: { lt: UNCERTAINTY_TARGET * 100 }, product: { deletedAt: null } },
    orderBy: { createdAt: "desc" },
    take: SUMMARY_LIMIT,
    select: { id: true, confidence: true, photoType: true, product: { select: productSummarySelect } },
  });
  return checks.map((check) => {
    const confidence = Math.min(1, Math.max(0, (check.confidence ?? 0) / 100));
    return summaryFor(
      { id: check.id, source: "matchCheck", tab: "images", photoTypeLabel: PHOTO_TYPE_LABEL[check.photoType] },
      check.product,
      confidence,
    );
  });
}

// Alle usikre rækker i én fane (usorteret). Caches 30 s; nulstilles ved rettelser.
export function listUncertaintySummaries(tab: UncertaintyTabKey): Promise<UncertaintySummary[]> {
  return cached(`uncertainties:list:${tab}`, LIST_CACHE_MS, () =>
    tab === "images" ? matchCheckSummaries() : analysisSummaries(tab),
  );
}

export async function listAllUncertaintySummaries(): Promise<UncertaintySummary[]> {
  const lists = await Promise.all(UNCERTAINTY_TABS.map((tab) => listUncertaintySummaries(tab.key)));
  return lists.flat();
}

function compareSummaries(sort: UncertaintySort) {
  return (a: UncertaintySummary, b: UncertaintySummary) => {
    // Under 70 % (urgent) står altid øverst, uanset sortering.
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    if (sort === "created") return b.productCreatedAt.localeCompare(a.productCreatedAt);
    if (sort === "name") return a.productName.localeCompare(b.productName, "da");
    return b.uncertaintyPercent - a.uncertaintyPercent;
  };
}

// Ét udsnit af en fane i den valgte sortering.
export async function listUncertaintyPage(tab: UncertaintyTabKey, sort: UncertaintySort, offset: number, limit: number) {
  const all = await listUncertaintySummaries(tab);
  const sorted = [...all].sort(compareSummaries(sort));
  return { total: sorted.length, rows: sorted.slice(offset, offset + limit) };
}

// Tal til fanerne. Almindelige tællinger i stedet for hele listerne (EAN må
// dog afgøres på selve koderne).
export function countUncertaintiesByTab(): Promise<Record<UncertaintyTabKey, number>> {
  return cached("uncertainties:counts", LIST_CACHE_MS, async () => {
    const countAnalyses = (kind: AiAnalysisKind) =>
      prisma.aiProductAnalysis
        .count({
          where: { kind, productId: { not: null }, reviewedAt: null, confidence: { lt: UNCERTAINTY_TARGET } },
        })
        .then((n) => Math.min(n, SUMMARY_LIMIT));
    const [product, energy, content, ean, images] = await Promise.all([
      countAnalyses("FRONT"),
      countAnalyses("NUTRITION"),
      countAnalyses("INGREDIENTS"),
      listUncertaintySummaries("ean").then((rows) => rows.length),
      prisma.productMatchCheck
        .count({ where: { status: "PENDING", confidence: { lt: UNCERTAINTY_TARGET * 100 } } })
        .then((n) => Math.min(n, SUMMARY_LIMIT)),
    ]);
    return { product, energy, content, ean, images };
  });
}

// ---------- Detaljer til redigerings-lightboxen ----------

export async function getUncertaintyDetail(
  id: string,
  source: "analysis" | "matchCheck",
): Promise<UncertaintyRow | null> {
  if (source === "matchCheck") {
    const check = await prisma.productMatchCheck.findUnique({
      where: { id },
      include: {
        product: { include: { brand: { select: { name: true } } } },
        analysis: { select: { imageUrl: true } },
      },
    });
    if (!check) return null;
    const confidence = Math.min(1, Math.max(0, (check.confidence ?? 0) / 100));
    return {
      id: check.id,
      source: "matchCheck",
      tab: "images",
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
  }

  const analysis = await prisma.aiProductAnalysis.findUnique({
    where: { id },
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
  const product = analysis?.product;
  if (!analysis || !product) return null;

  const confidence =
    analysisConfidence(analysis.kind, analysis.confidence, analysis.prediction) ??
    Math.min(1, Math.max(0, analysis.confidence ?? 1));
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
  return {
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
  };
}

// Rød prik ved "Uncertainties" i admin-menuen. Caches 60 s (kaldes ved hver
// fuld indlæsning af admin).
export function hasOpenUncertainties(): Promise<boolean> {
  return cached("uncertainties:dot", DOT_CACHE_MS, async () => {
    const energyFlag = await prisma.productEnergySplitFlag.findFirst({ where: { reviewedAt: null }, select: { id: true } });
    if (energyFlag) return true;
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
  });
}
