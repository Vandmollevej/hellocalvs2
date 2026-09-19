const NUTRITION_SECTION_BY_REGION: Record<string, string> = {
  DK: "Næringsindhold",
  US: "Nutrition Facts",
  GB: "Nutrition information",
  IE: "Nutrition information",
  AU: "Nutrition information",
  NZ: "Nutrition information",
  DE: "Nährwerte",
  AT: "Nährwerte",
  CH: "Nährwerte",
  FR: "Informations nutritionnelles",
  BE: "Informations nutritionnelles",
  NL: "Voedingswaarde",
  ES: "Información nutricional",
  IT: "Valori nutrizionali",
  CA: "Nutrition Facts",
};

/**
 * Region-specific consumer wording for the nutrition section (e.g. the
 * statistics page's "Næringsindhold" category, replacing a fixed "Makroer"/
 * "Energi og makrofordeling" label). Region is deliberately separate from
 * appLocale: packaging terminology follows the user's market, while the rest
 * of the UI can still be Danish/English (see src/lib/regions.ts).
 */
export function nutritionSectionLabel(region: string | null | undefined) {
  const normalized = (region ?? "DK").trim().toUpperCase();
  return NUTRITION_SECTION_BY_REGION[normalized] ?? "Næringsindhold";
}
