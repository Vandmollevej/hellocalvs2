export type FoodDataCentralProduct = {
  externalId: string;
  barcode: string;
  name: string;
  brand: string | null;
  imageUrl: null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSizeGrams: number | null;
};

type FdcSearchFood = {
  fdcId?: number;
  gtinUpc?: string;
  publicationDate?: string;
};

type FdcSearchResponse = {
  foods?: FdcSearchFood[];
};

type FdcNutrient = {
  amount?: number;
  nutrient?: {
    number?: string;
    unitName?: string;
  };
};

type FdcFood = {
  fdcId?: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  foodNutrients?: FdcNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
};

const FDC_API_BASE = "https://api.nal.usda.gov/fdc/v1";

function normalizedBarcode(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

function nutrientAmount(food: FdcFood, number: string, unit: string) {
  const nutrient = food.foodNutrients?.find(
    (item) =>
      item.nutrient?.number === number &&
      item.nutrient.unitName?.toLowerCase() === unit
  );
  const amount = nutrient?.amount;
  return typeof amount === "number" && Number.isFinite(amount) && amount >= 0
    ? amount
    : 0;
}

async function fetchFdc<T>(path: string, apiKey: string): Promise<T> {
  const url = new URL(`${FDC_API_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`USDA FoodData Central returned HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function lookupFoodDataCentral(
  barcode: string,
  apiKey = process.env.USDA_FDC_API_KEY
): Promise<FoodDataCentralProduct | null> {
  if (!apiKey || !/^\d{8,14}$/.test(barcode)) return null;

  const search = await fetchFdc<FdcSearchResponse>(
    `/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=25`,
    apiKey
  );
  const wantedBarcode = normalizedBarcode(barcode);
  const match = (search.foods ?? [])
    .filter(
      (food) =>
        food.fdcId &&
        food.gtinUpc &&
        normalizedBarcode(food.gtinUpc) === wantedBarcode
    )
    .sort((a, b) => {
      const dateDifference =
        Date.parse(b.publicationDate ?? "") -
        Date.parse(a.publicationDate ?? "");
      if (Number.isFinite(dateDifference) && dateDifference !== 0) {
        return dateDifference;
      }
      return (b.fdcId ?? 0) - (a.fdcId ?? 0);
    })[0];

  if (!match?.fdcId) return null;

  const food = await fetchFdc<FdcFood>(`/food/${match.fdcId}`, apiKey);
  if (!food.description || !food.fdcId) return null;

  // FDC's servingSize is only a "per piece" weight when the unit is grams —
  // other units (ml, IU, etc.) can't be used directly for kcal conversion.
  const servingSizeGrams =
    food.servingSizeUnit?.toLowerCase() === "g" &&
    typeof food.servingSize === "number" &&
    food.servingSize > 0
      ? food.servingSize
      : null;

  return {
    externalId: String(food.fdcId),
    barcode,
    name: food.description.trim(),
    brand: food.brandName?.trim() || food.brandOwner?.trim() || null,
    imageUrl: null,
    kcalPer100g: nutrientAmount(food, "208", "kcal"),
    proteinPer100g: nutrientAmount(food, "203", "g"),
    carbsPer100g: nutrientAmount(food, "205", "g"),
    fatPer100g: nutrientAmount(food, "204", "g"),
    servingSizeGrams,
  };
}
