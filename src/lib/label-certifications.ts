// Mærkninger fra emballagen (Ø-mærket, Nøglehullet, MSC …) → ProductFilters'
// tekstfelter, som varesiden viser som logoer (src/lib/certification-badges.ts,
// docs/DECISIONS.md 2026-10-02). Kilderne er forside-AI'ens "certifications"
// og Open Food Facts' labels_tags. Ren logik uden database, så den kan testes.

export type LabelCertificationFilters = {
  organic: string | null;
  keyhole: string | null;
  wholeGrain: string | null;
  animalWelfare: string[];
  certifications: string[];
};

// Viste navne — samme ord som butiksimporten bruger, så logoet findes.
const ORGANIC = "Økologisk";
const EU_ORGANIC = "EU-økologisk";

function classify(label: string): { field: keyof LabelCertificationFilters; value: string } | null {
  const value = label.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("nøglehul") || value.includes("keyhole")) return { field: "keyhole", value: "Nøglehul" };
  if (value.includes("fuldkorn") || value.includes("whole grain") || value.includes("wholegrain"))
    return { field: "wholeGrain", value: "Fuldkorn" };
  if (value.includes("dyrenes beskyttelse"))
    return { field: "animalWelfare", value: "Anbefalet af Dyrenes Beskyttelse" };
  if (value.includes("dyrevelfærd") || value.includes("animal welfare")) {
    const level = value.match(/[123]/)?.[0];
    return level ? { field: "animalWelfare", value: `Bedre Dyrevelfærd ${level}` } : null;
  }
  if (/\bmsc\b/.test(value)) return { field: "certifications", value: "MSC" };
  if (/\basc\b/.test(value)) return { field: "certifications", value: "ASC" };
  if (value.includes("fairtrade") || value.includes("fair trade")) return { field: "certifications", value: "Fairtrade" };
  if (value.includes("rainforest")) return { field: "certifications", value: "Rainforest Alliance" };
  if (/\butz\b/.test(value)) return { field: "certifications", value: "UTZ" };
  if (value.includes("naturskånsom")) return { field: "certifications", value: "NaturSkånsom" };
  if (value.includes("bioland")) return { field: "organic", value: "Bioland" };
  if (value.includes("ökologischer landbau")) return { field: "organic", value: "Ökologischer Landbau" };
  if (/\beu\b/.test(value) && (value.includes("øko") || value.includes("organic") || value.includes("bio") || value.includes("blad") || value.includes("leaf")))
    return { field: "organic", value: EU_ORGANIC };
  if (value.includes("biologisch") || value === "bio" || value.includes("bio-siegel")) return { field: "organic", value: "Biologisch" };
  if (value.includes("ø-mærke") || value.includes("økolog") || value.includes("organic") || value === "øko")
    return { field: "organic", value: ORGANIC };
  return null;
}

export function certificationFiltersFromLabels(labels: readonly string[]): LabelCertificationFilters {
  const out: LabelCertificationFilters = { organic: null, keyhole: null, wholeGrain: null, animalWelfare: [], certifications: [] };
  for (const label of labels) {
    const hit = classify(label);
    if (!hit) continue;
    if (hit.field === "animalWelfare" || hit.field === "certifications") {
      if (!out[hit.field].includes(hit.value)) out[hit.field].push(hit.value);
    } else if (hit.field === "organic") {
      // Det danske Ø-mærke vinder over EU-bladet (begge står ofte på varen).
      if (!out.organic || hit.value === ORGANIC) out.organic = hit.value;
    } else {
      out[hit.field] = hit.value;
    }
  }
  return out;
}

export function hasCertificationFilters(filters: LabelCertificationFilters) {
  return Boolean(
    filters.organic || filters.keyhole || filters.wholeGrain || filters.animalWelfare.length || filters.certifications.length,
  );
}

// Open Food Facts' labels_tags ("en:organic", "en:eu-organic", "en:fairtrade",
// "da:ø-mærket" …) → læsbare navne, som certificationFiltersFromLabels forstår.
const OFF_LABELS: Record<string, string> = {
  "en:organic": ORGANIC,
  "en:dk-organic": ORGANIC,
  "en:danish-organic": ORGANIC,
  "da:ø-mærket": ORGANIC,
  "da:statskontrolleret-økologisk": ORGANIC,
  "en:eu-organic": EU_ORGANIC,
  "en:de-bio-siegel": "Biologisch",
  "en:bio-siegel": "Biologisch",
  "en:bioland": "Bioland",
  "en:keyhole": "Nøglehul",
  "en:nordic-keyhole": "Nøglehul",
  "en:whole-grain": "Fuldkorn",
  "da:fuldkornslogoet": "Fuldkorn",
  "en:sustainable-seafood-msc": "MSC",
  "en:msc": "MSC",
  "en:asc": "ASC",
  "en:responsible-aquaculture-asc": "ASC",
  "en:fairtrade": "Fairtrade",
  "en:fairtrade-international": "Fairtrade",
  "en:max-havelaar": "Fairtrade",
  "en:rainforest-alliance": "Rainforest Alliance",
  "en:utz-certified": "UTZ",
};

export function offLabelNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const names = tags
    .map((tag) => (typeof tag === "string" ? OFF_LABELS[tag.toLowerCase()] : undefined))
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names));
}
