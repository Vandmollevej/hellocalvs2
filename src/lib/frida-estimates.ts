import { IMPORTED_DISH_SOURCES } from "@/lib/meal-kit-providers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findKitchenConversion } from "@/lib/kitchen-conversions";
import { mediumHandSizeGrams } from "@/lib/hand-sizes";
import { asNumberRecord, isNutrientKey } from "@/lib/nutrients";
import { ownValues } from "@/lib/nutrient-resolution";
import {
  groupFridaReferences,
  matchFridaEstimate,
  type FridaReference,
  type FridaTypeGroup,
} from "@/lib/frida-estimate-match";

// Robotten "frida-estimates" (brugerens krav 2026-10-10, docs/DECISIONS.md
// samme dato). Kører hver nat og lige efter Bilka/REMA-, Frida- og
// Valdemarsro-importen (agenterne beder om en kørsel). Ingen AI.
//
// 1. Varer uden energimærkning (nutritionMissing) får Fridas tal i de felter,
//    butikken ikke selv har udfyldt, med kilden "FRIDA" (∼ i appen).
//    Tvivlstilfælde lægges på admin → Frida-match (frida_estimate_reviews).
// 2. Alle butiksvarer får deres stregkode, også dem uden næring, så de kan
//    scannes (brugerens krav: varer vises uanset om de har næring).
// 3. Valdemarsro-retter uden næring regnes ud fra ingredienslinjerne, hvis
//    ALLE linjer kan regnes med (ellers intet skøn).
// 4. Delte retter, hvis ingrediens-snapshot stod med 0, fordi varen manglede
//    næring, får varens nye Frida-tal.
// Registreringer ændres aldrig (snapshot).

const MACROS = [
  ["kcal", "kcalPer100g"],
  ["protein", "proteinPer100g"],
  ["carbs", "carbsPer100g"],
  ["fat", "fatPer100g"],
] as const;

type FridaRow = FridaReference & {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  micros: Record<string, number>;
};

async function loadFrida(): Promise<{ rows: FridaRow[]; groups: FridaTypeGroup[] }> {
  const products = await prisma.product.findMany({
    where: { externalSource: "FRIDA", discontinued: false },
    select: {
      id: true,
      name: true,
      namePlural: true,
      productType: true,
      variant: true,
      keywords: true,
      dietaryTags: true,
      kcalPer100g: true,
      proteinPer100g: true,
      carbsPer100g: true,
      fatPer100g: true,
      micronutrientsPer100g: true,
    },
  });
  const rows: FridaRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    namePlural: p.namePlural,
    productType: p.productType,
    variant: p.variant,
    keywords: p.keywords,
    tags: Object.fromEntries(
      Object.entries((p.dietaryTags as Record<string, unknown> | null) ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "",
      ),
    ),
    kcal: p.kcalPer100g,
    protein: p.proteinPer100g,
    carbs: p.carbsPer100g,
    fat: p.fatPer100g,
    micros: asNumberRecord(p.micronutrientsPer100g),
  }));
  return { rows, groups: groupFridaReferences(rows) };
}

async function loadAdminChoices(): Promise<Map<string, string | null>> {
  const decided = await prisma.fridaEstimateReview.findMany({
    where: { decidedAt: { not: null } },
    select: { reviewKey: true, chosenFridaProductId: true },
  });
  return new Map(decided.map((r) => [r.reviewKey, r.chosenFridaProductId]));
}

type PendingReview = { typeLabel: string; reason: string; candidateIds: string[]; count: number; examples: string[] };

function noteReview(reviews: Map<string, PendingReview>, key: string, review: Omit<PendingReview, "count" | "examples">, name: string) {
  const existing = reviews.get(key);
  if (existing) {
    existing.count += 1;
    if (existing.examples.length < 5) existing.examples.push(name);
  } else {
    reviews.set(key, { ...review, count: 1, examples: [name] });
  }
}

const productSelect = {
  id: true,
  name: true,
  productType: true,
  variant: true,
  flavor: true,
  keywords: true,
  nutritionMissing: true,
  fridaEstimateId: true,
  kcalPer100g: true,
  proteinPer100g: true,
  carbsPer100g: true,
  fatPer100g: true,
  saturatedFatPer100g: true,
  unsaturatedFatPer100g: true,
  transFatPer100g: true,
  cholesterolPer100g: true,
  vitaminAPer100g: true,
  vitaminCPer100g: true,
  servingSizeGrams: true,
  nutritionExtra: true,
  micronutrientsPer100g: true,
  nutrientSources: true,
  nutritionFeatures: {
    select: {
      sugarsPer100g: true,
      sugarSource: true,
      fiberPer100g: true,
      fiberSource: true,
      saltPer100g: true,
      saltSource: true,
    },
  },
} satisfies Prisma.ProductSelect;
type EstimatableProduct = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function sourcesOf(product: { nutrientSources: unknown }): Record<string, string> {
  return product.nutrientSources && typeof product.nutrientSources === "object"
    ? { ...(product.nutrientSources as Record<string, string>) }
    : {};
}

// Fjerner tidligere Frida-skøn, så varens egne tal står tilbage.
function withoutFrida(product: EstimatableProduct) {
  const sources = sourcesOf(product);
  const micros = asNumberRecord(product.micronutrientsPer100g);
  for (const [key, source] of Object.entries(sources)) {
    if (source !== "FRIDA") continue;
    delete sources[key];
    delete micros[key];
  }
  return { sources, micros };
}

// Fridas tal i de felter, varen ikke selv har (brugerens regel: kun felter,
// Bilka/REMA m.fl. ikke har udfyldt).
function fridaUpdate(product: EstimatableProduct, ref: FridaRow): Prisma.ProductUpdateInput {
  const before = sourcesOf(product);
  const { sources, micros } = withoutFrida(product);
  const values = { kcal: ref.kcal, protein: ref.protein, carbs: ref.carbs, fat: ref.fat };
  const data: Prisma.ProductUpdateInput = {};
  for (const [key, column] of MACROS) {
    // Uden energimærkning er 0 en pladsholder; en makro over 0 har butikken
    // selv oplyst og bliver stående. Et tidligere Frida-skøn opdateres.
    const fill = before[key] === "FRIDA" || (product.nutritionMissing && !(product[column] > 0));
    if (!fill) continue;
    data[column] = values[key];
    sources[key] = "FRIDA";
  }
  const own = ownValues({ ...product, micronutrientsPer100g: micros, nutrientSources: sources });
  for (const [key, value] of Object.entries(ref.micros)) {
    if (!isNutrientKey(key) || own.values[key] !== undefined) continue;
    micros[key] = value;
    sources[key] = "FRIDA";
  }
  return {
    ...data,
    micronutrientsPer100g: Object.keys(micros).length ? micros : Prisma.DbNull,
    nutrientSources: Object.keys(sources).length ? sources : Prisma.DbNull,
    nutritionMissing: false,
    fridaEstimateId: ref.id,
  };
}

// Skønnet trækkes tilbage (admin valgte "ingen passer", eller Frida-varen
// findes ikke mere): varen står igen uden næring.
function revertUpdate(product: EstimatableProduct): Prisma.ProductUpdateInput {
  const before = sourcesOf(product);
  const { sources, micros } = withoutFrida(product);
  const data: Prisma.ProductUpdateInput = {
    micronutrientsPer100g: Object.keys(micros).length ? micros : Prisma.DbNull,
    nutrientSources: Object.keys(sources).length ? sources : Prisma.DbNull,
    fridaEstimateId: null,
  };
  for (const [key, column] of MACROS) if (before[key] === "FRIDA") data[column] = 0;
  if (before.kcal === "FRIDA") data.nutritionMissing = true;
  return data;
}

async function estimateProducts(frida: { rows: FridaRow[]; groups: FridaTypeGroup[] }, choices: Map<string, string | null>) {
  const byId = new Map(frida.rows.map((r) => [r.id, r]));
  const reviews = new Map<string, PendingReview>();
  let filled = 0;
  let reverted = 0;
  let unmatched = 0;
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.product.findMany({
      where: {
        AND: [
          { OR: [{ nutritionMissing: true }, { fridaEstimateId: { not: null } }] },
          // Også brugeroprettede varer (externalSource null); retter og Frida selv ikke.
          { OR: [{ externalSource: null }, { externalSource: { notIn: ["FRIDA", ...IMPORTED_DISH_SOURCES] } }] },
        ],
        privateOwnerId: null,
        discontinued: false,
      },
      select: productSelect,
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;

    for (const product of batch) {
      const match = matchFridaEstimate(product, frida.groups, choices);
      const ref = match.kind === "match" ? byId.get(match.reference.id) : undefined;
      if (ref) {
        await prisma.product.update({ where: { id: product.id }, data: fridaUpdate(product, ref) });
        filled += 1;
        continue;
      }
      if (match.kind === "review") {
        noteReview(reviews, match.reviewKey, { typeLabel: match.typeLabel, reason: match.reason, candidateIds: match.candidates.map((c) => c.id) }, product.name);
      } else {
        unmatched += 1;
      }
      if (product.fridaEstimateId) {
        await prisma.product.update({ where: { id: product.id }, data: revertUpdate(product) });
        reverted += 1;
      }
    }
  }

  await saveReviews(reviews);
  return { filled, reverted, unmatched, review: [...reviews.values()].reduce((sum, r) => sum + r.count, 0), reviewGroups: reviews.size };
}

async function saveReviews(reviews: Map<string, PendingReview>) {
  const now = new Date();
  for (const [reviewKey, review] of reviews) {
    const data = {
      typeLabel: review.typeLabel,
      reason: review.reason,
      candidateIds: review.candidateIds,
      productCount: review.count,
      exampleNames: review.examples,
      seenAt: now,
    };
    await prisma.fridaEstimateReview.upsert({ where: { reviewKey }, create: { reviewKey, ...data }, update: data });
  }
  // Åbne tvivlstilfælde, ingen vare længere rammer, fjernes; admins valg bliver.
  await prisma.fridaEstimateReview.deleteMany({ where: { decidedAt: null, seenAt: { lt: now } } });
}

// Alle butiksvarer (Bilka/REMA, hvor externalId er EAN'en) får deres stregkode.
async function ensureStoreBarcodes(): Promise<number> {
  return prisma.$executeRaw`
    INSERT INTO "barcodes" (code, "productId")
    SELECT p."externalId", p.id FROM "products" p
    WHERE p."externalSource" IN ('BILKA', 'REMA1000')
      AND p."externalId" ~ '^[0-9]{8,14}$'
      AND p.discontinued = false
      AND NOT EXISTS (SELECT 1 FROM "barcodes" b WHERE b."productId" = p.id)
    ON CONFLICT (code) DO NOTHING`;
}

// ---------------------------------------------------------------- retter

// Valdemarsro-agentens enheder (scripts/valdemarsro-agent/agent.py UNIT_ALIASES).
const MASS_GRAMS: Record<string, number> = { g: 1, kg: 1000, mg: 0.001 };
const VOLUME_ML: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, tbsp: 15, tsp: 5 };
const OTHER_GRAMS: Record<string, number> = { pinch: 0.5 };
// Linjer uden mængde, der ikke giver energi af betydning ("salt og peber").
const NEGLIGIBLE = /^(salt|peber|salt og peber|groft salt|flagesalt|havsalt|vand|koldt vand|varmt vand|kogende vand|isterninger)$/i;

type RecipeLine = { name?: string | null; amount?: number | null; unit?: string | null };

function lineGrams(line: RecipeLine): number | null {
  const name = (line.name ?? "").trim();
  const amount = typeof line.amount === "number" && Number.isFinite(line.amount) ? line.amount : null;
  if (amount === null) return NEGLIGIBLE.test(name) ? 0 : null;
  const unit = line.unit ?? null;
  if (unit && MASS_GRAMS[unit] !== undefined) return amount * MASS_GRAMS[unit];
  if (unit && VOLUME_ML[unit] !== undefined) {
    const conversion = findKitchenConversion(name);
    const gramsPerMl = conversion ? conversion.gramsPerDl / 100 : 1;
    return amount * VOLUME_ML[unit] * gramsPerMl;
  }
  if (unit && OTHER_GRAMS[unit] !== undefined) return amount * OTHER_GRAMS[unit];
  if (!unit || unit === "pcs") {
    const piece = mediumHandSizeGrams(name);
    return piece ? amount * piece : null;
  }
  return null;
}

async function estimateRecipes(frida: { rows: FridaRow[]; groups: FridaTypeGroup[] }, choices: Map<string, string | null>) {
  const byId = new Map(frida.rows.map((r) => [r.id, r]));
  const recipes = await prisma.product.findMany({
    where: { externalSource: "VALDEMARSRO", nutritionMissing: true, discontinued: false },
    select: { id: true, recipeDetails: true },
  });
  let estimated = 0;
  for (const recipe of recipes) {
    const details = (recipe.recipeDetails ?? {}) as { ingredients?: RecipeLine[]; servings?: number | null };
    const lines = details.ingredients ?? [];
    if (!lines.length) continue;
    let grams = 0;
    const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    let complete = true;
    for (const line of lines) {
      const g = lineGrams(line);
      if (g === null) {
        complete = false;
        break;
      }
      if (g === 0) continue;
      const name = (line.name ?? "").trim();
      const match = matchFridaEstimate({ name, productType: name, variant: null }, frida.groups, choices);
      const ref = match.kind === "match" ? byId.get(match.reference.id) : undefined;
      if (!ref) {
        complete = false;
        break;
      }
      grams += g;
      totals.kcal += (ref.kcal * g) / 100;
      totals.protein += (ref.protein * g) / 100;
      totals.carbs += (ref.carbs * g) / 100;
      totals.fat += (ref.fat * g) / 100;
    }
    // Brugerens valg 2026-10-10: kan en linje ikke regnes med, gives intet skøn.
    if (!complete || grams <= 0) continue;
    const per100 = (value: number) => Math.round((value * 1000) / grams) / 10;
    const servings = typeof details.servings === "number" && details.servings > 0 ? details.servings : null;
    await prisma.product.update({
      where: { id: recipe.id },
      data: {
        kcalPer100g: per100(totals.kcal),
        proteinPer100g: per100(totals.protein),
        carbsPer100g: per100(totals.carbs),
        fatPer100g: per100(totals.fat),
        ...(servings ? { servingSizeGrams: Math.round((grams / servings) * 10) / 10 } : {}),
        nutrientSources: { kcal: "FRIDA", protein: "FRIDA", carbs: "FRIDA", fat: "FRIDA" },
        nutritionMissing: false,
        fridaEstimateId: "recipe",
      },
    });
    estimated += 1;
  }
  return estimated;
}

// Delte retter er snapshots. Et ingrediens-snapshot med 0 i alle makroer for
// en vare, der nu har Frida-skøn, stod med 0, fordi varen manglede næring —
// det udfyldes, og rettens totaler regnes igen.
type SharedIngredient = {
  productId?: string;
  grams?: number;
  kcalPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
};

async function refreshSharedRecipes(): Promise<number> {
  const estimated = await prisma.product.findMany({
    where: { fridaEstimateId: { not: null }, nutritionMissing: false },
    select: { id: true, kcalPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
  });
  if (!estimated.length) return 0;
  const byId = new Map(estimated.map((p) => [p.id, p]));
  const recipes = await prisma.sharedRecipe.findMany({ select: { id: true, ingredients: true } });
  let updated = 0;
  for (const recipe of recipes) {
    const ingredients = Array.isArray(recipe.ingredients) ? (recipe.ingredients as SharedIngredient[]) : [];
    let changed = false;
    const next = ingredients.map((i) => {
      const product = i.productId ? byId.get(i.productId) : undefined;
      const empty = !i.kcalPer100g && !i.proteinPer100g && !i.carbsPer100g && !i.fatPer100g;
      if (!product || !empty) return i;
      changed = true;
      return {
        ...i,
        kcalPer100g: product.kcalPer100g,
        proteinPer100g: product.proteinPer100g,
        carbsPer100g: product.carbsPer100g,
        fatPer100g: product.fatPer100g,
      };
    });
    if (!changed) continue;
    const sum = (field: "kcalPer100g" | "proteinPer100g" | "carbsPer100g" | "fatPer100g") =>
      next.reduce((acc, i) => acc + ((i[field] ?? 0) * (i.grams ?? 0)) / 100, 0);
    await prisma.sharedRecipe.update({
      where: { id: recipe.id },
      data: {
        ingredients: next as Prisma.InputJsonValue,
        kcal: sum("kcalPer100g"),
        protein: sum("proteinPer100g"),
        carbs: sum("carbsPer100g"),
        fat: sum("fatPer100g"),
      },
    });
    updated += 1;
  }
  return updated;
}

export async function runFridaEstimates() {
  const barcodes = await ensureStoreBarcodes();
  const frida = await loadFrida();
  if (!frida.rows.length) return { message: `Ingen Frida-varer i databasen; ${barcodes} stregkoder oprettet`, count: barcodes };
  const choices = await loadAdminChoices();
  const products = await estimateProducts(frida, choices);
  const recipes = await estimateRecipes(frida, choices);
  const shared = await refreshSharedRecipes();
  const message =
    `${products.filled} varer med Frida-skøn, ${products.review} til admin (${products.reviewGroups} grupper), ` +
    `${products.unmatched} uden match, ${products.reverted} skøn trukket tilbage, ` +
    `${recipes} retter regnet ud, ${shared} delte retter opdateret, ${barcodes} stregkoder oprettet`;
  return { message, count: products.filled + recipes + barcodes };
}

// Agenterne og admin beder om en kørsel ved at sætte runRequestedAt.
export async function requestFridaEstimatesRun() {
  await prisma.scheduledJob.upsert({
    where: { key: "frida-estimates" },
    create: { key: "frida-estimates", intervalMinutes: null, runAtTime: "02:30", runRequestedAt: new Date() },
    update: { runRequestedAt: new Date() },
  });
}
