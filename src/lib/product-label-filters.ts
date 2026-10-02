import type { DetectedLabel } from "@/lib/product-label-ai";

// Afbildning fra fundne mærkater til filtertabellen ProductFilters
// (docs/DECISIONS.md 2026-09-27: tom = nej/ukendt, udfyldt = det viste ord).
// Kun sikre fund bruges, og kun tomme felter udfyldes — en butiksimport eller
// admin-rettelse vinder altid over AI'ens aflæsning.

export const LABEL_FILTER_MIN_CONFIDENCE = 0.8;

export type FilterSnapshot = {
  organic?: string | null;
  glutenFree?: string | null;
  lactoseFree?: string | null;
  sugarFree?: string | null;
  vegan?: string | null;
  vegetarian?: string | null;
  wholeGrain?: string | null;
  keyhole?: string | null;
  countryOfOrigin?: string | null;
  animalWelfare?: string[] | null;
  certifications?: string[] | null;
};

export type FilterPatch = {
  organic?: string;
  glutenFree?: string;
  lactoseFree?: string;
  sugarFree?: string;
  vegan?: string;
  vegetarian?: string;
  wholeGrain?: string;
  keyhole?: string;
  countryOfOrigin?: string;
  animalWelfare?: string[];
  certifications?: string[];
};

const SCALAR_BY_KEY: Record<string, keyof Omit<FilterPatch, "animalWelfare" | "certifications">> = {
  "lactose-free": "lactoseFree",
  "gluten-free": "glutenFree",
  "sugar-free": "sugarFree",
  vegan: "vegan",
  vegetarian: "vegetarian",
  keyhole: "keyhole",
  "whole-grain": "wholeGrain",
};

const ORIGIN_BY_KEY: Record<string, string> = { "dk-origin": "Danmark", "de-origin": "Tyskland", "se-origin": "Sverige" };

const CERTIFICATION_KEYS = new Set(["msc", "asc", "fairtrade", "rainforest-alliance", "svanemaerket", "qmilch", "qs", "ohne-gentechnik"]);

// Det viste ord: dansk navn for kendte mærker; for mærker med flere
// varianter (Haltungsform 3) bruges det fulde navn.
function shownWord(label: DetectedLabel): string {
  return label.name.trim();
}

function has(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function labelsToFilterPatch(labels: DetectedLabel[], current: FilterSnapshot | null): FilterPatch {
  const patch: FilterPatch = {};
  const welfare = new Set((current?.animalWelfare ?? []).map((v) => v.trim()).filter(Boolean));
  const certs = new Set((current?.certifications ?? []).map((v) => v.trim()).filter(Boolean));
  const welfareBefore = welfare.size;
  const certsBefore = certs.size;
  const lower = (set: Set<string>, word: string) => [...set].some((v) => v.toLowerCase() === word.toLowerCase());

  for (const label of labels) {
    if (label.confidence < LABEL_FILTER_MIN_CONFIDENCE) continue;
    const word = shownWord(label);
    const scalar = SCALAR_BY_KEY[label.key];
    if (scalar) {
      if (!has(current?.[scalar]) && !patch[scalar]) patch[scalar] = word;
      continue;
    }
    if (label.key.startsWith("organic-") || label.category === "ORGANIC") {
      if (!has(current?.organic) && !patch.organic) patch.organic = word;
      continue;
    }
    const origin = ORIGIN_BY_KEY[label.key];
    if (origin) {
      if (!has(current?.countryOfOrigin) && !patch.countryOfOrigin) patch.countryOfOrigin = origin;
      continue;
    }
    if (label.category === "ANIMAL_WELFARE") {
      if (!lower(welfare, word)) welfare.add(word);
      continue;
    }
    if (CERTIFICATION_KEYS.has(label.key) || label.category === "SUSTAINABILITY" || label.category === "QUALITY") {
      if (!lower(certs, word)) certs.add(word);
    }
  }
  if (welfare.size !== welfareBefore) patch.animalWelfare = [...welfare];
  if (certs.size !== certsBefore) patch.certifications = [...certs];
  return patch;
}
