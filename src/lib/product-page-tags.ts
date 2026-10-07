// Nøgleord på produktsiden (docs/DECISIONS.md 2026-10-02): admin vælger i
// Varedatabase → Nøgleord, hvilke nøgleordstyper (smag, økologisk, glutenfri …)
// der vises som en linje brødtekst lige over "Energifordeling". Der vælges
// typer, ikke enkelte nøgleord (brugerens krav 2026-10-07). Modulet er rent
// (ingen DB) og kan bruges både på serveren og i klienten.

import {
  PRODUCT_KEYWORD_GROUPS,
  displayProductKeyword,
  isProductKeywordGroup,
  productKeywordGroup,
  type ProductKeywordGroup,
} from "./product-keyword-groups.ts";
export type ProductPageTagField =
  | "flavor"
  | "organic"
  | "glutenFree"
  | "lactoseFree"
  | "sugarFree"
  | "sweeteners"
  | "vegan"
  | "vegetarian"
  | "meatType"
  | "alcohol"
  | "alcoholPercent"
  | "fatPercent"
  | "countryOfOrigin"
  | "wholeGrain"
  | "keyhole"
  | "animalWelfare"
  | "certifications"
  | "storage"
  | "size";

// Rækkefølgen her er rækkefølgen på produktsiden.
export const PRODUCT_PAGE_TAG_FIELDS: { field: ProductPageTagField; label: string; example: string }[] = [
  { field: "flavor", label: "Smagsretning", example: "Jordbær" },
  { field: "organic", label: "Økologisk", example: "Økologisk" },
  { field: "glutenFree", label: "Glutenfri", example: "Glutenfri" },
  { field: "lactoseFree", label: "Laktosefri", example: "Laktosefri" },
  { field: "sugarFree", label: "Sukkerfri", example: "Uden tilsat sukker" },
  { field: "sweeteners", label: "Sødemidler", example: "Med sødemidler" },
  { field: "vegan", label: "Vegansk", example: "Vegansk" },
  { field: "vegetarian", label: "Vegetarisk", example: "Vegetarisk" },
  { field: "meatType", label: "Kødtype", example: "Kylling" },
  { field: "alcohol", label: "Alkohol", example: "Alkoholfri" },
  { field: "alcoholPercent", label: "Alkohol %", example: "4,6 % alkohol" },
  { field: "fatPercent", label: "Fedt %", example: "3,5 % fedt" },
  { field: "countryOfOrigin", label: "Oprindelsesland", example: "Fra Danmark" },
  { field: "wholeGrain", label: "Fuldkorn", example: "Fuldkorn" },
  { field: "keyhole", label: "Nøglehul", example: "Nøglehulsmærket" },
  { field: "animalWelfare", label: "Dyrevelfærd", example: "Bedre Dyrevelfærd 3" },
  { field: "certifications", label: "Certificeringer", example: "MSC" },
  { field: "storage", label: "Opbevaring", example: "Frost" },
  { field: "size", label: "Størrelse", example: "Str. M/L" },
];

const FIELD_SET = new Set<string>(PRODUCT_PAGE_TAG_FIELDS.map((entry) => entry.field));
const FIELD_EXAMPLES = new Map<string, string>(PRODUCT_PAGE_TAG_FIELDS.map((entry) => [entry.field, entry.example]));

export type ProductPageTagSettings = {
  // Nøgleordstyper (faste felter) der vises, når de er udfyldt på varen.
  fields: ProductPageTagField[];
  // Grupper af frie nøgleord (src/lib/product-keyword-groups.ts).
  groups: ProductKeywordGroup[];
};

// Uden gemt opsætning vises smagsretning og økologisk (brugerens eksempel).
export const DEFAULT_PRODUCT_PAGE_TAG_SETTINGS: ProductPageTagSettings = {
  fields: ["flavor", "organic"],
  groups: [],
};

export function sanitizeProductPageTagSettings(value: unknown): ProductPageTagSettings {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const fields = Array.isArray(input.fields)
    ? (input.fields.filter((field) => typeof field === "string" && FIELD_SET.has(field)) as ProductPageTagField[])
    : [];
  // Gamle gemte enkelt-nøgleord (før 2026-10-07) er ikke gruppenavne og falder fra.
  const groups = Array.isArray(input.groups) ? input.groups.filter(isProductKeywordGroup) : [];
  return { fields: [...new Set(fields)], groups: [...new Set(groups)] };
}

// Typer med én fast betydning vises som oversat ord på brugerens sprog
// (addProduct.tagFlag.<felt>) i stedet for produktarkets danske tekst.
export const PRODUCT_PAGE_FLAG_FIELDS = [
  "organic",
  "glutenFree",
  "lactoseFree",
  "vegan",
  "vegetarian",
  "wholeGrain",
  "keyhole",
] as const;
export type ProductPageFlagField = (typeof PRODUCT_PAGE_FLAG_FIELDS)[number];
const FLAG_SET = new Set<string>(PRODUCT_PAGE_FLAG_FIELDS);

// Et vist nøgleord. Faste typer, tal og oprindelsesland formateres i klienten
// (i18n); alt andet er teksten fra produktarket, som den står.
export type ProductPageTag =
  | { kind: "text"; text: string }
  | { kind: "flag"; field: ProductPageFlagField }
  | { kind: "alcoholPercent" | "fatPercent"; value: number }
  | { kind: "countryOfOrigin"; text: string };

export type ProductPageTagSource = {
  flavor?: string | null;
  keywords?: string[] | null;
  filters?: Partial<Record<Exclude<ProductPageTagField, "flavor">, string | string[] | number | null>> | null;
};

export function productPageTags(product: ProductPageTagSource, settings: ProductPageTagSettings): ProductPageTag[] {
  const tags: ProductPageTag[] = [];
  const seen = new Set<string>();
  const pushText = (raw: string | null | undefined) => {
    const text = raw?.trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tags.push({ kind: "text", text });
  };
  const enabled = new Set(settings.fields);

  for (const { field } of PRODUCT_PAGE_TAG_FIELDS) {
    if (!enabled.has(field)) continue;
    if (field === "flavor") {
      pushText(product.flavor);
      continue;
    }
    const value = product.filters?.[field];
    if (value === null || value === undefined) continue;
    if (FLAG_SET.has(field)) {
      const filled = Array.isArray(value) ? value.some((item) => item?.trim()) : String(value).trim() !== "";
      if (filled && !seen.has(`flag:${field}`)) {
        seen.add(`flag:${field}`);
        // Samme ord som frit nøgleord (fx "Økologisk") vises ikke igen.
        seen.add((FIELD_EXAMPLES.get(field) ?? "").toLowerCase());
        tags.push({ kind: "flag", field: field as ProductPageFlagField });
      }
      continue;
    }
    if (field === "alcoholPercent" || field === "fatPercent") {
      if (typeof value === "number" && Number.isFinite(value)) tags.push({ kind: field, value });
      continue;
    }
    if (field === "countryOfOrigin") {
      const text = typeof value === "string" ? value.trim() : "";
      if (text && !seen.has(`country:${text.toLowerCase()}`)) {
        seen.add(`country:${text.toLowerCase()}`);
        tags.push({ kind: "countryOfOrigin", text });
      }
      continue;
    }
    if (Array.isArray(value)) value.forEach((item) => pushText(item));
    else if (typeof value === "string") pushText(value);
  }

  if (settings.groups.length && product.keywords?.length) {
    const byGroup = new Map<ProductKeywordGroup, string[]>();
    for (const keyword of product.keywords) {
      const group = productKeywordGroup(keyword);
      if (group) byGroup.set(group, [...(byGroup.get(group) ?? []), keyword]);
    }
    const enabledGroups = new Set(settings.groups);
    for (const { group } of PRODUCT_KEYWORD_GROUPS) {
      if (enabledGroups.has(group)) byGroup.get(group)?.forEach((keyword) => pushText(displayProductKeyword(keyword)));
    }
  }
  return tags;
}