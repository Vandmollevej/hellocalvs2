// Felterne på admin "Dubletter" → Produkter (docs/DECISIONS.md 2026-09-28).
// Ren data uden Prisma-import, så både siden (server), sammenligningen
// (klient) og gem-ruten bruger præcis samme liste og samme lighedsregel.

export type DuplicateFieldValue = string | number | string[] | null;
export type DuplicateFieldKind = "text" | "longtext" | "number" | "list" | "image";

export type DuplicateField = {
  key: string;
  label: string;
  kind: DuplicateFieldKind;
  section: "Basis" | "Næring pr. 100 g/ml" | "Filtre";
  // Kan ikke vælges med pil: flettes automatisk (stregkoder, butikker).
  readOnly?: boolean;
  // Kan ikke gemmes tomt (produktets makroer er påkrævede kolonner).
  required?: boolean;
};

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  DRINK: "Drikkevare (ml)",
  VEGETABLES: "Grønt",
  GENERIC: "Generisk",
  PROCESSED: "Forarbejdet",
  RAW: "Råvare",
  INGREDIENT: "Ingrediens",
};

export const DUPLICATE_FIELDS: DuplicateField[] = [
  { key: "imageUrl", label: "Billede", kind: "image", section: "Basis" },
  { key: "name", label: "Navn", kind: "text", section: "Basis", required: true },
  { key: "brand", label: "Brand", kind: "text", section: "Basis" },
  { key: "subbrand", label: "Subbrand", kind: "text", section: "Basis" },
  { key: "productType", label: "Varetype", kind: "text", section: "Basis" },
  { key: "variant", label: "Variant", kind: "text", section: "Basis" },
  { key: "flavor", label: "Smag", kind: "text", section: "Basis" },
  { key: "packageSizeText", label: "Mængde", kind: "text", section: "Basis" },
  { key: "packCount", label: "Antal i pakken", kind: "number", section: "Basis" },
  { key: "productCategory", label: "Kategori", kind: "text", section: "Basis" },
  { key: "barcodes", label: "Stregkoder", kind: "list", section: "Basis", readOnly: true },
  { key: "stores", label: "Butikker", kind: "list", section: "Basis", readOnly: true },
  { key: "keywords", label: "Nøgleord", kind: "list", section: "Basis" },
  { key: "ingredientsText", label: "Ingredienser", kind: "longtext", section: "Basis" },
  { key: "allergens", label: "Allergener", kind: "list", section: "Basis" },
  { key: "additives", label: "E-numre", kind: "list", section: "Basis" },

  { key: "kcal", label: "Energi (kcal)", kind: "number", section: "Næring pr. 100 g/ml", required: true },
  { key: "energyKj", label: "Energi (kJ)", kind: "number", section: "Næring pr. 100 g/ml" },
  { key: "protein", label: "Protein (g)", kind: "number", section: "Næring pr. 100 g/ml", required: true },
  { key: "carbs", label: "Kulhydrat (g)", kind: "number", section: "Næring pr. 100 g/ml", required: true },
  { key: "sugars", label: "Heraf sukkerarter (g)", kind: "number", section: "Næring pr. 100 g/ml" },
  { key: "fat", label: "Fedt (g)", kind: "number", section: "Næring pr. 100 g/ml", required: true },
  { key: "saturatedFat", label: "Heraf mættet (g)", kind: "number", section: "Næring pr. 100 g/ml" },
  { key: "fiber", label: "Kostfibre (g)", kind: "number", section: "Næring pr. 100 g/ml" },
  { key: "salt", label: "Salt (g)", kind: "number", section: "Næring pr. 100 g/ml" },

  { key: "organic", label: "Økologisk", kind: "text", section: "Filtre" },
  { key: "glutenFree", label: "Glutenfri", kind: "text", section: "Filtre" },
  { key: "lactoseFree", label: "Laktosefri", kind: "text", section: "Filtre" },
  { key: "sugarFree", label: "Sukkerfri", kind: "text", section: "Filtre" },
  { key: "sweeteners", label: "Sødemidler", kind: "text", section: "Filtre" },
  { key: "vegan", label: "Vegansk", kind: "text", section: "Filtre" },
  { key: "vegetarian", label: "Vegetarisk", kind: "text", section: "Filtre" },
  { key: "meatType", label: "Kødtype", kind: "text", section: "Filtre" },
  { key: "alcohol", label: "Alkohol", kind: "text", section: "Filtre" },
  { key: "alcoholPercent", label: "Alkohol %", kind: "number", section: "Filtre" },
  { key: "fatPercent", label: "Fedt %", kind: "number", section: "Filtre" },
  { key: "countryOfOrigin", label: "Oprindelsesland", kind: "text", section: "Filtre" },
  { key: "wholeGrain", label: "Fuldkorn", kind: "text", section: "Filtre" },
  { key: "keyhole", label: "Nøglehul", kind: "text", section: "Filtre" },
  { key: "storage", label: "Opbevaring", kind: "text", section: "Filtre" },
  { key: "size", label: "Størrelse", kind: "text", section: "Filtre" },
  { key: "animalWelfare", label: "Dyrevelfærd", kind: "list", section: "Filtre" },
  { key: "certifications", label: "Certificeringer", kind: "list", section: "Filtre" },
  { key: "toxins", label: "Toxiner", kind: "list", section: "Filtre" },
];

export const FILTER_TEXT_KEYS = [
  "organic", "glutenFree", "lactoseFree", "sugarFree", "sweeteners", "vegan", "vegetarian", "meatType",
  "alcohol", "countryOfOrigin", "wholeGrain", "keyhole", "storage", "size",
] as const;
export const FILTER_NUMBER_KEYS = ["alcoholPercent", "fatPercent"] as const;
export const FILTER_LIST_KEYS = ["animalWelfare", "certifications", "toxins"] as const;

export type DuplicateFieldValues = Record<string, DuplicateFieldValue>;

export function isEmptyValue(value: DuplicateFieldValue | undefined) {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// Samme værdi = ingen pil. Tekst sammenlignes uden store/små bogstaver og
// ekstra mellemrum; tal på to decimaler; lister uanset rækkefølge.
export function sameValue(a: DuplicateFieldValue | undefined, b: DuplicateFieldValue | undefined) {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  if (isEmptyValue(a) || isEmptyValue(b)) return false;
  if (typeof a === "number" && typeof b === "number") return Math.round(a * 100) === Math.round(b * 100);
  if (Array.isArray(a) && Array.isArray(b)) {
    const na = a.map(normalizeText).sort();
    const nb = b.map(normalizeText).sort();
    return na.length === nb.length && na.every((v, i) => v === nb[i]);
  }
  return normalizeText(String(a)) === normalizeText(String(b));
}

export function formatFieldValue(field: DuplicateField, value: DuplicateFieldValue | undefined): string {
  if (isEmptyValue(value)) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (field.key === "productCategory" && typeof value === "string") return PRODUCT_CATEGORY_LABELS[value] ?? value;
  if (typeof value === "number") return value.toLocaleString("da-DK", { maximumFractionDigits: 2 });
  return String(value);
}

// Butikkens rå data (ProductSourceRecord.data, se build_data.py) → samme
// feltnøgler som produktet.
export function sourceRecordValues(data: unknown): DuplicateFieldValues {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const nutrition = (d.nutrition && typeof d.nutrition === "object" ? d.nutrition : {}) as Record<string, unknown>;
  const filters = (d.filters && typeof d.filters === "object" ? d.filters : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);

  const values: DuplicateFieldValues = {
    name: str(d.name),
    brand: str(d.brand),
    subbrand: str(d.subbrand),
    productType: str(d.productType),
    variant: str(d.variant),
    flavor: str(d.flavor),
    packageSizeText: str(d.quantity),
    packCount: num(d.packCount),
    productCategory: str(d.productCategory),
    barcodes: str(d.ean) ? [str(d.ean) as string] : [],
    stores: list(d.stores),
    keywords: list(d.keywords),
    ingredientsText: str(d.ingredients),
    allergens: list(d.allergens),
    additives: list(d.additives),
    kcal: num(nutrition.kcal),
    energyKj: num(nutrition.energyKj),
    protein: num(nutrition.protein),
    carbs: num(nutrition.carbs),
    sugars: num(nutrition.sugars),
    fat: num(nutrition.fat),
    saturatedFat: num(nutrition.saturatedFat),
    fiber: num(nutrition.fiber),
    salt: num(nutrition.salt),
  };
  for (const key of FILTER_TEXT_KEYS) values[key] = str(filters[key]);
  for (const key of FILTER_NUMBER_KEYS) values[key] = num(filters[key]);
  for (const key of FILTER_LIST_KEYS) values[key] = list(filters[key]);
  return values;
}
