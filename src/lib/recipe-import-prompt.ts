// Prompt og svarskema til AI-opsætning af en opskrift i Opret ret →
// Indsæt tekst / Scan opskrift (forberedt 2026-10-09, IKKE koblet på endnu;
// se docs/DECISIONS.md 2026-10-09 "AI-opsætning af opskrifter").
//
// Princip (holder prisen nede): AI'en får KUN tekst. Trykt tekst er allerede
// læst af telefonens egen OCR, og kun håndskrift læses som billede af
// /api/dishes/ocr-handwriting. Billeder sendes aldrig til opsætningen; AI'en
// peger i stedet på en side ("imagePage") ud fra [[SIDE n]]-markørerne, og
// klienten sætter det rigtige sidebillede ind ved trinnet.
//
// Brug (Responses API, samme opsætning som chatbotten: store:false, kun tekst):
//   model: OPENAI_RECIPE_IMPORT_MODEL ?? "gpt-4o-mini"
//   instructions: RECIPE_IMPORT_SYSTEM_PROMPT
//   input: buildRecipeImportInput(pages, language)
//   text.format: { type: "json_schema", name: "recipe", strict: true, schema: RECIPE_IMPORT_SCHEMA }
// Svaret tolkes af parseRecipeImportResponse; ingredienserne slås derefter op
// i produktdatabasen som i dag (findProduct i parse-text-ruten).

export const RECIPE_IMPORT_SYSTEM_PROMPT = `You turn the raw text of a recipe into structured data for a food-tracking app. The text comes from pasted text or from scanned pages (OCR), so it can contain page numbers, ads, headers, line-break errors and OCR mistakes. Pages are separated by markers like [[SIDE 1]], [[SIDE 2]].

Rules:
1. Never invent anything. Use only what the text says. If a value is not stated, return null (or an empty list). Fix obvious OCR typos in words, but never change quantities.
2. Keep the recipe's own language for title, description and steps. Do not translate.
3. title: the dish name only, without author, site name or "opskrift".
4. description: at most two short sentences taken from the text's own intro. null if the text has no intro. Do not write marketing copy.
5. servings: number of people/portions if stated, else null. durationMinutes: total time in minutes only if the text states it (add prep + cooking when both are given), else null.
6. ingredients: one entry per ingredient, in the order of the text.
   - raw: the line exactly as written.
   - name: the generic product name in singular, lower case, without quantity, brand, preparation or adjectives that are not part of the product (e.g. "2 fed hakket hvidløg" -> "hvidløg"; "250 g hakket oksekød 8-12%" -> "hakket oksekød"). Keep words that change the product (e.g. "fløde", "letmælk", "rød peber").
   - grams: the amount in grams. Convert common units: 1 dl = 100 g for liquids and 60 g for flour; 1 spsk = 15 g (liquid) or 10 g (dry); 1 tsk = 5 g; 1 stk/fed/skive only if the text gives the weight, otherwise estimate a typical weight. Set gramsEstimated = true whenever you converted from a non-weight unit or estimated; false when the text gives grams or kg. Use null if no amount can be derived (e.g. "salt og peber efter smag").
   - Ingredient group headings (e.g. "Til saucen:") are not ingredients; use them in "group" for the lines that follow, else null.
7. steps: the method as separate steps in order, one action block per step (split long paragraphs, merge fragments broken by line breaks). title: a short heading only if the text has one for that step, else "". text: the step text, clean and complete, no step numbers.
8. Pictures: for each step set imagePage to the page number (from the [[SIDE n]] markers) that holds that step and has its own photo, if the text indicates a photo there (e.g. "se billede", captions, "Foto"); otherwise null. Set coverImagePage to the page of the finished-dish photo if indicated, else null. The app, not you, places the actual images.
9. nutrition: per portion or per 100 g only if the text prints a nutrition table; perServing = true when given per portion. Otherwise null.
10. warnings: short notes about anything you were unsure about (unreadable lines, ambiguous amounts), in the recipe's language. Empty list if none.

Answer with JSON that matches the schema and nothing else.`;

const nullable = (type: string) => ({ type: [type, "null"] });

export const RECIPE_IMPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "servings",
    "durationMinutes",
    "ingredients",
    "steps",
    "coverImagePage",
    "nutrition",
    "warnings",
  ],
  properties: {
    title: { type: "string" },
    description: nullable("string"),
    servings: nullable("integer"),
    durationMinutes: nullable("integer"),
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["raw", "name", "grams", "gramsEstimated", "group"],
        properties: {
          raw: { type: "string" },
          name: { type: "string" },
          grams: nullable("number"),
          gramsEstimated: { type: "boolean" },
          group: nullable("string"),
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "text", "imagePage"],
        properties: {
          title: { type: "string" },
          text: { type: "string" },
          imagePage: nullable("integer"),
        },
      },
    },
    coverImagePage: nullable("integer"),
    nutrition: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["kcal", "protein", "carbs", "fat", "perServing"],
      properties: {
        kcal: nullable("number"),
        protein: nullable("number"),
        carbs: nullable("number"),
        fat: nullable("number"),
        perServing: { type: "boolean" },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

export type RecipeImportAi = {
  title: string;
  description: string | null;
  servings: number | null;
  durationMinutes: number | null;
  ingredients: {
    raw: string;
    name: string;
    grams: number | null;
    gramsEstimated: boolean;
    group: string | null;
  }[];
  steps: { title: string; text: string; imagePage: number | null }[];
  coverImagePage: number | null;
  nutrition: {
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    perServing: boolean;
  } | null;
  warnings: string[];
};

/** Maks. tegn der sendes (holder prisen nede og stopper misbrug). */
export const MAX_RECIPE_IMPORT_CHARS = 20_000;

/** Sætter siderne sammen med [[SIDE n]]-markører (indsæt tekst = én side). */
export function buildRecipeImportInput(
  pages: string[],
  language: string,
): string {
  const body = pages
    .map((page, index) => `[[SIDE ${index + 1}]]\n${page.trim()}`)
    .join("\n\n")
    .slice(0, MAX_RECIPE_IMPORT_CHARS);
  return `App language: ${language}\n\n${body}`;
}

/** Ryd op i svaret: ugyldige sidehenvisninger -> null, tomme trin/ingredienser fjernes. */
export function parseRecipeImportResponse(
  raw: unknown,
  pageCount: number,
): RecipeImportAi | null {
  const data = raw as Partial<RecipeImportAi> | null;
  if (
    !data ||
    typeof data.title !== "string" ||
    !Array.isArray(data.ingredients) ||
    !Array.isArray(data.steps)
  )
    return null;
  const page = (value: unknown) =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= pageCount
      ? value
      : null;
  return {
    title: data.title.trim(),
    description:
      typeof data.description === "string" && data.description.trim()
        ? data.description.trim()
        : null,
    servings:
      typeof data.servings === "number" &&
      data.servings > 0 &&
      data.servings <= 100
        ? Math.round(data.servings)
        : null,
    durationMinutes:
      typeof data.durationMinutes === "number" &&
      data.durationMinutes > 0 &&
      data.durationMinutes <= 5999
        ? Math.round(data.durationMinutes)
        : null,
    ingredients: data.ingredients.filter(
      (i) => i && typeof i.name === "string" && i.name.trim(),
    ),
    steps: data.steps
      .filter((s) => s && typeof s.text === "string" && s.text.trim())
      .map((s) => ({
        title: s.title?.trim() ?? "",
        text: s.text.trim(),
        imagePage: page(s.imagePage),
      })),
    coverImagePage: page(data.coverImagePage),
    nutrition: data.nutrition ?? null,
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter((w) => typeof w === "string")
      : [],
  };
}
