import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recognizeMealPhoto } from "@/lib/passio";

// POST /api/ai/analyze-meal-photo — { photo: string (data URL) }
//
// Backend for the "Måltid" camera flow (mode=meal, se docs/AI.md
// "Måltidsanalyse"): sender tallerken-fotoet til Passio Nutrition-AI, som
// opdeler det i ingredienser med estimeret gram og makroer. Hver ingrediens
// slås derefter op i vores egen produktdatabase (samme princip som
// /api/ai/interpret-meal); kun uden lokalt match bruges Passios eget
// næringsestimat, tydeligt markeret som sådan. Skriver aldrig noget selv —
// klienten gemmer via /api/registrations, når brugeren har gennemset/rettet.

async function findLocalMatch(name: string) {
  const firstWord = name.trim().split(/\s+/)[0];
  if (!firstWord) return null;

  return prisma.product.findFirst({
    where: {
      name: { contains: firstWord, mode: "insensitive" },
      discontinued: false,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo (data URL) er påkrævet" }, { status: 400 });
  }

  try {
    const ingredients = await recognizeMealPhoto(photo);

    const items = await Promise.all(
      ingredients.map(async (ingredient) => {
        const weightGrams = Math.max(0, Math.round(ingredient.weightGrams));
        const factor = weightGrams / 100;
        const localMatch = await findLocalMatch(ingredient.ingredientName);

        if (localMatch) {
          return {
            title: localMatch.name,
            amountGrams: weightGrams,
            amountLabel: `${weightGrams} g`,
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
          title: ingredient.ingredientName,
          amountGrams: weightGrams,
          amountLabel: `${weightGrams} g`,
          kcal: Math.round(ingredient.nutritionPreview.calories),
          protein: Math.round(ingredient.nutritionPreview.protein),
          carbs: Math.round(ingredient.nutritionPreview.carbs),
          fat: Math.round(ingredient.nutritionPreview.fat),
          productId: null,
          image: null,
          estimated: true,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Meal photo analysis failed", error);
    return NextResponse.json({ items: [], message: "AI-analyse af måltidet slog fejl" }, { status: 503 });
  }
}
