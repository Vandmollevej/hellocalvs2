"use client";

// Flytter forseglede data fra integrationernes indbakker ind i boksen
// (docs/PRIVACY.md). Hver post får et fast ID ud fra kilde og tidspunkt, så
// den samme vejning/aktivitet aldrig bliver gemt to gange, selv om serveren
// leverer den igen ved næste synkronisering.

import type { VaultClient } from "@/lib/vault/client";
import { WEIGHT } from "@/lib/vault/handlers/weight";
import { ACTIVITIES, HEALTH } from "@/lib/vault/handlers/tracking";
import { DISHES } from "@/lib/vault/handlers/meals";
import {
  PRIVATE_INGREDIENTS,
  PRIVATE_INGREDIENT_PREFIX,
  type StoredPrivateIngredient,
} from "@/lib/vault/handlers/private-ingredients";

type Payload = Record<string, unknown>;

function stamp(value: unknown): number | null {
  const t = typeof value === "string" ? new Date(value).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
}

const safe = (value: unknown) => String(value).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);

type DishLike = { ingredients: { productId: string; product: unknown }[] };

// Admin har oprettet brugerens egen ingrediens globalt (src/lib/ingredient-requests.ts):
// den globale erstatter den private — også i brugerens egne retter.
async function replaceWithGlobalIngredient(vault: VaultClient, p: Payload) {
  if (typeof p.requestId !== "string" || typeof p.productId !== "string") return;
  const match = vault
    .list<StoredPrivateIngredient>(PRIVATE_INGREDIENTS)
    .find(({ value }) => value.requestId === p.requestId);
  if (!match) return;
  const res = await fetch(`/api/products/${encodeURIComponent(p.productId)}`);
  if (!res.ok) throw new Error("Global ingrediens kunne ikke hentes");
  const { product } = (await res.json()) as { product: { id: string } | null };
  if (!product) throw new Error("Global ingrediens findes ikke");
  const privateId = `${PRIVATE_INGREDIENT_PREFIX}${match.id}`;
  for (const { id, value } of vault.list<DishLike>(DISHES)) {
    if (!value.ingredients.some((i) => i.productId === privateId)) continue;
    await vault.put(DISHES, id, {
      ...value,
      ingredients: value.ingredients.map((i) => (i.productId === privateId ? { ...i, productId: product.id, product } : i)),
    });
  }
  await vault.remove(PRIVATE_INGREDIENTS, match.id);
}

export async function drainIntoVault(vault: VaultClient) {
  const now = new Date().toISOString();
  return vault.drainInboxes(async ({ kind, payload }) => {
    const p = payload as Payload;
    if (kind === "weight") {
      const t = stamp(p.weighedAt);
      if (t === null || typeof p.weightKg !== "number") return;
      await vault.put(WEIGHT, `${safe(p.source)}_${t}`, {
        weightKg: p.weightKg,
        clothed: true,
        shoes: "UNKNOWN",
        toilet: "UNKNOWN",
        meal: "UNKNOWN",
        timeOfDay: "UNKNOWN",
        source: p.source,
        note: null,
        weighedAt: new Date(t).toISOString(),
      });
    } else if (kind === "activity") {
      const t = stamp(p.startedAt);
      if (t === null) return;
      await vault.put(ACTIVITIES, `${safe(p.source)}_${t}`, {
        source: p.source,
        sportType: p.sportType,
        startedAt: new Date(t).toISOString(),
        durationMinutes: p.durationMinutes,
        caloriesBurned: p.caloriesBurned,
        createdAt: now,
      });
    } else if (kind === "globalIngredient") {
      await replaceWithGlobalIngredient(vault, p);
    } else if (kind === "metric") {
      const t = stamp(p.recordedAt);
      if (t === null) return;
      await vault.put(HEALTH, `${safe(p.source)}_${safe(p.type)}_${t}`, {
        source: p.source,
        type: p.type,
        value: p.value,
        recordedAt: new Date(t).toISOString(),
        createdAt: now,
      });
    }
  });
}
