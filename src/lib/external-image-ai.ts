import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { analyzeFrontPhoto } from "@/lib/product-photo-analysis";
import { createFrontCutoutJobs, discardPendingFrontImage, linkCutoutJobsToProduct } from "@/lib/image-cutout-jobs";
import { debugLog, errorText } from "@/lib/debug-log";

// Natlig robot "external-image-ai" (docs/DECISIONS.md 2026-10-02). Når en
// Open Food Facts-/USDA-vare vises første gang, tilbydes brugeren 10 points for at
// scanne den igen. Reagerer brugeren ikke (banneret vist, ingen genscanning),
// sendes Open Food Facts-billedet her om natten gennem samme OpenAI-aflæsning
// som kameraets forsidefoto: logo, vareboks, brand, subbrand, variant og
// pakningsstørrelse. Billedrobotten fritlægger derefter varen beskåret til
// vareboksen og logoet (BRAND_LOGO-kandidat), og det nye billede går som
// altid via pendingImageUrl + admin-godkendelse.
// Open Food Facts' egne tekstfelter overskrives ikke; AI'en udfylder kun det,
// der mangler. Højst MAX_PER_RUN varer pr. kørsel for at begrænse AI-udgiften.

const MAX_PER_RUN = 100;
// Alle varer, uanset hvor de blev scannet, læses med DK som marked (appens
// standardregion) — stregkodens GS1-land bruges stadig i prompten.
const DEFAULT_MARKET_REGION = "DK";

export async function analyzeDeclinedExternalImages(): Promise<string> {
  const products = await prisma.product.findMany({
    where: {
      externalSource: { in: ["OPEN_FOOD_FACTS", "USDA"] },
      rescanOfferedAt: { not: null },
      rescannedAt: null,
      externalImageAnalyzedAt: null,
      imageUrl: { startsWith: "https://" },
    },
    orderBy: { rescanOfferedAt: "asc" },
    take: MAX_PER_RUN,
    select: {
      id: true,
      imageUrl: true,
      subbrand: true,
      variant: true,
      packageSizeText: true,
      brand: { select: { id: true, name: true } },
      barcodes: { select: { code: true }, take: 1 },
    },
  });

  let analyzed = 0;
  let failed = 0;
  for (const product of products) {
    const startedAt = Date.now();
    const barcode = product.barcodes[0]?.code ?? "";
    try {
      const { analysisId, result, brandMatch } = await analyzeFrontPhoto({
        photo: product.imageUrl!,
        barcode,
        marketRegion: DEFAULT_MARKET_REGION,
      });
      await prisma.aiProductAnalysis.update({
        where: { id: analysisId },
        data: { productId: product.id, imageUrl: product.imageUrl },
      });

      const changes: Prisma.ProductUpdateInput = { externalImageAnalyzedAt: new Date() };
      let brand = product.brand;
      const brandName = (brandMatch?.name ?? result.brand ?? result.logoText ?? "").trim();
      if (!brand && brandName) {
        brand = await prisma.brand.upsert({
          where: { name: brandName },
          update: {},
          create: { name: brandName },
          select: { id: true, name: true },
        });
        changes.brand = { connect: { id: brand.id } };
      }
      if (!product.subbrand && result.subbrand) changes.subbrand = result.subbrand;
      if (!product.variant && result.variant) changes.variant = result.variant;
      if (!product.packageSizeText && result.packageSizeText) changes.packageSizeText = result.packageSizeText;
      await prisma.product.update({ where: { id: product.id }, data: changes });

      // analyzeFrontPhoto gemmer kun data-URL'er lokalt; Open Food Facts-
      // billedet fritlægges direkte fra deres https-adresse.
      // Den beskårne fritlægning erstatter den rå fra stregkodeopslaget, som
      // ellers ville spærre for den (kun ét ventende forslag ad gangen).
      await discardPendingFrontImage(product.id, product.imageUrl);
      await createFrontCutoutJobs({ analysisId, sourceUrl: product.imageUrl!, front: result, brandMatch });
      await linkCutoutJobsToProduct({ frontAnalysisId: analysisId, productId: product.id, brand });

      analyzed += 1;
      await debugLog({
        category: "scan",
        event: "external_image_ai",
        message: `Open Food Facts-billedet læst om natten: ${brand ? `${brand.name} — ` : ""}${result.productName ?? "intet navn"}${
          result.logoBox ? " · logo fundet" : ""
        }`,
        productId: product.id,
        barcode,
        durationMs: Date.now() - startedAt,
        data: { changed: Object.keys(changes), logo: Boolean(result.logoBox), productBox: Boolean(result.productBox) },
      });
    } catch (error) {
      failed += 1;
      console.error("External image AI failed", product.id, error);
      // Markeres ikke som læst — prøves igen næste nat.
      await debugLog({
        category: "scan",
        event: "external_image_ai",
        level: "error",
        message: `Open Food Facts-billedet kunne ikke læses: ${errorText(error)}`,
        productId: product.id,
        barcode,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  return `${products.length} Open Food Facts-varer uden genscanning · ${analyzed} læst · ${failed} fejlede`;
}
