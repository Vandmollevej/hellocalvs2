import { NextResponse } from "next/server";

// POST /api/ai/extract-nutrition — { photo: string (data URL af næringsdeklaration) }
//
// Sidste udvej i næringsindhold-trinnet af /camera/create: den lokale, gratis
// regex-parsing (src/lib/product-ocr.ts, parseNutritionText) forsøges altid
// først på tesseract.js's OCR-tekst i klienten. Kun når regex ikke kan
// udlede alle fire pr.-100g-værdier, kaldes denne route, som bruger AI til
// at læse billedet direkte og strukturere det korrekt.

const RESPONSE_SCHEMA = {
  name: "nutrition_extraction",
  schema: {
    type: "object",
    properties: {
      kcalPer100g: { type: ["number", "null"] },
      proteinPer100g: { type: ["number", "null"] },
      carbsPer100g: { type: ["number", "null"] },
      fatPer100g: { type: ["number", "null"] },
    },
    required: ["kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g"],
    additionalProperties: false,
  },
  strict: true,
};

type NutritionResult = {
  kcalPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
};

async function callOpenAi(photo: string): Promise<NutritionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke sat");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Du får et foto af en næringsdeklaration fra en fødevareemballage. Læs værdierne for energi (kcal), " +
            "protein, kulhydrat og fedt PR. 100 GRAM/ML (ikke pr. portion). Hvis et tal ikke tydeligt kan læses, " +
            "sæt det til null i stedet for at gætte.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Aflæs næringsværdierne pr. 100g/100ml fra billedet." },
            { type: "image_url", image_url: { url: photo } },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI-kald fejlede (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Intet svar fra AI");
  return JSON.parse(content) as NutritionResult;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo (data URL) er påkrævet" }, { status: 400 });
  }

  try {
    const result = await callOpenAi(photo);
    return NextResponse.json({ values: result });
  } catch (error) {
    console.error("AI nutrition extraction failed", error);
    return NextResponse.json({ values: null, message: "Kunne ikke læse næringsindholdet" }, { status: 503 });
  }
}
