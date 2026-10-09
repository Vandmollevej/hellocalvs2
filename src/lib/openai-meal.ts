import { sanitizeAiPhoto } from "@/lib/image-metadata";
import type { PassioIngredient } from "@/lib/passio";

// Midlertidig erstatning for Passio i "Måltid"-kameraet (mode=meal): sender
// tallerken-fotoet til OpenAI vision og returnerer samme form som Passio
// (PassioIngredient), så /api/ai/analyze-meal-photo kan bruge begge uændret.
// Vælges automatisk, når PASSIO_API_KEY mangler, eller med
// MEAL_SCAN_PROVIDER=openai (se docs/DECISIONS.md).

const RESPONSE_SCHEMA = {
  name: "meal_ingredients",
  schema: {
    type: "object",
    properties: {
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Ingrediensens navn på dansk, fx 'kyllingebryst'" },
            weightGrams: { type: "number", description: "Estimeret vægt i gram af den viste portion" },
            kcalPer100g: { type: "number" },
            proteinPer100g: { type: "number" },
            carbsPer100g: { type: "number" },
            fatPer100g: { type: "number" },
          },
          required: ["name", "weightGrams", "kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g"],
          additionalProperties: false,
        },
      },
    },
    required: ["ingredients"],
    additionalProperties: false,
  },
  strict: true,
};

type OpenAiIngredient = {
  name: string;
  weightGrams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export async function recognizeMealPhotoWithOpenAi(photoDataUrl: string): Promise<PassioIngredient[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke sat");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MEAL_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Du får et foto af én tallerken set ovenfra. Del måltidet op i enkeltingredienser (sauce, dressing og olie som egne ingredienser) " +
            "og estimér vægten i gram af hver ingrediens samt næringsindhold pr. 100 g. " +
            "Ignorér bestik, servietter, tallerkenen og drikkevarer. Gæt ikke på ting, du ikke kan se. " +
            "Er der ingen mad på billedet, returnér en tom liste.",
        },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: sanitizeAiPhoto(photoDataUrl) } }],
        },
      ],
      response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI-kald fejlede (${res.status}): ${await res.text()}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Intet svar fra AI");

  const parsed = JSON.parse(content) as { ingredients: OpenAiIngredient[] };
  return parsed.ingredients.map((item) => {
    const weightGrams = Math.max(0, item.weightGrams);
    const factor = weightGrams / 100;
    return {
      ingredientName: item.name,
      weightGrams,
      nutritionPreview: {
        calories: item.kcalPer100g * factor,
        protein: item.proteinPer100g * factor,
        carbs: item.carbsPer100g * factor,
        fat: item.fatPer100g * factor,
        servingWeight: weightGrams,
      },
      refCode: "",
    };
  });
}
