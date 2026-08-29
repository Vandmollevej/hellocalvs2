import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/ai/recognize-hellofresh — { photo: string (data URL) }
//
// Genkender hvilken af ugens HelloFresh-retter et foto af et tilberedt måltid
// mest sandsynligt viser, og kombinerer det med de næringsværdier
// scripts/hellofresh-import allerede har importeret for den ret (se
// docs/DECISIONS.md). "Ret nr." kan ikke bruges — det står kun på det
// fysiske opskriftskort ved levering, ikke på HelloFresh's hjemmeside — så
// billedgenkendelse er i stedet den primære indgang for HelloFresh-retter.

const RESPONSE_SCHEMA = {
  name: "hellofresh_match",
  schema: {
    type: "object",
    properties: {
      matchId: {
        type: ["string", "null"],
        description: "id'et for den bedst matchende ret fra listen, eller null hvis intet passer sandsynligt",
      },
      confidence: { type: "number", description: "0-1, hvor sikker du er på matchet" },
    },
    required: ["matchId", "confidence"],
    additionalProperties: false,
  },
  strict: true,
};

async function callOpenAi(photo: string, candidates: { id: string; name: string }[]) {
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
            "Du får et foto af et tilberedt måltid og en liste af HelloFresh-retter fra denne uges menu (id og navn). " +
            "Vælg den ret på listen, som billedet mest sandsynligt viser, ud fra rettens navn og typiske ingredienser/udseende. " +
            "Svar kun med et id fra listen, eller matchId=null hvis intet virker sandsynligt.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Denne uges retter:\n${candidates.map((c) => `${c.id}: ${c.name}`).join("\n")}`,
            },
            { type: "image_url", image_url: { url: photo } },
          ],
        },
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

  return JSON.parse(content) as { matchId: string | null; confidence: number };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";

  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo (data URL) er påkrævet" }, { status: 400 });
  }

  try {
    const candidates = await prisma.product.findMany({
      where: { externalSource: "HELLOFRESH", discontinued: false, status: "APPROVED" },
      select: { id: true, name: true },
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        product: null,
        confidence: 0,
        message: "Ingen HelloFresh-retter fundet endnu — prøv igen senere, når ugens menu er importeret.",
      });
    }

    const result = await callOpenAi(photo, candidates);
    const matched = result.matchId
      ? candidates.find((candidate) => candidate.id === result.matchId)
      : null;

    if (!matched) {
      return NextResponse.json({ product: null, confidence: result.confidence });
    }

    const product = await prisma.product.findUnique({ where: { id: matched.id } });
    return NextResponse.json({ product, confidence: result.confidence });
  } catch (error) {
    console.error("HelloFresh recognition failed", error);
    return NextResponse.json(
      { product: null, confidence: 0, message: "Genkendelse slog fejl" },
      { status: 503 }
    );
  }
}
