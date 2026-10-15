import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FRONT_CROPPED_CATEGORY } from "@/lib/front-image-check";
import { assessOffProduct, type OffQualityAssessment, type OffQualityInput } from "@/lib/off-quality";
import { hasProperCutout } from "@/lib/product-rescan-offer";

// Natlig robot "off-quality" (job-nøgle "off-quality", docs/DECISIONS.md
// 2026-10-11): vurderer alle Open Food Facts-varer efter reglerne i
// src/lib/off-quality.ts og gemmer resultatet i product_quality_reviews, så
// admin → Scan-invites → "Open Food Facts-kontrol" kan filtrere og sortere i
// databasen. Rækkens "send til scan-appen"-felter røres aldrig her.

// Samme afgrænsning som listen i admin: ikke afviste, ikke udgåede, ikke private.
export const OFF_REVIEW_WHERE = {
  externalSource: "OPEN_FOOD_FACTS",
  privateOwnerId: null,
  discontinued: false,
  status: { not: "REJECTED" },
} satisfies Prisma.ProductWhereInput;

const PRODUCT_SELECT = {
  id: true,
  name: true,
  imageUrl: true,
  kcalPer100g: true,
  proteinPer100g: true,
  carbsPer100g: true,
  fatPer100g: true,
  saturatedFatPer100g: true,
  nutritionExtra: true,
  ingredientsText: true,
  allergens: true,
  packageSizeText: true,
  productType: true,
  productCategory: true,
  nameOriginal: true,
  translationSourceLang: true,
  translationStatus: true,
  brand: { select: { name: true } },
  barcodes: { select: { code: true } },
  images: { select: { url: true, tags: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

const BATCH = 500;

function extraNumber(extra: Prisma.JsonValue, key: string): number | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const value = (extra as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toInput(row: ProductRow): OffQualityInput {
  return {
    name: row.name,
    brandName: row.brand?.name ?? null,
    imageUrl: row.imageUrl,
    hasCutout: hasProperCutout({ imageUrl: row.imageUrl, images: row.images }),
    kcalPer100g: row.kcalPer100g,
    proteinPer100g: row.proteinPer100g,
    carbsPer100g: row.carbsPer100g,
    fatPer100g: row.fatPer100g,
    saturatedFatPer100g: row.saturatedFatPer100g,
    sugarPer100g: extraNumber(row.nutritionExtra, "sugarPer100g"),
    saltPer100g: extraNumber(row.nutritionExtra, "saltPer100g"),
    ingredientsText: row.ingredientsText,
    allergens: row.allergens,
    packageSizeText: row.packageSizeText,
    productType: row.productType,
    productCategory: row.productCategory,
    barcodes: row.barcodes.map((barcode) => barcode.code),
    nameOriginal: row.nameOriginal,
    translationSourceLang: row.translationSourceLang,
    translationStatus: row.translationStatus,
  };
}

// JSONB gemmer nøgler i en anden rækkefølge end vi skriver dem, så fund
// sammenlignes på indholdet, ikke på JSON-teksten.
function findingsSignature(findings: unknown): string {
  if (!Array.isArray(findings)) return "";
  return findings
    .map((f) => {
      const item = f as { code?: unknown; severity?: unknown; comment?: unknown };
      return `${String(item.code)}|${String(item.severity)}|${String(item.comment)}`;
    })
    .join("\n");
}

function reviewData(assessment: OffQualityAssessment) {
  return {
    score: assessment.score,
    rating: assessment.rating,
    categories: assessment.categories,
    findings: assessment.findings as unknown as Prisma.InputJsonValue,
  };
}

export async function assessOffProducts(): Promise<string> {
  const existing = await prisma.productQualityReview.findMany({
    select: { productId: true, score: true, rating: true, findings: true, categories: true, scanRequestedAt: true, scanDoneAt: true },
  });
  const existingById = new Map(existing.map((row) => [row.productId, row]));
  const seen = new Set<string>();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let cursor: string | undefined;

  for (;;) {
    const rows = await prisma.product.findMany({
      where: OFF_REVIEW_WHERE,
      select: PRODUCT_SELECT,
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    const toCreate: (ReturnType<typeof reviewData> & { productId: string })[] = [];
    for (const row of rows) {
      seen.add(row.id);
      const assessment = assessOffProduct(toInput(row));
      const prev = existingById.get(row.id);
      if (!prev) {
        toCreate.push({ productId: row.id, ...reviewData(assessment) });
      } else if (
        prev.score !== assessment.score ||
        prev.rating !== assessment.rating ||
        findingsSignature(prev.findings) !== findingsSignature(assessment.findings)
      ) {
        await prisma.productQualityReview.update({
          where: { productId: row.id },
          data: { ...reviewData(assessment), assessedAt: new Date() },
        });
        updated += 1;
      } else {
        unchanged += 1;
      }
    }
    if (toCreate.length) {
      await prisma.productQualityReview.createMany({ data: toCreate, skipDuplicates: true });
      created += toCreate.length;
    }
    if (rows.length < BATCH) break;
  }

  // Varer der ikke længere er Open Food Facts-varer på listen (overtaget som
  // egne, afvist, udgået): en åben "send til scan-appen" lukkes, resten slettes.
  // Beskårne forsidebilleder (front-image-check) er ikke Open Food Facts-sager og røres ikke.
  const stale = existing.filter((row) => !seen.has(row.productId) && !row.categories.includes(FRONT_CROPPED_CATEGORY));
  const staleOpen = stale.filter((row) => row.scanRequestedAt && !row.scanDoneAt).map((row) => row.productId);
  const staleClosed = stale.filter((row) => !(row.scanRequestedAt && !row.scanDoneAt)).map((row) => row.productId);
  if (staleOpen.length) {
    await prisma.productQualityReview.updateMany({
      where: { productId: { in: staleOpen } },
      data: { scanDoneAt: new Date() },
    });
  }
  if (staleClosed.length) {
    await prisma.productQualityReview.deleteMany({ where: { productId: { in: staleClosed } } });
  }

  return `${seen.size} varer vurderet (${created} nye, ${updated} ændret, ${unchanged} uændret), ${stale.length} ryddet`;
}

// Vurderer én vare igen, fx lige efter at en agent har scannet den.
export async function reassessOffProduct(productId: string): Promise<void> {
  const row = await prisma.product.findFirst({ where: { id: productId, ...OFF_REVIEW_WHERE }, select: PRODUCT_SELECT });
  if (!row) return;
  const data = reviewData(assessOffProduct(toInput(row)));
  await prisma.productQualityReview.upsert({
    where: { productId },
    create: { productId, ...data },
    update: { ...data, assessedAt: new Date() },
  });
}
