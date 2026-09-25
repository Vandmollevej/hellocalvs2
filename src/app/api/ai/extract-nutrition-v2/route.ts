import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions } from "@/lib/ai-regions";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import { NUTRITION_PROMPT_VERSION, NUTRITION_SCHEMA, NUTRITION_SYSTEM, nutritionText } from "@/lib/product-ai-tasks";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import { deriveFiberPercent } from "@/lib/nutrition-normalize";
import type { NutritionAiResult, NutritionAnalysis } from "@/lib/product-analysis-types";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  const barcode = typeof body?.barcode === "string" ? body.barcode.replace(/\D/g, "") : "";
  const marketRegion = typeof body?.marketRegion === "string" ? body.marketRegion : "DK";
  const ocrText = typeof body?.ocrText === "string" ? body.ocrText.trim() : "";

  if (!photo.startsWith("data:image/") && !photo.startsWith("https://")) {
    return NextResponse.json({ message: "photo er påkrævet" }, { status: 400 });
  }
  if (!barcode) {
    return NextResponse.json({ message: "barcode er påkrævet før næringsanalyse" }, { status: 400 });
  }

  const context = buildBarcodeContext(barcode, marketRegion);

  try {
    const { value: aiValue, model } = await callStructuredVision<NutritionAiResult>({
      photo,
      schemaName: "hello_cal_nutrition",
      schema: NUTRITION_SCHEMA,
      system: NUTRITION_SYSTEM,
      text: nutritionText({ barcode, context, ocrText }),
    });
    // fiberPercent beregnes deterministisk, modellen bliver aldrig spurgt om
    // det (docs/DECISIONS.md 2026-09-23).
    const value: NutritionAnalysis = {
      ...aiValue,
      fiberPercent: deriveFiberPercent(aiValue.basis, aiValue.fiberPer100g),
    };

    // Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): gemmer
    // selve fotoet, så den lokale billedanalyse-agent kan sammenligne det mod
    // produktets forsidefoto. Fejl her må aldrig stoppe selve næringsaflæsningen.
    const imageUrl = await saveDataUrlImage(photo).catch(() => null);

    const analysis = await prisma.aiProductAnalysis.create({
      data: {
        kind: "NUTRITION",
        barcode,
        marketRegion: context.marketRegion,
        gs1Regions: context.gs1Regions,
        languages: context.primaryOcrLanguages,
        model,
        promptVersion: NUTRITION_PROMPT_VERSION,
        prediction: value as unknown as Prisma.InputJsonValue,
        confidence: value.confidence,
        regions: readRegions(value) as unknown as Prisma.InputJsonValue,
        imageUrl,
      },
      select: { id: true },
    });

    return NextResponse.json({ analysisId: analysis.id, context, result: value });
  } catch (error) {
    console.error("Nutrition photo extraction failed", error);
    return NextResponse.json(
      { analysisId: null, result: null, context, message: "Kunne ikke læse næringsindholdet" },
      { status: 503 },
    );
  }
}
