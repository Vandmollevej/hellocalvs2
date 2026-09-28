import { REGION_PROMPT, REGION_SCHEMA_PROPERTIES, REGION_SCHEMA_REQUIRED } from "@/lib/ai-regions";
import { describeLanguageSignals, type BarcodeContext } from "@/lib/barcode-context";
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
    context.crossBorderNote ?? null,
    describeLanguageSignals(context.signals ?? {}),
  ].filter((line): line is string => Boolean(line));
}

// --- Forside ---------------------------------------------------------------

// front-v3 (2026-09-27): logo-felterne fra front-v2-2026-09-26 lå kun i
// forside-rutens egen kopi af prompten, så forsiden fik ingen usikkerheds-
// rammer, og den natlige genkørsel spurgte uden logo-felter. Nu én prompt.
export const FRONT_PROMPT_VERSION = "front-v3-2026-09-27";

// Logo-/produktboks i ImageBox-format ({ x, y, width, height }, 0-1), som
// fritskrabningen (src/lib/image-cutout-jobs.ts) bruger.
const IMAGE_BOX_SCHEMA = {
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

export const FRONT_SCHEMA = {
  type: "object",
  properties: {
    logoText: { type: ["string", "null"] },
    logoConfidence: { type: "number" },
    logoBox: IMAGE_BOX_SCHEMA,
    productBox: IMAGE_BOX_SCHEMA,
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
    ...REGION_SCHEMA_REQUIRED,
  ],
  additionalProperties: false,
};

export const FRONT_SYSTEM = [
  "Du analyserer FORSIDEN af en dagligvareemballage for Hello Cal.",
  "Skeln meget strengt mellem brand, subbrand, produktnavn og variant.",
  "brand = hovedmærket/kommercielt logo, fx Arla.",
  "subbrand = produktserie/familie, fx LactoFREE.",
  "productName = hvad varen faktisk er, fx Letmælk. Emballeret drikkevand hedder Flaskevand (ikke bare Vand), medmindre emballagen siger fx Kildevand.",
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

// --- Stregkode-foto: logo og variant ----------------------------------------

// barcode-logo-v1 (2026-09-28): logoet står ikke altid på forsiden — på fx
// en vandflaske stod det ved siden af stregkoden. Stregkode-fotoet læses
// derfor også for logo (til fritskrabning) og variant (fx "Uden brus").
export const BARCODE_LOGO_PROMPT_VERSION = "barcode-logo-v1-2026-09-28";

export const BARCODE_LOGO_SCHEMA = {
  type: "object",
  properties: {
    logoText: { type: ["string", "null"] },
    logoConfidence: { type: "number" },
    logoBox: IMAGE_BOX_SCHEMA,
    variant: { type: ["string", "null"] },
    variantConfidence: { type: "number" },
  },
  required: ["logoText", "logoConfidence", "logoBox", "variant", "variantConfidence"],
  additionalProperties: false,
};

export const BARCODE_LOGO_SYSTEM = [
  "Du ser et foto af en dagligvareemballage taget for at læse stregkoden, for Hello Cal.",
  "Find et brand-logo, hvis et ses nogen steder i fotoet (ofte ved siden af stregkoden).",
  "Genkend logo visuelt; stol ikke kun på almindelig OCR. Logoer kan være stiliserede, skrå, håndskrevne eller grafiske.",
  "logoText = navnet som logoet viser, stavet som mærket selv staver det (uden ® og ™). null hvis intet logo ses.",
  "Stregkodens cifre, genbrugsmærker, pant-mærker og certificeringsmærker er ikke logoer.",
  "logoConfidence = 0-1 hvor sikker du er på logoText.",
  "logoBox = rektangel om logoet (kun logoet) i brøkdele 0-1 af billedets bredde/højde: x,y = øverste venstre hjørne. null hvis intet logo ses.",
  "variant = tydeligt synlig smag/type/styrke/fedtprocent eller anden variant, fx Uden brus, Let eller Jordbær. null hvis ingen ses.",
  "variantConfidence = 0-1 hvor sikker du er på variant.",
  "Brug ikke producentens juridiske firmanavn fra småt tekst som logo.",
  "Hvis et felt ikke kan afgøres, returnér null og lav confidence lavere. Gæt ikke.",
].join(" ");

export function barcodeLogoText(input: ContextLines & { knownBrands: string[] }) {
  const knownBrandText = input.knownBrands.join(", ");
  return [
    ...contextLines(input),
    knownBrandText ? `Kendte brandnavne i databasen (kun som støtte, ikke facit): ${knownBrandText}` : "",
    "Find logo og variant i stregkode-fotoet.",
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Næringsdeklaration -----------------------------------------------------

// v3 (2026-09-27): pakningens samlede indhold er ikke en portion — test med
// en 1 L mælkekarton gav "1 Liter" som alternativ portion uden kcal, hvilket
// ellers bliver til en admin-fejlrapport ved hver oprettelse.
export const NUTRITION_PROMPT_VERSION = "nutrition-v3-2026-09-27";

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

const NUTRITION_RULES = [
  "Foretræk værdier pr. 100 g eller 100 ml. Bland aldrig portionskolonnen sammen med pr.100-kolonnen.",
  "kcalPer100g/proteinPer100g/carbsPer100g/fatPer100g skal være null hvis korrekt pr.100-værdi ikke kan læses.",
  "Hvis tabellen kun viser pr. portion, sæt basis=portion og lad pr.100-felter være null.",
  "Find også alternative portionsangivelser såsom pr. glas, skive, stk. eller portion, når de faktisk står på emballagen.",
  "Pakningens samlede indhold (fx 1 Liter eller 500 g) er ikke en portion og skal ikke med i alternativeServings.",
  `micronutrients: alle øvrige næringsstoffer der faktisk står i tabellen (vitaminer, mineraler, fedtsyrer, kolesterol osv.), pr. 100 g/ml omregnet til disse enheder: ${MICRO_UNITS}.`,
  "tolerance = producentens egen ± for netop den værdi, når den står på emballagen (samme enhed), ellers null. Beregn aldrig selv en ±.",
  "Tom micronutrients-liste hvis tabellen ikke viser flere næringsstoffer.",
  "Prioritér de oplyste sprog, men de er ikke en whitelist.",
  "Gæt aldrig tal.",
];

export const NUTRITION_SYSTEM = [
  "Du aflæser en næringsdeklaration på en fødevareemballage.",
  ...NUTRITION_RULES,
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

const INGREDIENTS_RULES = [
  "Returnér kun ingredienser, allergener og tekst som faktisk kan ses.",
  "rawText skal bevare teksten så tæt på emballagen som muligt.",
  "ingredientsText må rydde åbenlyse OCR-linjeproblemer, men må ikke opfinde, fjerne eller ændre ingredienser/procenter.",
  "Prioritér de oplyste sprog, men de er ikke en whitelist.",
  "Hvis billedet ikke er en ingrediensdeklaration eller er ulæseligt, brug tomme strenge/lister og lav confidence lav.",
];

export const INGREDIENTS_SYSTEM = [
  "Du aflæser en ingrediensdeklaration på en fødevareemballage.",
  ...INGREDIENTS_RULES,
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

// --- Energi + indhold i ét kald ---------------------------------------------
// Brugerens valg 2026-09-27: næring og ingredienser står ofte på samme foto,
// så de læses i ét kald i stedet for to (samme billede blev før sendt to
// gange, ~3.400 ekstra tokens pr. vare). Bruges kun, når telefonens egen OCR
// ikke kunne læse næringstabellen (src/lib/local-label.ts).

export const LABEL_PROMPT_VERSION = "label-v1-2026-09-27";

type ObjectSchema = { properties: Record<string, unknown>; required: string[] } & Record<string, unknown>;

function withoutRegions(schema: ObjectSchema): ObjectSchema {
  const properties = { ...schema.properties };
  delete properties.ocrRegion;
  delete properties.uncertainRegions;
  return {
    ...schema,
    properties,
    required: schema.required.filter((key) => key !== "ocrRegion" && key !== "uncertainRegions"),
  };
}

export const LABEL_SCHEMA = {
  type: "object",
  properties: {
    nutrition: withoutRegions(NUTRITION_SCHEMA),
    ingredients: withoutRegions(INGREDIENTS_SCHEMA),
    ...REGION_SCHEMA_PROPERTIES,
  },
  required: ["nutrition", "ingredients", ...REGION_SCHEMA_REQUIRED],
  additionalProperties: false,
};

export const LABEL_SYSTEM = [
  "Du aflæser ét foto af en fødevareemballage, som kan vise både næringsdeklarationen og ingredienslisten.",
  "Udfyld nutrition ud fra næringsdeklarationen:",
  ...NUTRITION_RULES,
  "Udfyld ingredients ud fra ingredienslisten:",
  ...INGREDIENTS_RULES,
  "Viser billedet kun den ene del, så returnér null-/tomme værdier og lav confidence for den anden del.",
  REGION_PROMPT,
].join(" ");

export function labelText(input: ContextLines & { ocrText?: string }) {
  return [
    ...contextLines(input),
    input.ocrText ? `Lokal OCR som støtte (kontrollér altid mod billedet):\n${input.ocrText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
