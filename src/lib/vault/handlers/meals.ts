"use client";

// Registreringer (måltider), egne retter og favoritter i boksen
// (docs/PRIVACY.md). Erstatter /api/registrations, /api/dishes og
// /api/favorites med samme JSON-form.
//
// Snapshot-princippet bevares: kalorier og makroer beregnes ved
// registreringen ud fra produktet og ændres aldrig senere. Produktdata
// hentes fra den fælles, offentlige produktdatabase; hvad brugeren spiser,
// gemmes kun krypteret.

import { newRecordId } from "@/lib/vault/client";
import { json, route } from "@/lib/vault/local-api";
import { fulfillPendingForward } from "@/lib/vault/handlers/forwards";
import {
  PRIVATE_INGREDIENTS,
  PRIVATE_INGREDIENT_PREFIX,
  isPrivateIngredientId,
  privateIngredientProduct,
  type StoredPrivateIngredient,
} from "@/lib/vault/handlers/private-ingredients";

export const REGISTRATIONS = "registrations";
export const DISHES = "dishes";
export const FAVORITES = "favorites";

type PublicProduct = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSizeGrams: number | null;
  servingSizeUnitSingular: string | null;
  servingSizeUnitPlural: string | null;
  imageUrl: string | null;
  nutritionExtra?: Record<string, number> | null;
  saturatedFatPer100g?: number | null;
  unsaturatedFatPer100g?: number | null;
  transFatPer100g?: number | null;
  cholesterolPer100g?: number | null;
  vitaminAPer100g?: number | null;
  vitaminCPer100g?: number | null;
  isGenericIngredient?: boolean;
  [key: string]: unknown;
};

export type Registration = {
  id: string;
  productId: string | null;
  dishId: string | null;
  genericIngredientId: string | null;
  titleSnapshot: string;
  kcalSnapshot: number;
  proteinSnapshot: number;
  carbsSnapshot: number;
  fatSnapshot: number;
  amountGrams: number;
  sugarSnapshot: number | null;
  fiberSnapshot: number | null;
  saltSnapshot: number | null;
  potassiumSnapshot: number | null;
  calciumSnapshot: number | null;
  ironSnapshot: number | null;
  saturatedFatSnapshot: number | null;
  unsaturatedFatSnapshot: number | null;
  transFatSnapshot: number | null;
  cholesterolSnapshot: number | null;
  vitaminASnapshot: number | null;
  vitaminCSnapshot: number | null;
  createdAt: string;
  // Produktets billede og portionsenhed på registreringstidspunktet, så
  // listen kan vises uden at spørge serveren om hver registrering.
  product: {
    imageUrl: string | null;
    servingSizeGrams: number | null;
    servingSizeUnitSingular: string | null;
    servingSizeUnitPlural: string | null;
  } | null;
};

type StoredRegistration = Omit<Registration, "id">;

async function fetchProduct(id: string): Promise<PublicProduct | null> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return ((await res.json()) as { product: PublicProduct | null }).product;
}

let cachedTier: { tier: "FREE" | "SERIOUS"; at: number } | null = null;

// Rullende 30-dages historik for gratisbrugere (docs/DECISIONS.md
// 2026-09-19): ældre registreringer skjules, men slettes ikke.
async function retentionCutoff(): Promise<string | null> {
  if (!cachedTier || Date.now() - cachedTier.at > 5 * 60 * 1000) {
    const res = await fetch("/api/subscription").catch(() => null);
    const tier = res?.ok ? ((await res.json()) as { tier?: "FREE" | "SERIOUS" }).tier ?? "FREE" : "FREE";
    cachedTier = { tier, at: Date.now() };
  }
  if (cachedTier.tier === "SERIOUS") return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return cutoff.toISOString();
}

export function listRegistrations(vault: { list<T>(c: string): { id: string; value: T }[] }): Registration[] {
  return vault
    .list<StoredRegistration>(REGISTRATIONS)
    .map(({ id, value }) => ({ ...value, id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

route("GET", "/api/registrations", async ({ vault }) => {
  const cutoff = await retentionCutoff();
  const registrations = listRegistrations(vault)
    .filter((r) => !cutoff || r.createdAt >= cutoff)
    .slice(0, 3000);
  return json({ registrations });
});

route("GET", "/api/registrations/:id", ({ vault, params }) => {
  const value = vault.get<StoredRegistration>(REGISTRATIONS, params.id);
  return value ? json({ registration: { ...value, id: params.id } }) : json({ registration: null }, 404);
});

route("PATCH", "/api/registrations/:id", async ({ vault, params, body }) => {
  const { createdAt } = (await body()) as { createdAt?: string };
  if (!createdAt) return json({ message: "createdAt er påkrævet" }, 400);
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return json({ message: "Ugyldig createdAt" }, 400);
  const value = vault.get<StoredRegistration>(REGISTRATIONS, params.id);
  if (!value) return json({ message: "Registreringen findes ikke" }, 404);
  await vault.put(REGISTRATIONS, params.id, { ...value, createdAt: parsed.toISOString() });
  return json({ ok: true });
});

route("DELETE", "/api/registrations/:id", async ({ vault, params }) => {
  if (!vault.get(REGISTRATIONS, params.id)) return json({ message: "Registreringen findes ikke" }, 404);
  await vault.remove(REGISTRATIONS, params.id);
  return json({ deleted: true });
});

const EMPTY_EXTRAS = {
  sugarSnapshot: null,
  fiberSnapshot: null,
  saltSnapshot: null,
  potassiumSnapshot: null,
  calciumSnapshot: null,
  ironSnapshot: null,
  saturatedFatSnapshot: null,
  unsaturatedFatSnapshot: null,
  transFatSnapshot: null,
  cholesterolSnapshot: null,
  vitaminASnapshot: null,
  vitaminCSnapshot: null,
};

function productInfo(p: PublicProduct | null): Registration["product"] {
  if (!p) return null;
  return {
    imageUrl: p.imageUrl ?? null,
    servingSizeGrams: p.servingSizeGrams ?? null,
    servingSizeUnitSingular: p.servingSizeUnitSingular ?? null,
    servingSizeUnitPlural: p.servingSizeUnitPlural ?? null,
  };
}

type RegistrationInput = {
  productId?: string;
  dishId?: string;
  genericIngredientId?: string;
  amountGrams?: number;
  titleSnapshot?: string;
  kcalSnapshot?: number;
  proteinSnapshot?: number;
  carbsSnapshot?: number;
  fatSnapshot?: number;
  createdAt?: string;
};

route("POST", "/api/registrations", async ({ vault, body }) => {
  const input = (await body()) as RegistrationInput;
  const amountGrams = input.amountGrams;
  if (!amountGrams || amountGrams <= 0) return json({ message: "amountGrams (> 0) er påkrævet" }, 400);
  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
  if (Number.isNaN(createdAt.getTime())) return json({ message: "createdAt er ugyldig" }, 400);

  const base = {
    productId: null,
    dishId: null,
    genericIngredientId: null,
    amountGrams,
    createdAt: createdAt.toISOString(),
    ...EMPTY_EXTRAS,
  };
  let registration: StoredRegistration;

  if (input.productId || input.genericIngredientId) {
    const id = (input.productId ?? input.genericIngredientId)!;
    const product = await fetchProduct(id);
    if (!product) {
      return json({ message: input.productId ? "Produkt ikke fundet" : "Ingrediens ikke fundet" }, 404);
    }
    const factor = amountGrams / 100;
    const scaled = (v: number | null | undefined) => (v !== null && v !== undefined ? v * factor : null);
    // nutritionExtra er pr. produktets egen portion, ikke pr. 100 g.
    const extraFactor = product.servingSizeGrams ? amountGrams / product.servingSizeGrams : null;
    const extra = product.nutritionExtra ?? null;
    const scaledExtra = (key: string) =>
      extraFactor !== null && extra && typeof extra[key] === "number" ? extra[key] * extraFactor : null;
    const generic = Boolean(product.isGenericIngredient);

    registration = {
      ...base,
      productId: generic ? null : product.id,
      genericIngredientId: generic ? product.id : null,
      titleSnapshot: product.name,
      kcalSnapshot: input.kcalSnapshot ?? product.kcalPer100g * factor,
      proteinSnapshot: input.proteinSnapshot ?? product.proteinPer100g * factor,
      carbsSnapshot: input.carbsSnapshot ?? product.carbsPer100g * factor,
      fatSnapshot: input.fatSnapshot ?? product.fatPer100g * factor,
      ...(generic
        ? {}
        : {
            sugarSnapshot: scaledExtra("sugarG"),
            fiberSnapshot: scaledExtra("fiberG"),
            saltSnapshot: scaledExtra("saltG"),
            potassiumSnapshot: scaledExtra("potassiumMg"),
            calciumSnapshot: scaledExtra("calciumMg"),
            ironSnapshot: scaledExtra("ironMg"),
            saturatedFatSnapshot: scaled(product.saturatedFatPer100g),
            unsaturatedFatSnapshot: scaled(product.unsaturatedFatPer100g),
            transFatSnapshot: scaled(product.transFatPer100g),
            cholesterolSnapshot: scaled(product.cholesterolPer100g),
            vitaminASnapshot: scaled(product.vitaminAPer100g),
            vitaminCSnapshot: scaled(product.vitaminCPer100g),
          }),
      product: productInfo(product),
    };

    // Brugerindberetning (docs/DECISIONS.md 2026-09-23): ændrede makroer
    // sendes anonymt til Kvalitetskontrol. Serveren afgør selv, om det er en
    // reel ændring; rapporten får aldrig bruger- eller registrerings-ID.
    if (!generic && [input.proteinSnapshot, input.carbsSnapshot, input.fatSnapshot].some((v) => v !== undefined)) {
      void reportNutritionEdit(product.id, amountGrams, input);
    }
  } else if (input.dishId) {
    const dish = vault.get<StoredDish>(DISHES, input.dishId);
    if (!dish) return json({ message: "Ret ikke fundet" }, 404);
    const totals = dish.ingredients.reduce(
      (acc, i) => {
        const f = i.grams / 100;
        acc.grams += i.grams;
        acc.kcal += i.product.kcalPer100g * f;
        acc.protein += i.product.proteinPer100g * f;
        acc.carbs += i.product.carbsPer100g * f;
        acc.fat += i.product.fatPer100g * f;
        return acc;
      },
      { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const scale = totals.grams > 0 ? amountGrams / totals.grams : 0;
    registration = {
      ...base,
      dishId: input.dishId,
      titleSnapshot: dish.name,
      kcalSnapshot: input.kcalSnapshot ?? totals.kcal * scale,
      proteinSnapshot: input.proteinSnapshot ?? totals.protein * scale,
      carbsSnapshot: input.carbsSnapshot ?? totals.carbs * scale,
      fatSnapshot: input.fatSnapshot ?? totals.fat * scale,
      product: null,
    };
  } else {
    const { titleSnapshot, kcalSnapshot, proteinSnapshot, carbsSnapshot, fatSnapshot } = input;
    if (
      !titleSnapshot ||
      kcalSnapshot === undefined ||
      proteinSnapshot === undefined ||
      carbsSnapshot === undefined ||
      fatSnapshot === undefined
    ) {
      return json({ message: "productId, eller titleSnapshot + alle snapshot-værdier, er påkrævet" }, 400);
    }
    // AI-fundet madvare uden match: oprettes som anonym PENDING-kandidat i
    // den fælles produktdatabase (docs/ADMIN.md), uden kobling til brugeren.
    const factor = amountGrams / 100;
    const res = await fetch("/api/products/candidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: titleSnapshot,
        kcalPer100g: kcalSnapshot / factor,
        proteinPer100g: proteinSnapshot / factor,
        carbsPer100g: carbsSnapshot / factor,
        fatPer100g: fatSnapshot / factor,
      }),
    }).catch(() => null);
    const candidateId = res?.ok ? ((await res.json()) as { product?: { id?: string } }).product?.id ?? null : null;
    registration = {
      ...base,
      productId: candidateId,
      titleSnapshot,
      kcalSnapshot,
      proteinSnapshot,
      carbsSnapshot,
      fatSnapshot,
      product: null,
    };
  }

  const id = newRecordId();
  await vault.put(REGISTRATIONS, id, registration);
  if (registration.productId) {
    await fulfillPendingForward(vault, "PRODUCT", registration.productId);
    // Anonym popularitet til Kvalitetskontrol — uden bruger (docs/PRIVACY.md).
    void fetch("/api/analytics/product-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: registration.productId }),
    }).catch(() => undefined);
  }
  if (registration.dishId) await fulfillPendingForward(vault, "DISH", registration.dishId);
  return json({ registration: { ...registration, id } });
});

async function reportNutritionEdit(productId: string, amountGrams: number, input: RegistrationInput) {
  // Samme felter som den tidligere serverkontrol: snapshot-værdierne for den
  // registrerede mængde (detectNutritionChanges omregner selv til pr. 100 g).
  await fetch(`/api/products/${encodeURIComponent(productId)}/nutrition-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amountGrams,
      proteinPer100g: input.proteinSnapshot,
      carbsPer100g: input.carbsSnapshot,
      fatPer100g: input.fatSnapshot,
    }),
  }).catch(() => null);
}

// ---------- egne retter ----------

type DishIngredient = { id: string; productId: string; grams: number; product: PublicProduct };
type StoredDish = {
  name: string;
  createdAt: string;
  ingredients: DishIngredient[];
  // Offentligt ID på den delte udgave (handlers/shared-recipes.ts).
  sharedRecipeId?: string | null;
};

export function listDishes(vault: { list<T>(c: string): { id: string; value: T }[] }) {
  return vault
    .list<StoredDish>(DISHES)
    .map(({ id, value }) => ({ ...value, id }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

route("GET", "/api/dishes", ({ vault }) => json({ dishes: listDishes(vault) }));

route("GET", "/api/dishes/:id", async ({ vault, params }) => {
  const dish = vault.get<StoredDish>(DISHES, params.id);
  if (dish) return json({ dish: { ...dish, id: params.id } });
  // Ikke brugerens egen ret (fx en fælles HelloFresh-ret): spørg serveren.
  return fetch(`/api/dishes/${encodeURIComponent(params.id)}`);
});

route("POST", "/api/dishes", async ({ vault, body }) => {
  const input = (await body()) as { name?: unknown; ingredients?: { productId?: unknown; grams?: unknown }[] };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const ingredients = Array.isArray(input.ingredients) ? input.ingredients : [];
  if (!name) return json({ message: "Navn er påkrævet" }, 400);
  if (
    ingredients.length === 0 ||
    !ingredients.every((i) => typeof i.productId === "string" && typeof i.grams === "number" && i.grams > 0)
  ) {
    return json({ message: "Mindst én ingrediens (produkt + gram > 0) er påkrævet" }, 400);
  }
  const resolved: DishIngredient[] = [];
  for (const i of ingredients) {
    // Private ingredienser (boksen) slås op lokalt og sendes aldrig til serveren.
    const productId = i.productId as string;
    const privateId = productId.slice(PRIVATE_INGREDIENT_PREFIX.length);
    const stored = isPrivateIngredientId(productId)
      ? vault.get<StoredPrivateIngredient>(PRIVATE_INGREDIENTS, privateId)
      : undefined;
    const product = isPrivateIngredientId(productId)
      ? stored && privateIngredientProduct(privateId, stored)
      : await fetchProduct(productId);
    if (!product) return json({ message: "Produkt ikke fundet" }, 404);
    resolved.push({ id: newRecordId(), productId: product.id, grams: i.grams as number, product });
  }
  const id = newRecordId();
  const dish: StoredDish = { name, createdAt: new Date().toISOString(), ingredients: resolved };
  await vault.put(DISHES, id, dish);
  return json({ dish: { ...dish, id } }, 201);
});

// ---------- favoritter (kun produkter) ----------

type StoredFavorite = { productId: string; product: PublicProduct; createdAt: string };

route("GET", "/api/favorites", ({ vault }) =>
  json({
    favorites: vault
      .list<StoredFavorite>(FAVORITES)
      .sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))
      .map(({ id, value }) => ({ id, product: value.product })),
  })
);

// Favoritter gemmes med produktet som ID, så samme produkt kun kan være
// favorit én gang.
route("POST", "/api/favorites", async ({ vault, body }) => {
  const { productId } = (await body()) as { productId?: unknown };
  if (typeof productId !== "string") return json({ message: "productId mangler" }, 400);
  const existing = vault.get<StoredFavorite>(FAVORITES, productId);
  if (existing) return json({ favorite: { id: productId, productId } });
  const product = await fetchProduct(productId);
  if (!product) return json({ message: "Kunne ikke gemme favorit" }, 404);
  await vault.put<StoredFavorite>(FAVORITES, productId, { productId, product, createdAt: new Date().toISOString() });
  return json({ favorite: { id: productId, productId } });
});

route("DELETE", "/api/favorites", async ({ vault, body }) => {
  const { productId } = (await body()) as { productId?: unknown };
  if (typeof productId !== "string") return json({ message: "productId mangler" }, 400);
  if (vault.get(FAVORITES, productId)) await vault.remove(FAVORITES, productId);
  return json({ ok: true });
});
