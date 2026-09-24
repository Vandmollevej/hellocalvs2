import { createHash } from "node:crypto";
import type { SharedRecipe } from "@prisma/client";

// Delte brugeropskrifter (docs/DECISIONS.md 2026-09-24). Serveren kender
// aldrig ejeren: ejerskab bevises med et udgivertoken fra ejerens boks, og
// kun SHA-256(token) gemmes. Offentlige svar indeholder aldrig publisherHash.

export const PUBLISHER_HEADER = "x-recipe-publisher";

export type SharedIngredient = {
  productId: string;
  name: string;
  grams: number;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export function hashPublisherToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function publisherHashFrom(req: Request): string | null {
  const token = req.headers.get(PUBLISHER_HEADER)?.trim();
  // Tokenet er 32 tilfældige bytes i base64url (43 tegn).
  if (!token || token.length < 32 || token.length > 128) return null;
  return hashPublisherToken(token);
}

// Pseudonym til admin (GDPR): stabilt pr. udgiver, men uden sammenhæng med
// konto eller boks.
export function publisherPseudonym(publisherHash: string): string {
  return `bruger-${publisherHash.slice(0, 6).toUpperCase()}`;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseIngredients(value: unknown): SharedIngredient[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null;
  const parsed: SharedIngredient[] = [];
  for (const raw of value as Record<string, unknown>[]) {
    const grams = finite(raw?.grams);
    const kcal = finite(raw?.kcalPer100g);
    const protein = finite(raw?.proteinPer100g);
    const carbs = finite(raw?.carbsPer100g);
    const fat = finite(raw?.fatPer100g);
    const name = typeof raw?.name === "string" ? raw.name.trim().slice(0, 200) : "";
    const productId = typeof raw?.productId === "string" ? raw.productId.slice(0, 100) : "";
    if (!name || !productId || !grams || kcal === null || protein === null || carbs === null || fat === null) {
      return null;
    }
    const imageUrl = typeof raw.imageUrl === "string" ? raw.imageUrl.slice(0, 500) : null;
    parsed.push({ productId, name, grams, imageUrl, kcalPer100g: kcal, proteinPer100g: protein, carbsPer100g: carbs, fatPer100g: fat });
  }
  return parsed;
}

export function totalsFor(ingredients: SharedIngredient[]) {
  return ingredients.reduce(
    (acc, i) => {
      const f = i.grams / 100;
      acc.totalGrams += i.grams;
      acc.kcal += i.kcalPer100g * f;
      acc.protein += i.proteinPer100g * f;
      acc.carbs += i.carbsPer100g * f;
      acc.fat += i.fatPer100g * f;
      return acc;
    },
    { totalGrams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function searchTextFor(name: string, ingredients: SharedIngredient[]) {
  return [name, ...ingredients.map((i) => i.name)].join(" ").toLowerCase();
}

// Det eneste, andre brugere får at se. Ingen udgiver, ingen anmeldelser.
export function toPublicRecipe(recipe: SharedRecipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    language: recipe.language,
    ingredients: recipe.ingredients as SharedIngredient[],
    totalGrams: recipe.totalGrams,
    kcal: recipe.kcal,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    // "Anmeld" vises kun, indtil admin har godkendt retten.
    canReport: recipe.status === "PENDING",
    createdAt: recipe.createdAt.toISOString(),
  };
}

export type PublicSharedRecipe = ReturnType<typeof toPublicRecipe>;
