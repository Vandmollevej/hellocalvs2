import { REGION_PROMPT, REGION_SCHEMA_PROPERTIES, REGION_SCHEMA_REQUIRED } from "@/lib/ai-regions";
import type { BarcodeContext } from "@/lib/barcode-context";
import { NUTRIENTS, NUTRIENT_KEYS } from "@/lib/nutrients";

// Skema, prompt og promptversion for de tre AI-aflæsninger af produktfotos.
// Delt mellem API-ruterne (/api/ai/analyze-product-front,
// /api/ai/extract-nutrition-v2, /api/ai/extract-ingredients-photo) og den
// natlige genkørsel på admin "Uncertainties" (src/lib/uncertainty-rerun.ts),
// så genkørslen spørger præcis som den oprindelige aflæsning.

type ContextLines = { barcode: string; context: BarcodeContext };

function contextLines({ barcode, context }: ContextLines, languageLabel = "Prioriterede sprog") {
  return [
    `Stregkode: ${barcode}.`,
    `Markedsregion: ${context.marketRegion}.`,
    `GS1-landesignal(er): ${context.gs1Regions.join(", ") || "ukendt"}.`,
    `${languageLabel}: ${context.primaryLanguageLabels.join(", ")}.`,
  ];
}

// --- Forside ---------------------------------------------------------------

export const FRONT_PROMPT_VERSION = "front-v1-2026-09-24-regions";

export const FRONT_SCHEMA = {
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
    ...REGION_SCHEMA_PROPERTIES,
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
    ...REGION_SCHEMA_REQUIRED,
  ],
  additionalProperties: false,
};

export const FRONT_SYSTEM = [
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
  REGION_PROMPT,
].join(" ");

export function frontText(input: ContextLines & { knownBrands: string[] }) {
  const knownBrandText = input.knownBrands.join(", ");
  return [
    ...contextLines(input),
    knownBrandText ? `Kendte brandnavne i databasen (kun som støtte, ikke facit): ${knownBrandText}` : "",
    "Udtræk felterne fra produktforsiden.",
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Næringsdeklaration -----------------------------------------------------

export const NUTRITION_PROMPT_VERSION = "nutrition-v2-2026-09-25-micros";

const NULLABLE_NUMBER = { type: ["number", "null"] };

export const NUTRITION_SCHEMA = {
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
    // Usikkerheds-~ (docs/DECISIONS.md 2026-09-25): øvrige næringsstoffer,
    // der faktisk står i tabellen, og producentens egen ± når den er oplyst.
    micronutrients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: NUTRIENT_KEYS },
          per100g: { type: "number" },
          tolerance: NULLABLE_NUMBER,
        },
        required: ["key", "per100g", "tolerance"],
        additionalProperties: false,
      },
    },
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
    "micronutrients",
    "rawText",
    "language",
    "alternativeServings",
    "confidence",
    ...REGION_SCHEMA_REQUIRED,
  ],
  additionalProperties: false,
};

const MICRO_UNITS = NUTRIENTS.map((n) => `${n.key}=${n.unit}`).join(", ");

export const NUTRITION_SYSTEM = [
  "Du aflæser en næringsdeklaration på en fødevareemballage.",
  "Foretræk værdier pr. 100 g eller 100 ml. Bland aldrig portionskolonnen sammen med pr.100-kolonnen.",
  "kcalPer100g/proteinPer100g/carbsPer100g/fatPer100g skal være null hvis korrekt pr.100-værdi ikke kan læses.",
  "Hvis tabellen kun viser pr. portion, sæt basis=portion og lad pr.100-felter være null.",
  "Find også alternative portionsangivelser såsom pr. glas, skive, stk. eller portion, når de faktisk står på emballagen.",
  `micronutrients: alle øvrige næringsstoffer der faktisk står i tabellen (vitaminer, mineraler, fedtsyrer, kolesterol osv.), pr. 100 g/ml omregnet til disse enheder: ${MICRO_UNITS}.`,
  "tolerance = producentens egen ± for netop den værdi, når den står på emballagen (samme enhed), ellers null. Beregn aldrig selv en ±.",
  "Tom micronutrients-liste hvis tabellen ikke viser flere næringsstoffer.",
  "Prioritér de oplyste sprog, men de er ikke en whitelist.",
  "Gæt aldrig tal.",
  REGION_PROMPT,
].join(" ");

export function nutritionText(input: ContextLines & { ocrText?: string }) {
  return [
    ...contextLines(input),
    input.ocrText ? `Lokal OCR som støtte (kontrollér altid mod billedet):\n${input.ocrText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Ingrediensliste ---------------------------------------------------------

export const INGREDIENTS_PROMPT_VERSION = "ingredients-v1-2026-09-24-regions";

export const INGREDIENTS_SCHEMA = {
  type: "object",
  properties: {
    rawText: { type: "string" },
    ingredientsText: { type: "string" },
    allergens: { type: "array", items: { type: "string" } },
    language: { type: ["string", "null"] },
    confidence: { type: "number" },
    ...REGION_SCHEMA_PROPERTIES,
  },
  required: ["rawText", "ingredientsText", "allergens", "language", "confidence", ...REGION_SCHEMA_REQUIRED],
  additionalProperties: false,
};

export const INGREDIENTS_SYSTEM = [
  "Du aflæser en ingrediensdeklaration på en fødevareemballage.",
  "Returnér kun ingredienser, allergener og tekst som faktisk kan ses.",
  "rawText skal bevare teksten så tæt på emballagen som muligt.",
  "ingredientsText må rydde åbenlyse OCR-linjeproblemer, men må ikke opfinde, fjerne eller ændre ingredienser/procenter.",
  "Prioritér de oplyste sprog, men de er ikke en whitelist.",
  "Hvis billedet ikke er en ingrediensdeklaration eller er ulæseligt, brug tomme strenge/lister og lav confidence lav.",
  REGION_PROMPT,
].join(" ");

export function ingredientsText(input: ContextLines & { ocrText?: string }) {
  return [
    ...contextLines(input),
    input.ocrText
      ? `Lokal OCR har foreslået denne tekst. Brug den kun som støtte og kontrollér mod billedet:\n${input.ocrText}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
