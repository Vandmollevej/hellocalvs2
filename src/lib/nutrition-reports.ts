// Brugerindberettede ændringer af næringsindhold (docs/DECISIONS.md
// 2026-09-23). Ren logik uden Prisma-kald, så både POST /api/registrations
// og admin-godkendelsen bruger samme regler.

export const NUTRITION_REPORT_FIELDS = ["proteinPer100g", "carbsPer100g", "fatPer100g"] as const;
export type NutritionReportField = (typeof NUTRITION_REPORT_FIELDS)[number];

export type NutritionReportChange = {
  field: NutritionReportField;
  before: number;
  reported: number;
};

export const NUTRITION_REPORT_FIELD_LABEL: Record<NutritionReportField, string> = {
  proteinPer100g: "Protein",
  carbsPer100g: "Kulhydrat",
  fatPer100g: "Fedt",
};

// En brugerindtastet værdi er ikke verificeret data. Fast lav confidence, så
// alle brugerindberetninger lander blandt de kontrolkrævende (< 50 %) i
// Kvalitetskontrol, uanset hvor sikker brugeren selv var.
export const USER_EDIT_CONFIDENCE = 25;

const round1 = (value: number) => Math.round(value * 10) / 10;

// Sammenligner brugerens snapshot-værdier (for den registrerede mængde) med
// produktets egne pr.-100 g-værdier skaleret til samme mængde. Afrundet til
// 0,1 g ligesom /add viser dem, så en uændret skyder aldrig giver en rapport.
// Returnerer kun ændrede felter, omregnet til pr. 100 g.
export function detectNutritionChanges(
  product: Record<NutritionReportField, number>,
  amountGrams: number,
  snapshots: Partial<Record<NutritionReportField, number | undefined>>,
): NutritionReportChange[] {
  if (!(amountGrams > 0)) return [];
  const factor = amountGrams / 100;
  const changes: NutritionReportChange[] = [];
  for (const field of NUTRITION_REPORT_FIELDS) {
    const snapshot = snapshots[field];
    if (typeof snapshot !== "number" || !Number.isFinite(snapshot) || snapshot < 0) continue;
    const expected = round1(product[field] * factor);
    if (Math.abs(snapshot - expected) < 0.05) continue;
    changes.push({ field, before: product[field], reported: round1(snapshot / factor) });
  }
  return changes;
}

export function parseNutritionReportChanges(value: unknown): NutritionReportChange[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is NutritionReportChange =>
      !!item &&
      typeof item === "object" &&
      NUTRITION_REPORT_FIELDS.includes((item as NutritionReportChange).field) &&
      typeof (item as NutritionReportChange).before === "number" &&
      typeof (item as NutritionReportChange).reported === "number",
  );
}
