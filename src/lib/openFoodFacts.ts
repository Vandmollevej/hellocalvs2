import { mapOffAllergenTags } from "./allergens";

export type OffProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSizeGrams: number | null;
  ingredientsText: string | null;
  allergens: string[];
  additives: string[];
};

// Fallback-opslag for ukendte stregkoder, jf. docs/DATABASE.md.
// Bruges kun når produktet ikke allerede findes i vores egen database.
export async function lookupOpenFoodFacts(
  barcode: string
): Promise<OffProduct | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode
    )}.json`,
    { headers: { "User-Agent": "HelloCal/0.1 (prototype)" } }
  );

  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const n = p.nutriments ?? {};

  // serving_quantity er OFF's "pr. stk"-vægt (fx en enkelt kiks eller bar).
  // Bruger IKKE product_quantity som fallback — det er hele pakkens vægt
  // (fx en æske kiks) og ville give en forkert "pr. stk"-værdi.
  const servingQuantity = Number(p.serving_quantity);
  const servingSizeGrams = Number.isFinite(servingQuantity) && servingQuantity > 0
    ? servingQuantity
    : null;

  // additives_tags kommer som "en:e330" — normaliseres til "E330".
  const additives: string[] = Array.isArray(p.additives_tags)
    ? Array.from(
        new Set(
          p.additives_tags
            .map((tag: unknown) =>
              typeof tag === "string" ? tag.replace(/^en:/, "").toUpperCase() : ""
            )
            .filter(Boolean)
        )
      )
    : [];

  return {
    barcode,
    name: p.product_name_da || p.product_name || "Ukendt produkt",
    brand: p.brands ?? null,
    imageUrl: p.image_front_url ?? p.image_url ?? null,
    kcalPer100g: n["energy-kcal_100g"] ?? 0,
    proteinPer100g: n.proteins_100g ?? 0,
    carbsPer100g: n.carbohydrates_100g ?? 0,
    fatPer100g: n.fat_100g ?? 0,
    servingSizeGrams,
    ingredientsText: p.ingredients_text_da || p.ingredients_text || null,
    allergens: mapOffAllergenTags(p.allergens_tags),
    additives,
  };
}
