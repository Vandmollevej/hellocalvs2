import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import { matchBrand } from "@/lib/brand-match";
import { createFrontCutoutJobs } from "@/lib/image-cutout-jobs";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";

const PROMPT_VERSION = "front-v2-2026-09-26";

const BOX_SCHEMA = {
  anyOf: [
    {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
    },
    { type: "null" },
  ],
};

const FRONT_SCHEMA = {
  type: "object",
  properties: {
    logoText: { type: ["string", "null"] },
    logoConfidence: { type: "number" },
    logoBox: BOX_SCHEMA,
    productBox: BOX_SCHEMA,
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
    "logoText",
    "logoConfidence",
    "logoBox",
    "productBox",
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

    const languageHint = context.primaryLanguageLabels.join(", ");
    const knownBrandText = knownBrands
      .slice(0, 750)
      .map((item) => item.name)
      .join(", ");

    const { value: aiValue, model } = await callStructuredVision<ProductFrontAnalysis>({
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
        "Genkend logo visuelt; stol ikke kun på almindelig OCR. Logoer kan være stiliserede, skrå, håndskrevne eller grafiske.",
        "logoText = navnet som hovedlogoet viser, stavet som mærket selv staver det (uden ® og ™). null hvis intet logo ses.",
        "logoConfidence = 0-1 hvor sikker du er på logoText.",
        "logoBox = rektangel om hovedlogoet (kun logoet, ikke hele emballagen) i brøkdele 0-1 af billedets bredde/højde: x,y = øverste venstre hjørne. null hvis intet logo ses.",
        "productBox = rektangel om hele den fysiske vare/emballage i billedet, samme format. null hvis varen ikke kan afgrænses.",
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
        promptVersion: PROMPT_VERSION,
        prediction: { ...value, brandMatch } as unknown as Prisma.InputJsonValue,
        confidence: value.overallConfidence,
        imageUrl,
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
