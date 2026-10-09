import { callStructuredVision } from "@/lib/product-ai";
import { cleanExtractedRows, type CleanRow, type ExtractedRow, type MigrationSource } from "@/lib/migration-import";

// AI-aflæsning af ét billede fra en skærmoptagelse af MyFitnessPal/Lifesum
// (docs/DECISIONS.md 2026-10-06). Billedet sendes uden metadata og gemmes
// hverken hos os eller hos OpenAI (store: false, src/lib/product-ai.ts).

const NULLABLE_STRING = { type: ["string", "null"] };
const NULLABLE_NUMBER = { type: ["number", "null"] };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["screenDate", "rows"],
  properties: {
    screenDate: NULLABLE_STRING,
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "meal", "name", "amountText", "kcal", "protein", "carbs", "fat", "confidence"],
        properties: {
          date: NULLABLE_STRING,
          meal: { type: "string" },
          name: { type: "string" },
          amountText: NULLABLE_STRING,
          kcal: NULLABLE_NUMBER,
          protein: NULLABLE_NUMBER,
          carbs: NULLABLE_NUMBER,
          fat: NULLABLE_NUMBER,
          confidence: { type: "number" },
        },
      },
    },
  },
};

const SOURCE_NAME: Record<MigrationSource, string> = { MYFITNESSPAL: "MyFitnessPal", LIFESUM: "Lifesum" };

export async function extractDiaryFrame({
  photo,
  source,
  today,
  contextDate,
}: {
  photo: string;
  source: MigrationSource;
  today: string;
  contextDate: string | null;
}): Promise<{ screenDate: string | null; rows: CleanRow[] }> {
  const { value } = await callStructuredVision<{ screenDate: string | null; rows: ExtractedRow[] }>({
    photo,
    schemaName: "migration_diary_frame",
    schema: SCHEMA,
    system:
      "Du aflæser skærmbilleder af en madsdagbog fra en kalorie-app. Returnér kun det, der faktisk står på skærmen. " +
      "Gæt aldrig tal, der ikke er synlige — brug null. Spring overskrifter, totaler, mål, reklamer og knapper over.",
    text:
      `Skærmbilledet er fra ${SOURCE_NAME[source]}. Dags dato er ${today}. ` +
      (contextDate ? `Forrige billede viste datoen ${contextDate}. ` : "") +
      "Find dagbogens dato (screenDate som YYYY-MM-DD; 'I dag'/'Today' = dags dato, 'I går'/'Yesterday' = dagen før; " +
      "datoer uden år ligger i det seneste år op til dags dato) og hver registreret vare: måltid (som det står, fx Breakfast/Morgenmad), " +
      "varens navn, mængde som tekst (fx '150 g' eller '1 cup'), kcal og, hvis de står der, protein/kulhydrat/fedt i gram. " +
      "Sæt date til null, når varen hører til screenDate. confidence 0–1 for hvor sikkert rækken er læst.",
  });
  const fallback = value.screenDate && /^\d{4}-\d{2}-\d{2}$/.test(value.screenDate) ? value.screenDate : contextDate;
  return { screenDate: fallback ?? null, rows: cleanExtractedRows(value.rows ?? [], fallback ?? null) };
}
