// The 14 EU-mandatory-labeling allergens (regulation 1169/2011, annex II).
// `offTag` matches Open Food Facts' `allergens_tags` values (without the "en:" prefix).
export const ALLERGEN_CATALOG = [
  { key: "gluten", offTag: "gluten", label: "Gluten" },
  { key: "crustaceans", offTag: "crustaceans", label: "Skaldyr" },
  { key: "eggs", offTag: "eggs", label: "Æg" },
  { key: "fish", offTag: "fish", label: "Fisk" },
  { key: "peanuts", offTag: "peanuts", label: "Jordnødder" },
  { key: "soybeans", offTag: "soybeans", label: "Soja" },
  { key: "milk", offTag: "milk", label: "Mælk" },
  { key: "nuts", offTag: "nuts", label: "Nødder" },
  { key: "celery", offTag: "celery", label: "Selleri" },
  { key: "mustard", offTag: "mustard", label: "Sennep" },
  { key: "sesame-seeds", offTag: "sesame-seeds", label: "Sesamfrø" },
  {
    key: "sulphur-dioxide-and-sulphites",
    offTag: "sulphur-dioxide-and-sulphites",
    label: "Svovldioxid og sulfitter",
  },
  { key: "lupin", offTag: "lupin", label: "Lupin" },
  { key: "molluscs", offTag: "molluscs", label: "Bløddyr" },
] as const;

export type AllergenKey = (typeof ALLERGEN_CATALOG)[number]["key"];

const OFF_TAG_TO_KEY = new Map<string, string>(ALLERGEN_CATALOG.map((a) => [a.offTag, a.key]));
const KEY_TO_LABEL = new Map<string, string>(ALLERGEN_CATALOG.map((a) => [a.key, a.label]));

export function labelForAllergen(key: string): string {
  return KEY_TO_LABEL.get(key) ?? key;
}

// Open Food Facts provides tags like "en:milk", "en:sesame-seeds" etc.
export function mapOffAllergenTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const keys = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const bare = tag.replace(/^en:/, "");
    const key = OFF_TAG_TO_KEY.get(bare);
    if (key) keys.add(key);
  }
  return Array.from(keys);
}
