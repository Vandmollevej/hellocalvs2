import { sanitizeAiPhoto } from "@/lib/image-metadata";
import { recognizeMealPhoto as recognizeWithPassio, type PassioIngredient } from "@/lib/passio";

// Tallerken-scanning ("Måltid"-kameraet). MIDLERTIDIG DISPENSATION
// (docs/DECISIONS.md 2026-10-07): udbyderen er som standard OpenAI, indtil
// Passio er klar. Rul tilbage ved at sætte MEAL_PHOTO_PROVIDER=passio (eller
// slette denne fil og kalde passio.ts direkte fra analyze-meal-photo).

export type MealPhotoProvider = "openai" | "passio";

export function mealPhotoProvider(): MealPhotoProvider {
  return process.env.MEAL_PHOTO_PROVIDER?.trim().toLowerCase() === "passio" ? "passio" : "openai";
}

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
            ingredientName: { type: "string", description: "Dansk navn på ingrediensen/madvaren, fx 'kogte kartofler'" },
            weightGrams: { type: "number", description: "Estimeret vægt i gram af denne ingrediens på tallerkenen" },
            calories: { type: "number", description: "kcal for den estimerede mængde" },
            protein: { type: "number", description: "gram protein for den estimerede mængde" },
            fat: { type: "number", description: "gram fedt for den estimerede mængde" },
            carbs: { type: "number", description: "gram kulhydrat for den estimerede mængde" },
          },
          required: ["ingredientName", "weightGrams", "calories", "protein", "fat", "carbs"],
          additionalProperties: false,
        },
      },
    },
    required: ["ingredients"],
    additionalProperties: false,
  },
  strict: true,
};

async function recognizeWithOpenAi(photoDataUrl: string): Promise<PassioIngredient[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke sat");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Du ser et foto af en tallerken/et måltid. Del måltidet op i separate ingredienser (højst 10) og " +
            "estimér vægt i gram og næringsindhold for hver mængde på billedet. Brug almindelige danske " +
            "fødevarenavne. Hvis billedet ikke viser mad, returnér en tom liste.",
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
  const parsed = JSON.parse(content) as {
    ingredients: { ingredientName: string; weightGrams: number; calories: number; protein: number; fat: number; carbs: number }[];
  };

  return parsed.ingredients.map((item, index) => ({
    ingredientName: item.ingredientName,
    weightGrams: item.weightGrams,
    nutritionPreview: {
      calories: item.calories,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      servingWeight: item.weightGrams,
    },
    refCode: `openai-${index}`,
  }));
}

export async function recognizeMealPhoto(photoDataUrl: string): Promise<PassioIngredient[]> {
  return mealPhotoProvider() === "passio" ? recognizeWithPassio(photoDataUrl) : recognizeWithOpenAi(photoDataUrl);
}
