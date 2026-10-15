import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callStructuredText } from "@/lib/product-ai";
import { MACRO_SOURCE_KEYS } from "@/lib/nutrients";
import { ALCOHOL_LABEL_EXEMPT_PERCENT, alcoholDrinkKcal } from "@/lib/alcohol-label";
import { debugLog, errorText } from "@/lib/debug-log";

// Alkoholprocenten fra fotoene (docs/DECISIONS.md 2026-10-15): gemmes som
// dietaryTags.pct (bruges af alkoholstatistikken, src/lib/food-classification.ts)
// og i ProductFilters, og varen bliver en drikkevare.
export async function recordAlcoholPercent(productId: string, percent: number | null | undefined) {
  if (percent == null || !(percent > 0)) return;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { dietaryTags: true, productCategory: true },
  });
  if (!product) return;
  const tags = { ...((product.dietaryTags as Record<string, unknown> | null) ?? {}) };
  tags.pct = `${String(percent).replace(".", ",")} %`;
  delete tags.isAlcoholFree;
  await prisma.product.update({
    where: { id: productId },
    data: { dietaryTags: tags as Prisma.InputJsonValue, productCategory: product.productCategory ?? "DRINK" },
  });
  await prisma.productFilters.upsert({
    where: { productId },
    update: { alcoholPercent: percent, alcohol: "Indeholder alkohol" },
    create: { productId, alcoholPercent: percent, alcohol: "Indeholder alkohol" },
  });
}

const SCHEMA = {
  type: "object",
  properties: {
    carbsPer100ml: { type: "number" },
    proteinPer100ml: { type: "number" },
    fatPer100ml: { type: "number" },
    confidence: { type: "number" },
  },
  required: ["carbsPer100ml", "proteinPer100ml", "fatPer100ml", "confidence"],
  additionalProperties: false,
};

const SYSTEM = [
  "Du skønner næringsindholdet i en alkoholisk drik uden næringsdeklaration for Hello Cal.",
  "Giv kulhydrat (inkl. sukker), protein og fedt i gram pr. 100 ml ud fra varetypen, brandet og alkoholprocenten, som en typisk vare af den slags (fx Eierlikör ca. 27 g kulhydrat, 4 g protein, 5 g fedt; vodka 0; øl ca. 3 g kulhydrat).",
  "Alkoholens energi regnes separat — medregn den ikke.",
  "confidence = 0-1, hvor sikker du er på skønnet.",
].join(" ");

const MIN_CONFIDENCE = 0.5;

// Brugerens valg 2026-10-15: står varen uden kalorier, men med alkoholprocent,
// regnes energien ud: alkoholen præcist (7 kcal/g), resten skønnet ud fra
// varetypen. Tallene får kilden ESTIMATED (∼ i appen), indtil en admin retter
// dem. Returnerer true, når et skøn blev gemt.
export async function estimateAlcoholNutrition(productId: string): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      variant: true,
      productType: true,
      kcalPer100g: true,
      nutrientSources: true,
      brand: { select: { name: true } },
      filters: { select: { alcoholPercent: true } },
    },
  });
  const alcoholPercent = product?.filters?.alcoholPercent ?? null;
  if (!product || product.kcalPer100g > 0 || alcoholPercent == null || alcoholPercent <= ALCOHOL_LABEL_EXEMPT_PERCENT) {
    return false;
  }
  try {
    const { value } = await callStructuredText<{
      carbsPer100ml: number;
      proteinPer100ml: number;
      fatPer100ml: number;
      confidence: number;
    }>({
      system: SYSTEM,
      text: [
        `Vare: ${product.productType || product.name}`,
        product.brand?.name ? `Brand: ${product.brand.name}` : "",
        product.variant ? `Variant: ${product.variant}` : "",
        `Alkohol: ${alcoholPercent} % vol`,
      ]
        .filter(Boolean)
        .join("\n"),
      schemaName: "hello_cal_alcohol_nutrition",
      schema: SCHEMA,
    });
    const clean = (n: number) => (Number.isFinite(n) && n >= 0 && n < 100 ? Math.round(n * 10) / 10 : 0);
    const carbs = clean(value.carbsPer100ml);
    const protein = clean(value.proteinPer100ml);
    const fat = clean(value.fatPer100ml);
    // Alkoholens del er sikker; er resten usikker, tælles kun alkoholen.
    const sure = value.confidence >= MIN_CONFIDENCE;
    const kcal = alcoholDrinkKcal({ alcoholPercent, carbs: sure ? carbs : 0, protein: sure ? protein : 0, fat: sure ? fat : 0 });
    const sources = { ...((product.nutrientSources as Record<string, string> | null) ?? {}) };
    for (const key of MACRO_SOURCE_KEYS) sources[key] = "ESTIMATED";
    await prisma.product.update({
      where: { id: productId },
      data: {
        kcalPer100g: kcal,
        carbsPer100g: sure ? carbs : 0,
        proteinPer100g: sure ? protein : 0,
        fatPer100g: sure ? fat : 0,
        nutrientSources: sources,
      },
    });
    await debugLog({
      category: "scan",
      event: "alcohol_nutrition_estimate",
      message: `Ingen næringstabel: ${kcal} kcal/100 ml skønnet ud fra ${alcoholPercent} % vol${
        sure ? ` + ${carbs} g kulhydrat, ${protein} g protein, ${fat} g fedt` : " (kun alkoholen — skønnet af resten var usikkert)"
      }`,
      productId,
      data: { alcoholPercent, carbs, protein, fat, confidence: value.confidence, kcal },
    });
    return true;
  } catch (error) {
    console.error("[alcohol-nutrition] skøn fejlede", productId, errorText(error));
    return false;
  }
}
