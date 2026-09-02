// Temporary "draft" storage for a custom dish being assembled on
// /create-dish. Ingredients are added by navigating away (search,
// scan, manual creation) and back again, so the list needs to survive
// navigation without a database round trip — sessionStorage is enough,
// and it is cleared when the dish is saved or abandoned.

const STORAGE_KEY = "hellocal.dishDraftIngredients";

export type DishDraftIngredient = {
  productId: string;
  name: string;
  imageUrl?: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  grams: number;
};

export function readDishDraft(): DishDraftIngredient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDishDraft(ingredients: DishDraftIngredient[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients));
  } catch {
    // Prototype: ignore storage failures (private browsing, quota, ...).
  }
}

export function appendDishDraftIngredient(ingredient: DishDraftIngredient) {
  const current = readDishDraft();
  writeDishDraft([...current, ingredient]);
}

export function removeDishDraftIngredient(index: number) {
  const current = readDishDraft();
  writeDishDraft(current.filter((_, i) => i !== index));
}

export function clearDishDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
