"use client";

// Egne, private ingredienser (docs/DECISIONS.md 2026-09-24). Ligger kun i
// brugerens boks og vises kun for brugeren selv. Brugeren angiver kun et
// navn — næringsindholdet kender brugeren ikke, så det står som ukendt,
// indtil admin har oprettet ingrediensen globalt. Serveren får kun navnet og
// en anonym engangsindbakke (src/lib/ingredient-requests.ts); når admin
// tilføjer den, erstattes den private automatisk (handlers/inbox.ts).

import { newRecordId } from "@/lib/vault/client";
import { json, route } from "@/lib/vault/local-api";

export const PRIVATE_INGREDIENTS = "privateIngredients";
// Produkt-ID'er med dette præfiks peger på en privat ingrediens i boksen og
// sendes aldrig til serveren.
export const PRIVATE_INGREDIENT_PREFIX = "private:";
const NAME_MAX = 80;

export type StoredPrivateIngredient = { name: string; createdAt: string; requestId: string | null };

export function isPrivateIngredientId(productId: string) {
  return productId.startsWith(PRIVATE_INGREDIENT_PREFIX);
}

// Samme form som et produkt fra /api/products/:id, så retter kan bruge den.
export function privateIngredientProduct(id: string, ingredient: StoredPrivateIngredient) {
  return {
    id: `${PRIVATE_INGREDIENT_PREFIX}${id}`,
    name: ingredient.name,
    kcalPer100g: 0,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 0,
    servingSizeGrams: null,
    servingSizeUnitSingular: null,
    servingSizeUnitPlural: null,
    imageUrl: null,
    productCategory: "INGREDIENT",
    isPrivateIngredient: true,
    hasKnownNutrition: false,
  };
}

function listPrivate(vault: { list<T>(c: string): { id: string; value: T }[] }) {
  return vault
    .list<StoredPrivateIngredient>(PRIVATE_INGREDIENTS)
    .map(({ id, value }) => ({ id, ...value }))
    .sort((a, b) => a.name.localeCompare(b.name, "da"));
}

route("GET", "/api/private-ingredients", ({ vault, query }) => {
  const q = query.get("q")?.trim().toLowerCase() ?? "";
  const ingredients = listPrivate(vault).filter((i) => !q || i.name.toLowerCase().includes(q));
  return json({ ingredients });
});

route("GET", "/api/private-ingredients/:id", ({ vault, params }) => {
  const ingredient = vault.get<StoredPrivateIngredient>(PRIVATE_INGREDIENTS, params.id);
  if (!ingredient) return json({ message: "Ikke fundet" }, 404);
  return json({ ingredient: { id: params.id, ...ingredient } });
});

route("POST", "/api/private-ingredients", async ({ vault, body }) => {
  const { name: raw } = (await body()) as { name?: unknown };
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || name.length > NAME_MAX) return json({ message: "Giv ingrediensen et navn" }, 400);

  // Anonym anmodning til admin. Fejler den, gemmes ingrediensen alligevel
  // privat — den bliver bare ikke foreslået globalt.
  let requestId: string | null = null;
  const inboxId = await vault.createInbox().catch(() => null);
  const res = await fetch("/api/ingredient-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, inboxId }),
  }).catch(() => null);
  if (res?.ok) requestId = ((await res.json()) as { requestId?: string }).requestId ?? null;

  const id = newRecordId();
  const ingredient: StoredPrivateIngredient = { name, createdAt: new Date().toISOString(), requestId };
  await vault.put(PRIVATE_INGREDIENTS, id, ingredient);
  return json({ ingredient: { id, ...ingredient } }, 201);
});

route("PATCH", "/api/private-ingredients/:id", async ({ vault, params, body }) => {
  const existing = vault.get<StoredPrivateIngredient>(PRIVATE_INGREDIENTS, params.id);
  if (!existing) return json({ message: "Ikke fundet" }, 404);
  const { name: raw } = (await body()) as { name?: unknown };
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || name.length > NAME_MAX) return json({ message: "Giv ingrediensen et navn" }, 400);
  const ingredient = { ...existing, name };
  await vault.put(PRIVATE_INGREDIENTS, params.id, ingredient);
  return json({ ingredient: { id: params.id, ...ingredient } });
});

route("DELETE", "/api/private-ingredients/:id", async ({ vault, params }) => {
  if (!vault.get(PRIVATE_INGREDIENTS, params.id)) return json({ message: "Ikke fundet" }, 404);
  await vault.remove(PRIVATE_INGREDIENTS, params.id);
  return json({ ok: true });
});
