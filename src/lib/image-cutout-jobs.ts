import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matchBrand, type BrandMatch } from "@/lib/brand-match";
import type { ImageBox, ProductFrontAnalysis } from "@/lib/product-analysis-types";

// Fritskrabning (docs/DECISIONS.md 2026-09-26). Next.js lægger kun jobs i
// image_cutout_jobs; scripts/image-agent beskærer, fjerner baggrunden (rembg)
// og skriver resultatet videre. Se ImageCutoutJob i prisma/schema.prisma.

// Luft om AI'ens boks — modellens koordinater er omtrentlige, og rembg
// trimmer alligevel den gennemsigtige kant væk bagefter.
function padBox(box: ImageBox, padding: number): ImageBox {
  const x = Math.max(0, box.x - box.width * padding);
  const y = Math.max(0, box.y - box.height * padding);
  return {
    x,
    y,
    width: Math.min(1 - x, box.width * (1 + 2 * padding)),
    height: Math.min(1 - y, box.height * (1 + 2 * padding)),
  };
}

export async function createFrontCutoutJobs({
  analysisId,
  sourceUrl,
  front,
  brandMatch,
}: {
  analysisId: string;
  sourceUrl: string;
  front: ProductFrontAnalysis;
  brandMatch: BrandMatch | null;
}) {
  const jobs: Prisma.ImageCutoutJobCreateManyInput[] = [
    {
      kind: "PRODUCT_FRONT",
      sourceUrl,
      analysisId,
      cropBox: front.productBox ? padBox(front.productBox, 0.05) : undefined,
    },
  ];
  if (front.logoBox) {
    jobs.push({
      kind: "BRAND_LOGO",
      sourceUrl,
      analysisId,
      cropBox: padBox(front.logoBox, 0.15),
      recognizedText: front.logoText,
      confidence: front.logoConfidence,
      brandId: brandMatch?.id,
      matchScore: brandMatch?.score,
    });
  }
  await prisma.imageCutoutJob.createMany({ data: jobs });
}

// Logoet fra stregkode-fotoet (docs/DECISIONS.md 2026-09-28) — oprettes
// når varen findes, så jobbet kobles direkte til vare og brand.
export async function createBarcodeLogoCutoutJob({
  analysisId,
  sourceUrl,
  logoBox,
  logoText,
  logoConfidence,
  productId,
  brandMatch,
}: {
  analysisId: string;
  sourceUrl: string;
  logoBox: ImageBox;
  logoText: string | null;
  logoConfidence: number;
  productId: string;
  brandMatch: BrandMatch | null;
}) {
  await prisma.imageCutoutJob.create({
    data: {
      kind: "BRAND_LOGO",
      sourceUrl,
      analysisId,
      productId,
      cropBox: padBox(logoBox, 0.15),
      recognizedText: logoText,
      confidence: logoConfidence,
      brandId: brandMatch?.id,
      matchScore: brandMatch?.score,
    },
  });
}

// Varer hentet fra en ekstern kilde (Open Food Facts/USDA) skal se ud præcis
// som scannede varer (docs/DECISIONS.md 2026-09-28): deres billede fritskrabes
// i samme pipeline og går samme vej via pendingImageUrl + admin-godkendelse.
export async function createExternalImageCutoutJob(productId: string, imageUrl: string | null) {
  if (!imageUrl?.startsWith("https://")) return;
  await prisma.imageCutoutJob.create({
    data: { kind: "PRODUCT_FRONT", sourceUrl: imageUrl, productId },
  });
}

// Kaldes når produktet oprettes: kobler forsidens jobs til produktet og
// logo-jobbet til det brand, brugeren endte med at bekræfte.
export async function linkCutoutJobsToProduct({
  frontAnalysisId,
  productId,
  brand,
}: {
  frontAnalysisId: string;
  productId: string;
  brand: { id: string; name: string } | null;
}) {
  await prisma.imageCutoutJob.updateMany({
    where: { analysisId: frontAnalysisId },
    data: { productId },
  });
  if (!brand) return;

  const logoJobs = await prisma.imageCutoutJob.findMany({
    where: { analysisId: frontAnalysisId, kind: "BRAND_LOGO" },
    select: { id: true, recognizedText: true },
  });
  for (const job of logoJobs) {
    const match = matchBrand(job.recognizedText, [brand]);
    await prisma.imageCutoutJob.update({
      where: { id: job.id },
      data: { brandId: brand.id, matchScore: match?.score ?? 0 },
    });
  }
}
