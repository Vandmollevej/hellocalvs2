import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import type { IngredientsAnalysis } from "@/lib/product-analysis-types";

const PROMPT_VERSION = "ingredients-v1-2026-09-16";

const INGREDIENT_SCHEMA = {
  type: "object",
  properties: {
    rawText: { type: "string" },
    ingredientsText: { type: "string" },
    allergens: { type: "array", items: { type: "string" } },
    language: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
  required: ["rawText", "ingredientsText", "allergens", "language", "confidence"],
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
    return NextResponse.json({ message: "barcode er påkrævet før ingrediensanalyse" }, { status: 400 });
  }

  const context = buildBarcodeContext(barcode, marketRegion);

  try {
    const { value, model } = await callStructuredVision<IngredientsAnalysis>({
      photo,
      schemaName: "hello_cal_ingredients",
      schema: INGREDIENT_SCHEMA,
      system: [
        "Du aflæser en ingrediensdeklaration på en fødevareemballage.",
        "Returnér kun ingredienser, allergener og tekst som faktisk kan ses.",
        "rawText skal bevare teksten så tæt på emballagen som muligt.",
        "ingredientsText må rydde åbenlyse OCR-linjeproblemer, men må ikke opfinde, fjerne eller ændre ingredienser/procenter.",
        "Prioritér de oplyste sprog, men de er ikke en whitelist.",
        "Hvis billedet ikke er en ingrediensdeklaration eller er ulæseligt, brug tomme strenge/lister og lav confidence lav.",
      ].join(" "),
      text: [
        `Stregkode: ${barcode}.`,
        `Markedsregion: ${context.marketRegion}.`,
        `GS1-landesignal(er): ${context.gs1Regions.join(", ") || "ukendt"}.`,
        `Prioriterede sprog: ${context.primaryLanguageLabels.join(", ")}.`,
        ocrText ? `Lokal OCR har foreslået denne tekst. Brug den kun som støtte og kontrollér mod billedet:\n${ocrText}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    // Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): gemmer
    // selve fotoet, så den lokale billedanalyse-agent kan sammenligne det mod
    // produktets forsidefoto. Fejl her må aldrig stoppe selve ingrediens-aflæsningen.
    const imageUrl = await saveDataUrlImage(photo).catch(() => null);

    const analysis = await prisma.aiProductAnalysis.create({
      data: {
        kind: "INGREDIENTS",
        barcode,
        marketRegion: context.marketRegion,
        gs1Regions: context.gs1Regions,
        languages: context.primaryOcrLanguages,
        model,
        promptVersion: PROMPT_VERSION,
        prediction: value as unknown as Prisma.InputJsonValue,
        confidence: value.confidence,
        imageUrl,
      },
      select: { id: true },
    });

    return NextResponse.json({ analysisId: analysis.id, context, result: value });
  } catch (error) {
    console.error("Ingredient photo extraction failed", error);
    return NextResponse.json(
      { analysisId: null, result: null, context, message: "Kunne ikke læse ingredienslisten" },
      { status: 503 },
    );
  }
}
