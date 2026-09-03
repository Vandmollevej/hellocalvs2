import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/ai/recognize-product-photo — { photo: string (data URL) }
//
// Sidste udvej i det tekstløse spor af /camera/create: lokal billed-hash-match
// (src/lib/image-similarity.ts) forsøges altid først i klienten. Kun når den
// ikke finder noget med tilstrækkelig sikkerhed, kaldes denne route, som
// bruger AI udelukkende til selve billedgenkendelsen (samme mønster som
// /api/ai/recognize-hellofresh). Kræver mindst 95% sikkerhed for at gælde
// som et fund; ellers foreslås blot navn/mærke/kategori som udgangspunkt for
// den manuelle opret-side.

const RESPONSE_SCHEMA = {
  name: "product_photo_match",
  schema: {
    type: "object",
    properties: {
      matchId: {
        type: ["string", "null"],
        description: "id for det bedst matchende produkt fra listen, eller null hvis intet passer sikkert",
      },
      confidence: { type: "number", description: "0-1, hvor sikker du er på matchet" },
      guessedName: { type: ["string", "null"], description: "Gæt på produktnavn, hvis intet match findes" },
      guessedBrand: { type: ["string", "null"], description: "Gæt på mærke, hvis synligt og intet match findes" },
    },
    required: ["matchId", "confidence", "guessedName", "guessedBrand"],
    additionalProperties: false,
  },
  strict: true,
};

async function callOpenAi(photo: string, candidates: { id: string; name: string }[]) {
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
            "Du får et foto af en dagligvare (typisk en frugt, grøntsag eller emballeret produkt uden læsbar tekst) og en " +
            "liste af kendte produkter (id og navn). Vælg det produkt på listen, som billedet mest sandsynligt viser. " +
            "Svar kun med et id fra listen og en konfidensscore 0-1 — brug KUN høj konfidens (>=0.95), hvis du er meget " +
            "sikker. Hvis intet match er sandsynligt, sæt matchId=null og gæt i stedet produktnavn/mærke ud fra billedet, " +
            "hvis det er tydeligt (ellers null).",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Kendte produkter:\n${candidates.map((c) => `${c.id}: ${c.name}`).join("\n")}` },
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
  return JSON.parse(content) as {
    matchId: string | null;
    confidence: number;
    guessedName: string | null;
    guessedBrand: string | null;
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo (data URL) er påkrævet" }, { status: 400 });
  }

  try {
    const candidates = await prisma.product.findMany({
      where: { discontinued: false, status: "APPROVED" },
      select: { id: true, name: true },
      take: 300,
      orderBy: { createdAt: "desc" },
    });

    const result = await callOpenAi(photo, candidates);
    const matchedCandidate =
      result.matchId && result.confidence >= 0.95
        ? candidates.find((c) => c.id === result.matchId)
        : undefined;

    if (!matchedCandidate) {
      return NextResponse.json({
        product: null,
        confidence: result.confidence,
        guess: { name: result.guessedName, brand: result.guessedBrand },
      });
    }

    const product = await prisma.product.findUnique({ where: { id: matchedCandidate.id } });
    return NextResponse.json({ product, confidence: result.confidence, guess: null });
  } catch (error) {
    console.error("Product photo recognition failed", error);
    return NextResponse.json(
      { product: null, confidence: 0, guess: null, message: "Genkendelse slog fejl" },
      { status: 503 }
    );
  }
}
