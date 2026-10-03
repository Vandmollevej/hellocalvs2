import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMealInputLanguage, isMealInputLanguageCode, type MealInputLanguage } from "@/lib/meal-input-language";

// POST /api/ai/interpret-meal — { transcript: string, language?: "da" | "sv" | … }
//
// `language` er sproget brugeren har valgt med flaget på tale-/chat-siden
// (brugerens krav 2026-10-02): teksten tolkes KUN som det sprog, med engelsk
// som eneste fallback (mange varer hedder noget på engelsk). Mangler den,
// bruges dansk som før.
//
// Converts Danish speech input into food items and amounts, per docs/AI.md
// ("Danish speech input for meal logging ... AI converts to amounts that
// the user can correct"). Never writes anything to the database itself — AI
// only suggests, the user approves/corrects in the UI and saves explicitly
// via /api/registrations.
//
// For each recognized food item, we first look it up in our own database
// (same principle as the barcode flow); only without a match are the AI's
// own macro estimates used, clearly marked as an estimate.

type AiItem = {
  name: string;
  amountGrams: number;
  amountLabel: string;
  estimatedKcalPer100g: number;
  estimatedProteinPer100g: number;
  estimatedCarbsPer100g: number;
  estimatedFatPer100g: number;
};

const RESPONSE_SCHEMA = {
  name: "meal_items",
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Madvarens navn på det valgte sprog (eller engelsk, hvis varen hedder sådan), uden mængde" },
            amountGrams: { type: "number", description: "Bedste estimat af mængden i gram" },
            amountLabel: { type: "string", description: "Kort, menneskelæsbar mængde, fx '2 skiver' eller '8 g'" },
            estimatedKcalPer100g: { type: "number" },
            estimatedProteinPer100g: { type: "number" },
            estimatedCarbsPer100g: { type: "number" },
            estimatedFatPer100g: { type: "number" },
          },
          required: [
            "name",
            "amountGrams",
            "amountLabel",
            "estimatedKcalPer100g",
            "estimatedProteinPer100g",
            "estimatedCarbsPer100g",
            "estimatedFatPer100g",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  strict: true,
};

function systemPrompt(language: MealInputLanguage): string {
  const name = language.englishName;
  const englishFallback =
    language.code === "en"
      ? `The input is in English only. Do not interpret words as any other language.`
      : `The input is in ${name}. Interpret it ONLY as ${name}, with English as the single fallback: ` +
        `many foods and products are called something in English (e.g. "cornflakes", "peanut butter", "smoothie"), ` +
        `so English words are accepted. Never interpret words as any other language, and never translate from one.`;
  return (
    `You turn a ${name} description of a meal into a list of foods with amounts in grams. ` +
    englishFallback +
    ` Write each food name in ${name}, unless the food is normally called by its English name, then keep the English name. ` +
    "Split composite dishes into individual ingredients. Use typical portion sizes for vague amounts " +
    "(e.g. 'a little butter' ≈ 8 g, 'a thick layer of roast beef' ≈ 40 g). Write amountLabel in " +
    `${name}. Also estimate realistic nutrition values per 100 g for each ingredient, as a fallback guess.`
  );
}

async function callOpenAi(transcript: string, language: MealInputLanguage): Promise<AiItem[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke sat");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt(language),
        },
        { role: "user", content: transcript },
      ],
      response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI-kald fejlede (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Intet svar fra AI");

  const parsed = JSON.parse(content) as { items: AiItem[] };
  return parsed.items;
}

function nameWords(value: string) {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// Kun et sikkert match tæller: hvert ord fra AI-navnet skal stå som et helt ord
// i produktnavnet ("pålæg" må ikke ramme "smørepålæg"). Hellere intet match
// (AI-estimatet bruges) end et produkt, der ikke giver mening.
async function findLocalMatch(name: string) {
  const words = nameWords(name);
  if (words.length === 0) return null;

  const candidates = await prisma.product.findMany({
    where: {
      AND: words.map((word) => ({
        OR: [
          { name: { equals: word, mode: "insensitive" as const } },
          { name: { startsWith: `${word} `, mode: "insensitive" as const } },
          { name: { endsWith: ` ${word}`, mode: "insensitive" as const } },
          { name: { contains: ` ${word} `, mode: "insensitive" as const } },
        ],
      })),
      discontinued: false,
      nutritionMissing: false,
      status: "APPROVED",
    },
    include: { brand: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Færrest ekstra ord = tættest på det, brugeren skrev.
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
  const body = await req.json().catch(() => null);
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  const language = getMealInputLanguage(isMealInputLanguageCode(body?.language) ? body.language : "da");

  if (!transcript) {
    return NextResponse.json({ message: "transcript er påkrævet" }, { status: 400 });
  }

  try {
    const aiItems = await callOpenAi(transcript, language);

    const items = await Promise.all(
      aiItems.map(async (aiItem) => {
        const factor = aiItem.amountGrams / 100;
        const localMatch = await findLocalMatch(aiItem.name);

        if (localMatch) {
          return {
            title: localMatch.name,
            amountGrams: aiItem.amountGrams,
            amountLabel: aiItem.amountLabel,
            kcal: Math.round(localMatch.kcalPer100g * factor),
            protein: Math.round(localMatch.proteinPer100g * factor),
            carbs: Math.round(localMatch.carbsPer100g * factor),
            fat: Math.round(localMatch.fatPer100g * factor),
            productId: localMatch.id,
            image: localMatch.imageUrl,
            estimated: false,
          };
        }

        return {
          title: aiItem.name,
          amountGrams: aiItem.amountGrams,
          amountLabel: aiItem.amountLabel,
          kcal: Math.round(aiItem.estimatedKcalPer100g * factor),
          protein: Math.round(aiItem.estimatedProteinPer100g * factor),
          carbs: Math.round(aiItem.estimatedCarbsPer100g * factor),
          fat: Math.round(aiItem.estimatedFatPer100g * factor),
          productId: null,
          image: null,
          estimated: true,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Meal interpretation failed", error);
    return NextResponse.json(
      { items: [], message: "AI-tolkning slog fejl" },
      { status: 503 }
    );
  }
}
