"use client";

// Delte brugeropskrifter på enheden (docs/DECISIONS.md 2026-09-24).
//
// - Udgivertokenet ligger kun i boksen. Serveren ser kun SHA-256(token) og
//   kan derfor ikke se, hvem der har delt en ret. Slettes boksen (konto),
//   kan ingen længere ændre retten, og den bliver liggende anonymt.
// - Favoritter på andres delte retter gemmes som en kopi i boksen, så de
//   bevares, selvom ejeren sletter retten eller stopper delingen.
// - "Gem som egen kopi" opretter en privat, uafhængig ret i boksen.

import { newRecordId } from "@/lib/vault/client";
import { json, route } from "@/lib/vault/local-api";
import { DISHES } from "@/lib/vault/handlers/meals";
import type { VaultClient } from "@/lib/vault/client";

export const RECIPE_FAVORITES = "recipeFavorites";
const SETTINGS = "settings";
const PUBLISHER_ID = "recipePublisher";
const PUBLISHER_HEADER = "x-recipe-publisher";

type Vault = Pick<VaultClient, "get" | "put" | "list" | "remove">;

type DishProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  [key: string]: unknown;
};
type StoredDish = {
  name: string;
  createdAt: string;
  ingredients: { id: string; productId: string; grams: number; product: DishProduct }[];
  // Offentligt ID på den delte udgave, når retten er delt.
  sharedRecipeId?: string | null;
};

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
export type PublicSharedRecipe = {
  id: string;
  name: string;
  language: string;
  ingredients: SharedIngredient[];
  totalGrams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  canReport: boolean;
  createdAt: string;
};
type StoredFavorite = { recipe: PublicSharedRecipe; savedAt: string };

async function publisherToken(vault: Vault): Promise<string> {
  const existing = vault.get<{ token: string }>(SETTINGS, PUBLISHER_ID);
  if (existing?.token) return existing.token;
  const token = newRecordId() + newRecordId();
  await vault.put(SETTINGS, PUBLISHER_ID, { token });
  return token;
}

function toSharedIngredients(dish: StoredDish): SharedIngredient[] {
  return dish.ingredients.map((i) => ({
    productId: i.productId,
    name: i.product.name,
    grams: i.grams,
    imageUrl: i.product.imageUrl ?? null,
    kcalPer100g: i.product.kcalPer100g,
    proteinPer100g: i.product.proteinPer100g,
    carbsPer100g: i.product.carbsPer100g,
    fatPer100g: i.product.fatPer100g,
  }));
}

function markUsed(id: string) {
  void fetch(`/api/shared-recipes/${encodeURIComponent(id)}/used`, { method: "POST" }).catch(() => undefined);
}

// Slå deling af en egen ret til/fra. Til: retten udgives (afventer admin,
// men er synlig med det samme). Fra: den delte udgave slettes på serveren.
route("PATCH", "/api/dishes/:id/share", async ({ vault, params, body }) => {
  const { shared, language } = (await body()) as { shared?: unknown; language?: unknown };
  const dish = vault.get<StoredDish>(DISHES, params.id);
  if (!dish) return json({ message: "Ret ikke fundet" }, 404);
  const token = await publisherToken(vault);

  if (shared === true && !dish.sharedRecipeId) {
    const res = await fetch("/api/shared-recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json", [PUBLISHER_HEADER]: token },
      body: JSON.stringify({ name: dish.name, language: language === "en" ? "en" : "da", ingredients: toSharedIngredients(dish) }),
    });
    const data = (await res.json().catch(() => ({}))) as { recipe?: { id: string }; message?: string };
    if (!res.ok || !data.recipe) return json({ message: data.message ?? "Kunne ikke dele retten" }, res.status || 503);
    await vault.put(DISHES, params.id, { ...dish, sharedRecipeId: data.recipe.id });
    return json({ sharedRecipeId: data.recipe.id });
  }

  if (shared === false && dish.sharedRecipeId) {
    const res = await fetch(`/api/shared-recipes/${encodeURIComponent(dish.sharedRecipeId)}`, {
      method: "DELETE",
      headers: { [PUBLISHER_HEADER]: token },
    });
    // 404: allerede væk (fx afvist og ryddet op) — delingen er slået fra.
    if (!res.ok && res.status !== 404) return json({ message: "Kunne ikke stoppe delingen" }, res.status);
    await vault.put(DISHES, params.id, { ...dish, sharedRecipeId: null });
    return json({ sharedRecipeId: null });
  }

  return json({ sharedRecipeId: dish.sharedRecipeId ?? null });
});

// En delt ret: fra serveren, ellers brugerens gemte favorit-kopi (ejeren kan
// have slettet den eller stoppet delingen).
route("GET", "/api/shared-recipes/:id", async ({ vault, params }) => {
  const res = await fetch(`/api/shared-recipes/${encodeURIComponent(params.id)}`).catch(() => null);
  const favorite = vault.get<StoredFavorite>(RECIPE_FAVORITES, params.id);
  if (res?.ok) {
    const data = (await res.json()) as { recipe: PublicSharedRecipe };
    return json({ recipe: data.recipe, isFavorite: Boolean(favorite) });
  }
  if (favorite) return json({ recipe: { ...favorite.recipe, canReport: false }, isFavorite: true });
  return json({ recipe: null, isFavorite: false }, res?.status ?? 503);
});

route("GET", "/api/recipe-favorites", ({ vault }) =>
  json({
    favorites: vault
      .list<StoredFavorite>(RECIPE_FAVORITES)
      .sort((a, b) => b.value.savedAt.localeCompare(a.value.savedAt))
      .map(({ value }) => value.recipe),
  })
);

route("POST", "/api/recipe-favorites", async ({ vault, body }) => {
  const { recipeId } = (await body()) as { recipeId?: unknown };
  if (typeof recipeId !== "string") return json({ message: "recipeId mangler" }, 400);
  if (vault.get(RECIPE_FAVORITES, recipeId)) return json({ ok: true });
  const res = await fetch(`/api/shared-recipes/${encodeURIComponent(recipeId)}`);
  if (!res.ok) return json({ message: "Kunne ikke gemme favorit" }, 404);
  const { recipe } = (await res.json()) as { recipe: PublicSharedRecipe };
  await vault.put<StoredFavorite>(RECIPE_FAVORITES, recipeId, { recipe, savedAt: new Date().toISOString() });
  markUsed(recipeId);
  return json({ ok: true });
});

route("DELETE", "/api/recipe-favorites", async ({ vault, body }) => {
  const { recipeId } = (await body()) as { recipeId?: unknown };
  if (typeof recipeId !== "string") return json({ message: "recipeId mangler" }, 400);
  if (vault.get(RECIPE_FAVORITES, recipeId)) await vault.remove(RECIPE_FAVORITES, recipeId);
  return json({ ok: true });
});

// "Gem som egen kopi": en privat, uafhængig ret, som brugeren selv ejer.
route("POST", "/api/shared-recipes/:id/copy", async ({ vault, params }) => {
  let recipe: PublicSharedRecipe | null = null;
  const res = await fetch(`/api/shared-recipes/${encodeURIComponent(params.id)}`).catch(() => null);
  if (res?.ok) recipe = ((await res.json()) as { recipe: PublicSharedRecipe }).recipe;
  else recipe = vault.get<StoredFavorite>(RECIPE_FAVORITES, params.id)?.recipe ?? null;
  if (!recipe) return json({ message: "Retten findes ikke" }, 404);

  const dish: StoredDish = {
    name: recipe.name,
    createdAt: new Date().toISOString(),
    sharedRecipeId: null,
    ingredients: recipe.ingredients.map((i) => ({
      id: newRecordId(),
      productId: i.productId,
      grams: i.grams,
      product: {
        id: i.productId,
        name: i.name,
        imageUrl: i.imageUrl,
        kcalPer100g: i.kcalPer100g,
        proteinPer100g: i.proteinPer100g,
        carbsPer100g: i.carbsPer100g,
        fatPer100g: i.fatPer100g,
        servingSizeGrams: null,
        servingSizeUnitSingular: null,
        servingSizeUnitPlural: null,
      },
    })),
  };
  const id = newRecordId();
  await vault.put(DISHES, id, dish);
  markUsed(params.id);
  return json({ dish: { ...dish, id } }, 201);
});
