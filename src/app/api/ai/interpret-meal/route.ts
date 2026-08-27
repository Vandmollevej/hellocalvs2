import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/ai/interpret-meal — { transcript: string }
//
// Omsætter dansk taleinput til madvarer og mængder, jf. docs/AI.md
// ("Dansk taleinput til madlogning ... AI omsætter til mængder, som
// brugeren kan rette"). Skriver aldrig noget til databasen selv — AI
// foreslår kun, brugeren godkender/retter i UI'et og gemmer eksplicit
// via /api/registrations.
//
// For hver genkendt madvare slås der først op i vores egen database
// (samme princip som stregkode-flowet); kun uden match bruges AI'ens
// egne makro-estimater, tydeligt markeret som estimat.

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
            name: { type: "string", description: "Madvarens navn på dansk, uden mængde" },
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

async function callOpenAi(transcript: string): Promise<AiItem[]> {
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
          content:
            "Du hjælper med at omsætte dansk taleinput om et måltid til en liste af madvarer med mængder i gram. " +
            "Del sammensatte retter op i enkelte ingredienser. Brug typiske portionsstørrelser for vage mængder " +
            "(fx 'lidt smør' ≈ 8 g, 'et tykt lag roastbeef' ≈ 40 g). Estimér også realistiske næringsværdier " +
            "pr. 100 g for hver ingrediens, som et fallback-gæt.",
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

async function findLocalMatch(name: string) {
  const firstWord = name.trim().split(/\s+/)[0];
  if (!firstWord) return null;

  return prisma.product.findFirst({
    where: {
      name: { contains: firstWord, mode: "insensitive" },
      discontinued: false,
      status: "APPROVED",
    },
    include: { brand: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";

  if (!transcript) {
    return NextResponse.json({ message: "transcript er påkrævet" }, { status: 400 });
  }

  try {
    const aiItems = await callOpenAi(transcript);

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
