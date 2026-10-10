import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { parseIngredientLine, parseRecipeText, type ParsedRecipe } from "@/lib/recipe-text-parser";
import { findKitchenConversion } from "@/lib/kitchen-conversions";
import { volumeToGrams } from "@/lib/kitchen-conversion-units";
import { fetchSourceImage } from "@/lib/recipe-source-image";
import { aiParseRecipe } from "@/lib/recipe-import-ai";

// POST /api/dishes/parse-text — { text, sourceUrl? }
//
// Robot 1 under Retter → Indsæt tekst / Scan: tolker en komplet opskriftstekst
// straks og finder hver ingrediens i produktdatabasen. Skriver intet; brugeren
// ser resultatet i opret-ret-siden og gemmer selv. Ingredienser uden et sikkert
// produktmatch returneres som "unmatched", så brugeren kan søge dem manuelt.

const MAX_TEXT = 20_000;

function nameWords(value: string) {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Kun et sikkert match tæller (som i interpret-meal): hvert ord skal stå som et
// helt ord i produktnavnet; færrest ekstra ord vinder.
async function findProduct(name: string) {
  const words = nameWords(name)
    .filter((word) => word.length > 1)
    .slice(0, 4);
  if (words.length === 0) return null;
  const candidates = await prisma.product.findMany({
    where: {
      AND: words.map((word) => ({
        name: { contains: word, mode: "insensitive" as const },
      })),
      discontinued: false,
      nutritionMissing: false,
      status: "APPROVED",
      privateOwnerId: null,
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      kcalPer100g: true,
      proteinPer100g: true,
      carbsPer100g: true,
      fatPer100g: true,
    },
    take: 60,
  });
  let best: (typeof candidates)[number] | null = null;
  let bestExtra = Infinity;
  for (const candidate of candidates) {
    const candidateWords = nameWords(candidate.name);
    if (!words.every((word) => candidateWords.includes(word))) continue;
    const extra = candidateWords.length - words.length;
    if (extra < bestExtra) {
      best = candidate;
      bestExtra = extra;
    }
  }
  return best;
}

// Rumfang (dl, spsk, tsk …) regnes om med omregningstabellen
// (src/lib/kitchen-conversions.ts), så "2 dl hvedemel" bliver 120 g og ikke
// 200 g. Gælder både AI'ens og den regelbaserede tolkers mængder.
function tableGrams(raw: string, name: string): number | null {
  const line = parseIngredientLine(raw);
  if (line.amount === null) return null;
  const item = findKitchenConversion(name) ?? findKitchenConversion(line.name);
  const grams = item ? volumeToGrams(line.amount, line.unit, item) : null;
  return grams === null ? null : Math.round(grams * 10) / 10;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as {
    text?: unknown;
    pages?: unknown;
    sourceUrl?: unknown;
    language?: unknown;
  } | null;
  // Scan sender teksten pr. side (så AI'en kan pege på det rigtige sidebillede).
  const pages = Array.isArray(body?.pages)
    ? (body.pages as unknown[])
        .filter((page): page is string => typeof page === "string")
        .slice(0, 12)
    : [];
  const text = (typeof body?.text === "string" ? body.text : pages.join("\n\n"))
    .trim()
    .slice(0, MAX_TEXT);
  if (!text)
    return NextResponse.json({ message: "Teksten er tom" }, { status: 400 });
  const language =
    typeof body?.language === "string" ? body.language.slice(0, 5) : "da";
  const sourceUrl =
    typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";

  // AI først (hvis opsat); ellers eller ved fejl den regelbaserede tolker.
  const ai = await aiParseRecipe(
    user.id,
    pages.length > 0 ? pages : [text],
    language,
  );
  const parsed: ParsedRecipe = ai
    ? {
        title: ai.title,
        servings: ai.servings,
        ingredients: ai.ingredients.map((i) => ({
          raw: i.raw,
          name: i.name,
          amount: null,
          unit: null,
          grams: i.grams,
        })),
        steps: ai.steps.map((step) => step.text),
        nutrition: ai.nutrition,
      }
    : parseRecipeText(text);
  try {
    const [matches, image] = await Promise.all([
      Promise.all(
        parsed.ingredients.map((ingredient) => findProduct(ingredient.name)),
      ),
      sourceUrl ? fetchSourceImage(sourceUrl) : Promise.resolve(null),
    ]);
    const ingredients = parsed.ingredients.map((ingredient, index) => ({
      ...ingredient,
      grams: tableGrams(ingredient.raw, ingredient.name) ?? ingredient.grams,
      product: matches[index],
    }));
    return NextResponse.json({
      title: parsed.title,
      servings: parsed.servings,
      steps: parsed.steps,
      nutrition: parsed.nutrition,
      description: ai?.description ?? null,
      durationMinutes: ai?.durationMinutes ?? null,
      // AI: hvilken side (1-baseret) hvert trin og forsiden hører til.
      stepTitles: ai ? ai.steps.map((step) => step.title) : null,
      stepPages: ai ? ai.steps.map((step) => step.imagePage) : null,
      coverPage: ai?.coverImagePage ?? null,
      ingredients,
      image,
    });
  } catch (error) {
    console.error("Recipe text parsing failed", error);
    return NextResponse.json(
      { message: "Database ikke tilgængelig" },
      { status: 503 },
    );
  }
}
