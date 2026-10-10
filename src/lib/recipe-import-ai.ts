// Server-only: AI-opsætning af en opskrift (Indsæt tekst / Scan opskrift).
// Prompt og skema: src/lib/recipe-import-prompt.ts. Kun tekst sendes (aldrig
// billeder), store:false og ingen personoplysninger, som chatbotten
// (docs/PRIVACY.md "AI"). Returnerer null, hvis nøglen mangler, grænsen er
// nået eller kaldet fejler, så kalderen falder tilbage på den regelbaserede
// tolker.

import {
  RECIPE_IMPORT_SCHEMA,
  RECIPE_IMPORT_SYSTEM_PROMPT,
  buildRecipeImportInput,
  parseRecipeImportResponse,
  type RecipeImportAi,
} from "@/lib/recipe-import-prompt";

const DAILY_LIMIT = 20;
const usage = new Map<string, { day: string; count: number }>();

// Blød grænse pr. bruger pr. døgn (i hukommelsen; nulstilles ved genstart).
function underLimit(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const current = usage.get(userId);
  const entry = current && current.day === day ? current : { day, count: 0 };
  if (entry.count >= DAILY_LIMIT) return false;
  entry.count += 1;
  usage.set(userId, entry);
  return true;
}

export async function aiParseRecipe(
  userId: string,
  pages: string[],
  language: string,
): Promise<RecipeImportAi | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || pages.every((page) => !page.trim()) || !underLimit(userId))
    return null;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_RECIPE_IMPORT_MODEL?.trim() || "gpt-4o-mini",
        store: false,
        instructions: RECIPE_IMPORT_SYSTEM_PROMPT,
        input: buildRecipeImportInput(pages, language),
        text: {
          format: {
            type: "json_schema",
            name: "recipe",
            schema: RECIPE_IMPORT_SCHEMA,
            strict: true,
          },
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const data = (await response.json()) as {
      output_text?: string;
      output?: { content?: { type?: string; text?: string }[] }[];
    };
    const text =
      data.output_text ??
      data.output
        ?.flatMap((item) => item.content ?? [])
        .find((c) => c.type === "output_text")?.text ??
      null;
    if (!text) return null;
    const parsed = parseRecipeImportResponse(JSON.parse(text), pages.length);
    return parsed && parsed.ingredients.length > 0 ? parsed : null;
  } catch (error) {
    console.error("Recipe AI import failed", error);
    return null;
  }
}
