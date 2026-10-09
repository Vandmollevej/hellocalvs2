// Migrering fra MyFitnessPal / Lifesum (docs/DECISIONS.md 2026-10-06):
// brugeren optager skærmen (eller tager skærmbilleder), mens de bladrer i
// dagbogen i den anden app. Hvert billede aflæses af AI (src/lib/
// migration-import-ai.ts) til rækker, som her renses og lægges i Hello Cals
// felter: dato, måltid, navn, mængde og kcal/protein/kulhydrat/fedt.
// Ren logik uden database (migration-import.test.mjs).

export const MIGRATION_SOURCES = ["MYFITNESSPAL", "LIFESUM"] as const;
export type MigrationSource = (typeof MIGRATION_SOURCES)[number];

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

export type ExtractedRow = {
  date: string | null;
  meal: string;
  name: string;
  amountText: string | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  confidence: number;
};

export type CleanRow = {
  date: string;
  meal: Meal;
  name: string;
  amountText: string | null;
  amountGrams: number | null;
  kcal: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  confidence: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isMigrationSource(value: unknown): value is MigrationSource {
  return typeof value === "string" && (MIGRATION_SOURCES as readonly string[]).includes(value);
}

/** Måltidsnavne fra begge apps (engelsk og dansk) → Hello Cals fire måltider. */
export function normalizeMeal(value: string): Meal {
  const v = value.trim().toLowerCase();
  if (/(breakfast|morgen)/.test(v)) return "breakfast";
  if (/(lunch|frokost|middag(?!smad))/.test(v)) return "lunch";
  if (/(dinner|aften|supper)/.test(v)) return "dinner";
  return "snack";
}

/** "150 g", "1 cup (240 ml)", "2 x 30 g" → gram/ml når det kan læses, ellers null. */
export function parseGrams(amountText: string | null): number | null {
  if (!amountText) return null;
  const text = amountText.toLowerCase().replace(",", ".");
  const multi = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(g|gram|ml)\b/);
  if (multi) return round1(Number(multi[1]) * Number(multi[2]));
  const kilo = text.match(/(\d+(?:\.\d+)?)\s*(kg|l)\b/);
  if (kilo) return round1(Number(kilo[1]) * 1000);
  const grams = text.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams|ml)\b/);
  if (grams) return round1(Number(grams[1]));
  return null;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function num(value: number | null, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? round1(value) : null;
}

/**
 * Renser AI'ens rækker fra ét billede. Rækker uden dato får billedets/den
 * forrige dato (`fallbackDate`), og rækker uden kcal eller navn smides væk —
 * fx dagens total, som ikke er en vare.
 */
export function cleanExtractedRows(rows: ExtractedRow[], fallbackDate: string | null): CleanRow[] {
  const out: CleanRow[] = [];
  for (const row of rows) {
    const date = row.date && DATE_RE.test(row.date) ? row.date : fallbackDate;
    const name = row.name.replace(/\s+/g, " ").trim().slice(0, 200);
    const kcal = num(row.kcal, 10_000);
    if (!date || !name || kcal === null) continue;
    if (/^(total|totals|i alt|samlet|remaining|tilbage|goal|mål)\b/i.test(name)) continue;
    out.push({
      date,
      meal: normalizeMeal(row.meal),
      name,
      amountText: row.amountText?.trim().slice(0, 100) || null,
      amountGrams: parseGrams(row.amountText),
      kcal,
      protein: num(row.protein, 1000),
      carbs: num(row.carbs, 1000),
      fat: num(row.fat, 1000),
      confidence: Math.min(1, Math.max(0, Number.isFinite(row.confidence) ? row.confidence : 0)),
    });
  }
  return dedupeRows(out);
}

/** Samme vare, samme måltid og dato set i flere billeder = én række. */
export function rowKey(row: Pick<CleanRow, "date" | "meal" | "name" | "kcal">) {
  return `${row.date}|${row.meal}|${row.name.toLowerCase()}|${row.kcal}`;
}

export function dedupeRows(rows: CleanRow[]): CleanRow[] {
  const byKey = new Map<string, CleanRow>();
  for (const row of rows) {
    const key = rowKey(row);
    const existing = byKey.get(key);
    if (!existing || row.confidence > existing.confidence) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

/** Seneste dato i rækkerne — bruges som udgangspunkt for næste billede. */
export function latestDate(rows: { date: string }[], current: string | null): string | null {
  return rows.reduce<string | null>((latest, row) => (!latest || row.date > latest ? row.date : latest), current);
}

const MEAL_HOUR: Record<Meal, number> = { breakfast: 8, lunch: 12, snack: 15, dinner: 18 };

/** Registreringens tidspunkt: datoen kl. måltidets time i dansk tid. */
export function registrationTime(date: string, meal: Meal): Date {
  const [y, m, d] = date.split("-").map(Number);
  const hour = MEAL_HOUR[meal];
  const guess = new Date(Date.UTC(y, m - 1, d, hour));
  const local = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Copenhagen" }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}
