import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions } from "@/lib/ai-regions";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import { FRONT_PROMPT_VERSION, FRONT_SCHEMA, FRONT_SYSTEM, frontText } from "@/lib/product-ai-tasks";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import { matchBrand } from "@/lib/brand-match";
import { createFrontCutoutJobs } from "@/lib/image-cutout-jobs";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

// Modellen kan returnere bokse der stikker ud af billedet eller er tomme —
// klip til 0-1 og kassér bokse uden areal.
function cleanBox(box: ProductFrontAnalysis["logoBox"]) {
  if (!box) return null;
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  const width = clamp01(Math.min(box.width, 1 - x));
  const height = clamp01(Math.min(box.height, 1 - y));
  return width > 0.01 && height > 0.01 ? { x, y, width, height } : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";

  if (!photo.startsWith("data:image/") && !photo.startsWith("https://")) {
    return NextResponse.json({ message: "photo er påkrævet" }, { status: 400 });
  }
  if (!barcode) {
    return NextResponse.json({ message: "barcode er påkrævet før forsideanalyse" }, { status: 400 });
  }

  const context = buildBarcodeContext(barcode, marketRegion);

  try {
    const knownBrands = await prisma.brand.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // Samme prompt som den natlige genkørsel (src/lib/product-ai-tasks.ts).
    const { value: aiValue, model } = await callStructuredVision<ProductFrontAnalysis>({
      photo,
      schemaName: "hello_cal_product_front",
      schema: FRONT_SCHEMA,
      system: FRONT_SYSTEM,
      text: frontText({ barcode, context, knownBrands: knownBrands.slice(0, 750).map((item) => item.name) }),
    });

    const value: ProductFrontAnalysis = {
      ...aiValue,
      logoBox: cleanBox(aiValue.logoBox),
      productBox: cleanBox(aiValue.productBox),
    };

    // Logonavnet holdes op mod Brand-tabellen; et match giver databasens
    // stavemåde, så produktet kobles til det eksisterende brand i stedet for
    // at oprette en næsten-dublet (docs/DECISIONS.md 2026-09-26).
    const brandMatch = matchBrand(value.logoText ?? value.brand, knownBrands);

    // Fotoet gemmes, så image-agenten kan fritskrabe logo og produkt.
    // Fejl her må aldrig stoppe selve forsideanalysen.
    const imageUrl = await saveDataUrlImage(photo).catch(() => null);

    const analysis = await prisma.aiProductAnalysis.create({
      data: {
        kind: "FRONT",
        barcode,
        marketRegion: context.marketRegion,
        gs1Regions: context.gs1Regions,
        languages: context.primaryOcrLanguages,
        model,
        promptVersion: FRONT_PROMPT_VERSION,
        prediction: { ...value, brandMatch } as unknown as Prisma.InputJsonValue,
        confidence: value.overallConfidence,
        imageUrl,
        regions: readRegions(value) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    if (imageUrl) {
      await createFrontCutoutJobs({ analysisId: analysis.id, sourceUrl: imageUrl, front: value, brandMatch }).catch(
        (error) => console.error("Could not queue cutout jobs", error),
      );
    }

    return NextResponse.json({
      analysisId: analysis.id,
      context,
      result: value,
      brandMatch,
    });
  } catch (error) {
    console.error("Product front analysis failed", error);
    return NextResponse.json(
      { analysisId: null, result: null, brandMatch: null, context, message: "Kunne ikke analysere produktforsiden" },
      { status: 503 },
    );
  }
}
