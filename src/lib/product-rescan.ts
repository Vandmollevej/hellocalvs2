import { prisma } from "@/lib/prisma";
import { analyzeFrontPhoto } from "@/lib/product-photo-analysis";
import { linkCutoutJobsToProduct } from "@/lib/image-cutout-jobs";
import { enrichFront, enrichLabel, type QuickEnrichmentInput } from "@/lib/quick-product-enrichment";
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
// Brugeren får 10 points, medmindre AI'en slet ikke kunne se en vare på
// forsidefotoet (ingen navn, intet logo, ingen vareboks).

export type RescanInput = Omit<QuickEnrichmentInput, "fallbackName" | "nutritionPhoto" | "existingProduct"> & {
  nutritionPhoto?: string;
  steps: RescanStep[];
  userId: string;
};

async function enrichImageOnly(input: RescanInput): Promise<boolean | null> {
  try {
    const { analysisId, result } = await analyzeFrontPhoto({
      photo: input.frontPhoto,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
      signals: input.signals,
    });
    await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId: input.productId } });
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

  if (fullRead) {
    const current = await prisma.product.findUnique({ where: { id: input.productId }, select: { name: true } });
    const enrichment: QuickEnrichmentInput = {
      ...input,
      nutritionPhoto: input.nutritionPhoto!,
      fallbackName: current?.name ?? `Vare ${input.barcode}`,
      existingProduct: true,
    };
    const [front] = await Promise.all([enrichFront(enrichment), enrichLabel(enrichment)]);
    recognized = front;
    await syncProductNutritionFeaturesSafely(input.productId);
  } else {
    recognized = await enrichImageOnly(input);
  }

  // Fejlede aflæsningen teknisk (fx OpenAI nede), kan fotoet ikke vurderes —
  // brugeren skal ikke straffes for det.
  const awarded = recognized !== false;
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
      awarded ? `${RESCAN_POINTS} points givet` : "ingen points: forsidefotoet viste ingen vare"
    }${recognized === null ? " (AI-aflæsningen fejlede)" : ""}`,
    userId: input.userId,
    productId: input.productId,
    barcode: input.barcode,
    durationMs: Date.now() - startedAt,
    data: { steps: input.steps, recognized },
  }).catch((error) => console.error("Rescan log failed", errorText(error)));
}
