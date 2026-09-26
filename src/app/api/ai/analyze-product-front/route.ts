import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions } from "@/lib/ai-regions";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import { FRONT_PROMPT_VERSION, FRONT_SCHEMA, FRONT_SYSTEM, frontText } from "@/lib/product-ai-tasks";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";

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
      select: { name: true },
      orderBy: { name: "asc" },
      take: 750,
    });

    const { value, model } = await callStructuredVision<ProductFrontAnalysis>({
      photo,
      schemaName: "hello_cal_product_front",
      schema: FRONT_SCHEMA,
      system: FRONT_SYSTEM,
      text: frontText({ barcode, context, knownBrands: knownBrands.map((item) => item.name) }),
    });

    const analysis = await prisma.aiProductAnalysis.create({
      data: {
        kind: "FRONT",
        barcode,
        marketRegion: context.marketRegion,
        gs1Regions: context.gs1Regions,
        languages: context.primaryOcrLanguages,
        model,
        promptVersion: FRONT_PROMPT_VERSION,
        prediction: value as unknown as Prisma.InputJsonValue,
        confidence: value.overallConfidence,
        regions: readRegions(value) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return NextResponse.json({
      analysisId: analysis.id,
      context,
      result: value,
    });
  } catch (error) {
    console.error("Product front analysis failed", error);
    return NextResponse.json(
      { analysisId: null, result: null, context, message: "Kunne ikke analysere produktforsiden" },
      { status: 503 },
    );
  }
}
