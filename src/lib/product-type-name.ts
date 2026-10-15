import { callStructuredText } from "@/lib/product-ai";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";
import { normalizeProductName } from "@/lib/product-naming";
import { brandProductName, isPlaceholderProductName } from "@/lib/product-placeholder-name";

// Forsiden gav brand og variant, men intet varenavn (fx Verpoorten Original:
// varetypen "Eierlikör" står ikke stort på flasken). Her navngives varetypen
// ud fra det, forsiden allerede gav — et lille tekstkald, intet nyt billede.
// Giver forsiden intet svar, spørges OpenAI direkte: "Hvilken produkttype er
// <brand subbrand variant>?" (askProductType, brugerens regel 2026-10-15).
// Kan den stadig ikke navngives, hedder varen brand + subbrand
// (src/lib/product-placeholder-name.ts) — aldrig "Vare <stregkode>".

const SCHEMA = {
  type: "object",
  properties: {
    productName: { type: ["string", "null"] },
    confidence: { type: "number" },
  },
  required: ["productName", "confidence"],
  additionalProperties: false,
};

const SYSTEM = [
  "Du navngiver en dagligvare for Hello Cal ud fra det, der er læst på dens forside.",
  "productName = hvad varen er (varetypen), fx Æggelikør, Letmælk, Chokoladekiks — kort, uden brand, subbrand, variant og pakningsstørrelse.",
  "Står varetypen ikke i teksten, så brug din viden om brandet og varen (fx Verpoorten Original = Eierlikör).",
  "Skriv varetypen på emballagens sprog, når det er kendt; ellers på dansk.",
  "Kan du ikke afgøre, hvad varen er, returnér null med lav confidence. Gæt ikke på et brand, du ikke kender.",
].join(" ");

const MIN_CONFIDENCE = 0.6;

type FrontRead = Pick<ProductFrontAnalysis, "brand" | "subbrand" | "logoText" | "variant" | "packageSizeText" | "claims" | "visibleText" | "language">;

export async function nameProductType(front: FrontRead): Promise<string | null> {
  const brand = front.brand?.trim() || front.logoText?.trim() || "";
  const visible = [...(front.visibleText ?? []), ...(front.claims ?? [])].map((t) => t.trim()).filter(Boolean);
  if (!brand && !visible.length) return null;
  const text = [
    brand ? `Brand: ${brand}` : "",
    front.subbrand?.trim() ? `Subbrand: ${front.subbrand.trim()}` : "",
    front.variant?.trim() ? `Variant: ${front.variant.trim()}` : "",
    front.packageSizeText?.trim() ? `Pakningsstørrelse: ${front.packageSizeText.trim()}` : "",
    front.language ? `Emballagens sprog: ${front.language}` : "",
    visible.length ? `Synlig tekst: ${visible.join(" · ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const { value } = await callStructuredText<{ productName: string | null; confidence: number }>({
    system: SYSTEM,
    text,
    schemaName: "hello_cal_product_type_name",
    schema: SCHEMA,
  });
  const name = value.productName?.trim();
  if (!name || value.confidence < MIN_CONFIDENCE || isPlaceholderProductName(name)) return null;
  return normalizeProductName(name);
}

const ASK_SYSTEM = [
  "Du svarer på, hvilken produkttype en dagligvare er, for Hello Cal.",
  "productName = varetypen, fx Æggelikør, Letmælk, Chokoladekiks — kort, uden brand, subbrand, variant og pakningsstørrelse.",
  "Brug din viden om brandet og varen (fx Verpoorten Original = Eierlikör).",
  "Skriv varetypen på emballagens sprog, når det er kendt; ellers på dansk.",
  "Kender du ikke varen, returnér null med lav confidence. Gæt ikke.",
].join(" ");

export type ProductTypeQuestion = {
  brand?: string | null;
  subbrand?: string | null;
  variant?: string | null;
  packageSizeText?: string | null;
  alcoholPercent?: number | null;
  language?: string | null;
};

// "Hvilken produkttype er Verpoorten Original?" — kun brand, subbrand og
// variant, ingen forsideaflæsning. Bruges, når forsiden ikke gav varetypen.
export async function askProductType(question: ProductTypeQuestion): Promise<string | null> {
  const base = brandProductName(question.brand, question.subbrand);
  if (!base) return null;
  const variant = question.variant?.trim() ?? "";
  const label = variant && !base.toLowerCase().includes(variant.toLowerCase()) ? `${base} ${variant}` : base;
  const text = [
    `Hvilken produkttype er ${label}?`,
    question.packageSizeText?.trim() ? `Pakningsstørrelse: ${question.packageSizeText.trim()}` : "",
    question.alcoholPercent ? `Alkohol: ${question.alcoholPercent} % vol` : "",
    question.language ? `Emballagens sprog: ${question.language}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const { value } = await callStructuredText<{ productName: string | null; confidence: number }>({
    system: ASK_SYSTEM,
    text,
    schemaName: "hello_cal_product_type_question",
    schema: SCHEMA,
  });
  const name = value.productName?.trim();
  if (!name || value.confidence < MIN_CONFIDENCE || isPlaceholderProductName(name)) return null;
  const normalized = normalizeProductName(name);
  // Svaret må ikke bare være brandet eller varianten igen.
  const echoes = [question.brand, question.subbrand, question.variant, label].some(
    (part) => part?.trim() && part.trim().toLowerCase() === normalized.toLowerCase(),
  );
  return echoes ? null : normalized;
}

// Forsiden først, derefter det direkte spørgsmål.
export async function findProductType(front: FrontRead | null | undefined, question: ProductTypeQuestion): Promise<string | null> {
  const fromFront = front ? await nameProductType(front).catch(() => null) : null;
  return fromFront ?? (await askProductType(question).catch(() => null));
}
