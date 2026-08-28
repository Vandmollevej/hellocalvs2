// Midlertidigt "kladde"-lager for en egen ret, der er ved at blive
// sammensat på /opret-ret. Ingredienser tilføjes ved at navigere væk (søg,
// scan, manuel oprettelse) og tilbage igen, så listen skal overleve
// navigation uden en database-tur — sessionStorage er nok, og ryddes når
// retten gemmes eller opgives.

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
