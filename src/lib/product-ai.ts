import { sanitizeAiPhoto } from "@/lib/image-metadata";
type JsonSchema = Record<string, unknown>;

type StructuredVisionArgs = {
  photo: string;
  system: string;
  text: string;
  schemaName: string;
  schema: JsonSchema;
};

export function getProductVisionModel() {
  return process.env.OPENAI_PRODUCT_VISION_MODEL?.trim() || "gpt-5.6-terra";
}

type OpenAiResponsesPayload = {
  output_text?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
  id?: string;
};

function readOutputText(data: OpenAiResponsesPayload): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  for (const item of data.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }
  return null;
}

export async function callStructuredVision<T>({
  photo,
  system,
  text,
  schemaName,
  schema,
}: StructuredVisionArgs): Promise<{ value: T; model: string; responseId: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke sat");
  if (!photo.startsWith("data:image/") && !photo.startsWith("https://")) {
    throw new Error("photo skal være data:image/... eller https URL");
  }

  // docs/PRIVACY.md "AI": ingen metadata og ingen ID'er til OpenAI, og
  // svaret må ikke gemmes hos OpenAI (store: false).
  const cleanPhoto = sanitizeAiPhoto(photo);
  const model = getProductVisionModel();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: system }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text },
            { type: "input_image", image_url: cleanPhoto, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI-kald fejlede (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as OpenAiResponsesPayload;
  const output = readOutputText(data);
  if (!output) throw new Error("Intet struktureret svar fra OpenAI");

  return {
    value: JSON.parse(output) as T,
    model,
    responseId: typeof data.id === "string" ? data.id : null,
  };
}
