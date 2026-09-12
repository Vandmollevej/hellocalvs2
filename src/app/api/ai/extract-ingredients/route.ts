import { NextResponse } from "next/server";

// POST /api/ai/extract-ingredients — { text: string, targetLang: "da" | "en" }
//
// Ingrediens-boksen i CreateProductMediaGrid: lokal gratis OCR (tesseract.js,
// src/lib/product-ocr.ts) læser altid billedet i klienten først, i det sprog
// brugerens REGION forventer (docs/DECISIONS.md 2026-09-12 — EU-lovkrav om
// lokalsprog på fødevaredeklarationer, uanset telefonens visningssprog).
// Denne route kaldes kun for at OVERSÆTTE den fundne tekst til appens
// UI-sprog. Den må ALDRIG selv genkende/gætte ingredienser eller slå
// produktet op andetsteds fra — kun oversætte den tekst, der faktisk stod på
// billedet, ordret.

async function callOpenAi(text: string, targetLang: "da" | "en"): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke sat");

  const targetLabel = targetLang === "da" ? "dansk" : "engelsk";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            `Du oversætter en indholdsfortegnelse fra en fødevareemballage til ${targetLabel}. Oversæt KUN den givne ` +
            "tekst ordret — gæt eller tilføj aldrig ingredienser, der ikke står i teksten, og fjern ikke procenttal, " +
            "allergen-fremhævninger eller kommaseparering. Svar udelukkende med den oversatte tekst, intet andet.",
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI-kald fejlede (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error("Intet svar fra AI");
  return translated as string;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const targetLang = body?.targetLang === "en" ? "en" : "da";
  if (!text) {
    return NextResponse.json({ message: "text er påkrævet" }, { status: 400 });
  }

  try {
    const translated = await callOpenAi(text, targetLang);
    return NextResponse.json({ text: translated });
  } catch (error) {
    console.error("Ingredient translation failed", error);
    return NextResponse.json({ text: null, message: "Kunne ikke oversætte indholdsfortegnelsen" }, { status: 503 });
  }
}
