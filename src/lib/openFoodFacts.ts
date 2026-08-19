export type OffProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
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

  return {
    barcode,
    name: p.product_name_da || p.product_name || "Ukendt produkt",
    brand: p.brands ?? null,
    imageUrl: p.image_front_url ?? p.image_url ?? null,
    kcalPer100g: n["energy-kcal_100g"] ?? 0,
    proteinPer100g: n.proteins_100g ?? 0,
    carbsPer100g: n.carbohydrates_100g ?? 0,
    fatPer100g: n.fat_100g ?? 0,
  };
}
