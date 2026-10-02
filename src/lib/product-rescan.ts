import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import { analyzeFrontPhoto } from "@/lib/product-photo-analysis";
import { discardPendingFrontImage, linkCutoutJobsToProduct } from "@/lib/image-cutout-jobs";
import {
  enrichFront,
  enrichLabel,
  type LabelReadOutcome,
  type QuickEnrichmentInput,
} from "@/lib/quick-product-enrichment";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import { awardPoints } from "@/lib/points";
import { RESCAN_POINTS, type RescanStep } from "@/lib/product-rescan-offer";
import { debugLog, errorText } from "@/lib/debug-log";

// "Scan varen igen" (docs/DECISIONS.md 2026-10-02). Kører efter svaret på
// POST /api/products/[id]/rescan (after()), med samme aflæsning som "opret
// straks" i kameraflowet:
// - Open Food Facts-vare (forside + energi + indhold): forsiden læses af
//   OpenAI (navn, brand, logo, fritskrabning), energi/indhold lokalt først og
//   ellers OpenAI. Registreringernes snapshots røres ikke — varen er ikke ny.
// - Egen online-vare uden PNG (kun forside): kun billedet. Forsiden læses for
//   vareboks og logo, så billedrobotten kan fritlægge den; navn, brand og
//   næring fra butikkens produktark bevares.
// Det nye forsidebillede går som altid via pendingImageUrl og admin-godkendelse.
//
// Overtagelse (brugerens valg 2026-10-02): når næringen er læst fra brugerens
// egne fotos, bliver en Open Food Facts-/USDA-vare vores egen. Kilden og
// eksterne id ryddes (så intet fremtidigt opslag/sync matcher den), varen
// bliver søgbar, og originalen vises aldrig igen: Open Food Facts-billedet
// erstattes af brugerens forsidefoto, dets ventende fritlægning kasseres, og
// felter som kun kom fra den eksterne kilde (allergener, E-numre, udvidet
// næring, portion, ingredienser der ikke blev læst igen) fjernes.
//
// Brugeren får 10 points, medmindre AI'en slet ikke kunne se en vare på
// forsidefotoet (ingen navn, intet logo, ingen vareboks).

export type RescanInput = Omit<QuickEnrichmentInput, "fallbackName" | "nutritionPhoto" | "existingProduct"> & {
  nutritionPhoto?: string;
  steps: RescanStep[];
  userId: string;
};

async function adoptAsOwnProduct(input: RescanInput, label: LabelReadOutcome) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { externalSource: true, imageUrl: true },
  });
  if (!product?.externalSource) return false;
  const ownImageUrl = await saveDataUrlImage(input.frontPhoto).catch(() => null);
  await discardPendingFrontImage(input.productId, product.imageUrl);
  await prisma.product.update({
    where: { id: input.productId },
    data: {
      externalSource: null,
      externalId: null,
      sourceCheckedAt: null,
      imageUrl: ownImageUrl,
      allergens: [],
      additives: [],
      nutritionExtra: Prisma.DbNull,
      unsaturatedFatPer100g: null,
      transFatPer100g: null,
      cholesterolPer100g: null,
      vitaminAPer100g: null,
      vitaminCPer100g: null,
      servingSizeGrams: null,
      servingSizeUnitSingular: null,
      servingSizeUnitPlural: null,
      ...(label.saturatedFatRead ? {} : { saturatedFatPer100g: null }),
      ...(label.ingredientsRead ? {} : { ingredientsText: null }),
    },
  });
  return true;
}

async function enrichImageOnly(input: RescanInput): Promise<boolean | null> {
  try {
    const { analysisId, result } = await analyzeFrontPhoto({
      photo: input.frontPhoto,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
      signals: input.signals,
    });
    await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId: input.productId } });
    // Et ikke-godkendt forslag fra butikkens billede må ikke spærre for det nye.
    await discardPendingFrontImage(input.productId);
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { brand: { select: { id: true, name: true } } },
    });
    await linkCutoutJobsToProduct({ frontAnalysisId: analysisId, productId: input.productId, brand: product?.brand ?? null });
    return Boolean(result.productName?.trim() || result.logoText?.trim() || result.productBox);
  } catch (error) {
    console.error("Rescan front analysis failed", input.productId, error);
    return null;
  }
}

export async function enrichRescan(input: RescanInput) {
  const startedAt = Date.now();
  const fullRead = input.steps.includes("nutrition") && Boolean(input.nutritionPhoto);
  let recognized: boolean | null;
  let adopted = false;

  if (fullRead) {
    const current = await prisma.product.findUnique({ where: { id: input.productId }, select: { name: true } });
    const enrichment: QuickEnrichmentInput = {
      ...input,
      nutritionPhoto: input.nutritionPhoto!,
      fallbackName: current?.name ?? `Vare ${input.barcode}`,
      existingProduct: true,
    };
    const [front, label] = await Promise.all([enrichFront(enrichment), enrichLabel(enrichment)]);
    recognized = front;
    // Kun med næring fra brugerens egne fotos — ellers bar varen stadig de
    // eksterne makroer under vores navn.
    if (label.nutritionComplete) {
      adopted = await adoptAsOwnProduct(input, label).catch((error) => {
        console.error("Rescan adoption failed", input.productId, error);
        return false;
      });
    }
    // Kunne næringen ikke læses, er varen stadig ekstern: banneret tilbydes
    // igen, så en anden scanning kan gøre den færdig.
    if (!adopted) {
      await prisma.product
        .update({ where: { id: input.productId }, data: { rescannedAt: null, rescannedByUserId: null } })
        .catch(() => {});
    }
    await syncProductNutritionFeaturesSafely(input.productId);
  } else {
    recognized = await enrichImageOnly(input);
  }

  // Fejlede aflæsningen teknisk (fx OpenAI nede), kan fotoet ikke vurderes —
  // brugeren skal ikke straffes for det.
  // Samme bruger får kun points én gang pr. vare, også hvis tilbuddet åbnes igen.
  const alreadyAwarded = await prisma.pointsTransaction
    .count({ where: { userId: input.userId, productId: input.productId, reason: "PRODUCT_RESCAN" } })
    .catch(() => 0);
  const awarded = recognized !== false && alreadyAwarded === 0;
  if (awarded) {
    await awardPoints(input.userId, "PRODUCT_RESCAN", RESCAN_POINTS, { productId: input.productId }).catch((error) =>
      console.error("Could not award rescan points", input.productId, error),
    );
  }

  await debugLog({
    category: "scan",
    event: "rescan_done",
    level: awarded ? "info" : "warn",
    message: `Genscanning ${fullRead ? "(forside + energi + indhold)" : "(kun forside)"} færdig — ${
      awarded
        ? `${RESCAN_POINTS} points givet`
        : alreadyAwarded
          ? "ingen points: brugeren har allerede fået points for varen"
          : "ingen points: forsidefotoet viste ingen vare"
    }${recognized === null ? " (AI-aflæsningen fejlede)" : ""}${
      fullRead ? (adopted ? " · varen er nu vores egen (ekstern kilde fjernet)" : " · ekstern kilde beholdt (næringen kunne ikke læses)") : ""
    }`,
    userId: input.userId,
    productId: input.productId,
    barcode: input.barcode,
    durationMs: Date.now() - startedAt,
    data: { steps: input.steps, recognized, adopted },
  }).catch((error) => console.error("Rescan log failed", errorText(error)));
}
