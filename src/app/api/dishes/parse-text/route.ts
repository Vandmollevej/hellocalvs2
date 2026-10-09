import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { parseRecipeText, type ParsedRecipe } from "@/lib/recipe-text-parser";
import { fetchSourceImage } from "@/lib/recipe-source-image";

// POST /api/dishes/parse-text — { text, sourceUrl? }
//
// Robot 1 under Retter → Indsæt tekst / Scan: tolker en komplet opskriftstekst
// straks og finder hver ingrediens i produktdatabasen. Skriver intet; brugeren
// ser resultatet i opret-ret-siden og gemmer selv. Ingredienser uden et sikkert
// produktmatch returneres som "unmatched", så brugeren kan søge dem manuelt.

const MAX_TEXT = 20_000;

function nameWords(value: string) {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// Kun et sikkert match tæller (som i interpret-meal): hvert ord skal stå som et
// helt ord i produktnavnet; færrest ekstra ord vinder.
async function findProduct(name: string) {
  const words = nameWords(name).filter((word) => word.length > 1).slice(0, 4);
  if (words.length === 0) return null;
  const candidates = await prisma.product.findMany({
    where: {
      AND: words.map((word) => ({ name: { contains: word, mode: "insensitive" as const } })),
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

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => null)) as { text?: unknown; sourceUrl?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  if (!text) return NextResponse.json({ message: "Teksten er tom" }, { status: 400 });
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";

  const parsed: ParsedRecipe = parseRecipeText(text);
  try {
    const [matches, image] = await Promise.all([
      Promise.all(parsed.ingredients.map((ingredient) => findProduct(ingredient.name))),
      sourceUrl ? fetchSourceImage(sourceUrl) : Promise.resolve(null),
    ]);
    const ingredients = parsed.ingredients.map((ingredient, index) => ({ ...ingredient, product: matches[index] }));
    return NextResponse.json({
      title: parsed.title,
      servings: parsed.servings,
      steps: parsed.steps,
      nutrition: parsed.nutrition,
      ingredients,
      image,
    });
  } catch (error) {
    console.error("Recipe text parsing failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
