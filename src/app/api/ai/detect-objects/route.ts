import { NextResponse } from "next/server";
import { sanitizeAiPhoto } from "@/lib/image-metadata";
import { normalizeObjectBoxes, type ObjectBox } from "@/lib/object-picker";

// POST /api/ai/detect-objects — { photo: string (data URL) }
//
// Finder de fødevarer/produkter, der tydeligt ses i et kamerabillede, som
// normaliserede bokse (0-1). Kameraet markerer dem med grønne cirkler, når der
// er mere end ét, så brugeren kan trykke på det objekt, billedet skal handle
// om (docs/AI.md "Intelligent kameravisning"). Fejl giver blot en tom liste —
// kameraet fortsætter så med hele billedet.

const RESPONSE_SCHEMA = {
  name: "detected_objects",
  schema: {
    type: "object",
    properties: {
      objects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Kort navn på objektet" },
            x: { type: "number", description: "Venstre kant, 0-1 af billedets bredde" },
            y: { type: "number", description: "Øverste kant, 0-1 af billedets højde" },
            width: { type: "number", description: "Bredde, 0-1 af billedets bredde" },
            height: { type: "number", description: "Højde, 0-1 af billedets højde" },
          },
          required: ["label", "x", "y", "width", "height"],
          additionalProperties: false,
        },
      },
    },
    required: ["objects"],
    additionalProperties: false,
  },
  strict: true,
};

async function callOpenAi(photo: string): Promise<ObjectBox[]> {
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
            "Find de separate fødevarer, madpakninger, tallerkener og drikkevarer, der tydeligt ses i billedet. " +
            "Returnér højst 6, hver med en afgrænsende boks i normaliserede koordinater (0-1). " +
            "Medtag ikke baggrund, hænder, møbler eller små dele af samme objekt.",
        },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: sanitizeAiPhoto(photo) } }],
        },
      ],
      response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
    }),
  });

  if (!res.ok) throw new Error(`OpenAI-kald fejlede (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Intet svar fra AI");
  return (JSON.parse(content) as { objects: ObjectBox[] }).objects;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const photo = typeof body?.photo === "string" ? body.photo : "";
  if (!photo.startsWith("data:image/")) {
    return NextResponse.json({ message: "photo (data URL) er påkrævet" }, { status: 400 });
  }

  try {
    return NextResponse.json({ objects: normalizeObjectBoxes(await callOpenAi(photo)) });
  } catch (error) {
    console.error("Object detection failed", error);
    return NextResponse.json({ objects: [] });
  }
}
