import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";

const PROMPT_VERSION = "front-v1-2026-09-16";

const FRONT_SCHEMA = {
  type: "object",
  properties: {
    brand: { type: ["string", "null"] },
    subbrand: { type: ["string", "null"] },
    productName: { type: ["string", "null"] },
    variant: { type: ["string", "null"] },
    packageSizeText: { type: ["string", "null"] },
    claims: { type: "array", items: { type: "string" } },
    visibleText: { type: "array", items: { type: "string" } },
    language: { type: ["string", "null"] },
    overallConfidence: { type: "number" },
    fieldConfidence: {
      type: "object",
      properties: {
        brand: { type: "number" },
        subbrand: { type: "number" },
        productName: { type: "number" },
        variant: { type: "number" },
        packageSizeText: { type: "number" },
      },
      required: ["brand", "subbrand", "productName", "variant", "packageSizeText"],
      additionalProperties: false,
    },
  },
  required: [
    "brand",
    "subbrand",
    "productName",
    "variant",
    "packageSizeText",
    "claims",
    "visibleText",
    "language",
    "overallConfidence",
    "fieldConfidence",
  ],
  additionalProperties: false,
};

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

    const languageHint = context.primaryLanguageLabels.join(", ");
    const knownBrandText = knownBrands.map((item) => item.name).join(", ");

    const { value, model } = await callStructuredVision<ProductFrontAnalysis>({
      photo,
      schemaName: "hello_cal_product_front",
      schema: FRONT_SCHEMA,
      system: [
        "Du analyserer FORSIDEN af en dagligvareemballage for Hello Cal.",
        "Skeln meget strengt mellem brand, subbrand, produktnavn og variant.",
        "brand = hovedmærket/kommercielt logo, fx Arla.",
        "subbrand = produktserie/familie, fx LactoFREE.",
        "productName = hvad varen faktisk er, fx Letmælk.",
        "variant = smag/type/styrke/fedtprocent eller anden variant, når den tydeligt er en variant.",
        "packageSizeText = synlig mængde/størrelse, fx 1 L eller 500 g.",
        "Genkend logo visuelt; stol ikke kun på almindelig OCR.",
        "Brug ikke producentens juridiske firmanavn fra småt bagsidetekst som brand, medmindre det også tydeligt er mærket på forsiden.",
        "Prioritér de oplyste sprog, men de er IKKE en whitelist. Genkend andre sprog hvis emballagen kræver det.",
        "Hvis et felt ikke kan afgøres, returnér null og lav confidence lavere. Gæt ikke.",
      ].join(" "),
      text: [
        `Stregkode: ${barcode}.`,
        `Markedsregion: ${context.marketRegion}.`,
        `GS1-landesignal(er): ${context.gs1Regions.join(", ") || "ukendt"}.`,
        `Prioriterede sprog: ${languageHint}.`,
        knownBrandText ? `Kendte brandnavne i databasen (kun som støtte, ikke facit): ${knownBrandText}` : "",
        "Udtræk felterne fra produktforsiden.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const analysis = await prisma.aiProductAnalysis.create({
      data: {
        kind: "FRONT",
        barcode,
        marketRegion: context.marketRegion,
        gs1Regions: context.gs1Regions,
        languages: context.primaryOcrLanguages,
        model,
        promptVersion: PROMPT_VERSION,
        prediction: value as unknown as Prisma.InputJsonValue,
        confidence: value.overallConfidence,
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
