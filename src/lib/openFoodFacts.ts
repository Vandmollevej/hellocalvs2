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

function mapOffProduct(p: Record<string, unknown>): OffProduct | null {
  const code = typeof p.code === "string" ? p.code : null;
  if (!code) return null;

  const n = (p.nutriments as Record<string, unknown>) ?? {};

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
          (p.additives_tags as unknown[])
            .map((tag: unknown) =>
              typeof tag === "string" ? tag.replace(/^en:/, "").toUpperCase() : ""
            )
            .filter(Boolean)
        )
      )
    : [];

  return {
    barcode: code,
    name: (p.product_name_da as string) || (p.product_name as string) || "Ukendt produkt",
    brand: (p.brands as string) ?? null,
    imageUrl: (p.image_front_url as string) ?? (p.image_url as string) ?? null,
    kcalPer100g: (n["energy-kcal_100g"] as number) ?? 0,
    proteinPer100g: (n.proteins_100g as number) ?? 0,
    carbsPer100g: (n.carbohydrates_100g as number) ?? 0,
    fatPer100g: (n.fat_100g as number) ?? 0,
    servingSizeGrams,
    ingredientsText: (p.ingredients_text_da as string) || (p.ingredients_text as string) || null,
    allergens: mapOffAllergenTags(p.allergens_tags as unknown[]),
    additives,
  };
}

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

  return mapOffProduct({ ...data.product, code: barcode });
}

// Live tekstsøgning mod Open Food Facts' globale katalog. Bruges som
// supplement til vores egen produktdatabase, så brugeren ikke skal
// downloade/importere hele OFF-kataloget for at kunne søge på fx "toast".
export async function searchOpenFoodFacts(query: string): Promise<OffProduct[]> {
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?" +
    new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "20",
      fields:
        "code,product_name,product_name_da,brands,image_front_url,image_url,nutriments,serving_quantity,ingredients_text_da,ingredients_text,allergens_tags,additives_tags",
    }).toString();

  const res = await fetch(url, {
    headers: { "User-Agent": "HelloCal/0.1 (prototype)" },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const products: Record<string, unknown>[] = Array.isArray(data.products) ? data.products : [];

  return products.map(mapOffProduct).filter((p): p is OffProduct => p !== null);
}
