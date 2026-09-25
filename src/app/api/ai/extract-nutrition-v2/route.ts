import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REGION_PROMPT, REGION_SCHEMA_PROPERTIES, REGION_SCHEMA_REQUIRED, readRegions } from "@/lib/ai-regions";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import { deriveFiberPercent } from "@/lib/nutrition-normalize";
import type { NutritionAiResult, NutritionAnalysis } from "@/lib/product-analysis-types";

const PROMPT_VERSION = "nutrition-v2-2026-09-24-regions";

const NULLABLE_NUMBER = { type: ["number", "null"] };

const NUTRITION_SCHEMA = {
  type: "object",
  properties: {
    basis: { type: "string", enum: ["100g", "100ml", "portion", "unknown"] },
    energyKj: NULLABLE_NUMBER,
    kcalPer100g: NULLABLE_NUMBER,
    proteinPer100g: NULLABLE_NUMBER,
    carbsPer100g: NULLABLE_NUMBER,
    fatPer100g: NULLABLE_NUMBER,
    saturatedFatPer100g: NULLABLE_NUMBER,
    sugarsPer100g: NULLABLE_NUMBER,
    fiberPer100g: NULLABLE_NUMBER,
    saltPer100g: NULLABLE_NUMBER,
    rawText: { type: "string" },
    language: { type: ["string", "null"] },
    alternativeServings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          amount: NULLABLE_NUMBER,
          unit: { type: ["string", "null"] },
          kcal: NULLABLE_NUMBER,
          confidence: { type: "number" },
        },
        required: ["label", "amount", "unit", "kcal", "confidence"],
        additionalProperties: false,
      },
    },
    confidence: { type: "number" },
    ...REGION_SCHEMA_PROPERTIES,
  },
  required: [
    "basis",
    "energyKj",
    "kcalPer100g",
    "proteinPer100g",
    "carbsPer100g",
    "fatPer100g",
    "saturatedFatPer100g",
    "sugarsPer100g",
    "fiberPer100g",
    "saltPer100g",
    "rawText",
    "language",
    "alternativeServings",
    "confidence",
    ...REGION_SCHEMA_REQUIRED,
  ],
  additionalProperties: false,
};

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
      system: [
        "Du aflæser en næringsdeklaration på en fødevareemballage.",
        "Foretræk værdier pr. 100 g eller 100 ml. Bland aldrig portionskolonnen sammen med pr.100-kolonnen.",
        "kcalPer100g/proteinPer100g/carbsPer100g/fatPer100g skal være null hvis korrekt pr.100-værdi ikke kan læses.",
        "Hvis tabellen kun viser pr. portion, sæt basis=portion og lad pr.100-felter være null.",
        "Find også alternative portionsangivelser såsom pr. glas, skive, stk. eller portion, når de faktisk står på emballagen.",
        "Prioritér de oplyste sprog, men de er ikke en whitelist.",
        "Gæt aldrig tal.",
        REGION_PROMPT,
      ].join(" "),
      text: [
        `Stregkode: ${barcode}.`,
        `Markedsregion: ${context.marketRegion}.`,
        `GS1-landesignal(er): ${context.gs1Regions.join(", ") || "ukendt"}.`,
        `Prioriterede sprog: ${context.primaryLanguageLabels.join(", ")}.`,
        ocrText ? `Lokal OCR som støtte (kontrollér altid mod billedet):\n${ocrText}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
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
        promptVersion: PROMPT_VERSION,
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
