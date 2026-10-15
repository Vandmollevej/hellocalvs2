import { callStructuredText } from "@/lib/product-ai";
import type { ProductFrontAnalysis } from "@/lib/product-analysis-types";
import { normalizeProductName } from "@/lib/product-naming";
import { isPlaceholderProductName } from "@/lib/product-placeholder-name";

// Forsiden gav brand og variant, men intet varenavn (fx Verpoorten Original:
// varetypen "Eierlikör" står ikke stort på flasken). Her navngives varetypen
// ud fra det, forsiden allerede gav — et lille tekstkald, intet nyt billede.
// Kan den ikke navngives, hedder varen brand + subbrand
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
