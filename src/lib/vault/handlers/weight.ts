"use client";

// Vejninger i boksen — erstatter /api/weight-entries (samme JSON-form som
// Prisma-modellen WeightEntry, uden userId).

import { newRecordId } from "@/lib/vault/client";
import { json, route } from "@/lib/vault/local-api";

export type WeightEntry = {
  id: string;
  weightKg: number;
  clothed: boolean;
  shoes: "ON" | "OFF" | "UNKNOWN";
  toilet: "BEFORE" | "AFTER" | "UNKNOWN";
  meal: "BEFORE" | "AFTER" | "UNKNOWN";
  timeOfDay: "MORNING" | "EVENING" | "UNKNOWN";
  source: "MANUAL" | "FITBIT" | "WITHINGS" | "APPLE_HEALTH" | "GOOGLE_HEALTH";
  note: string | null;
  weighedAt: string;
};

export const WEIGHT = "weight";

type Stored = Omit<WeightEntry, "id">;

export function listWeightEntries(vault: { list<T>(c: string): { id: string; value: T }[] }): WeightEntry[] {
  return vault
    .list<Stored>(WEIGHT)
    .map(({ id, value }) => ({ id, ...value }))
    .sort((a, b) => b.weighedAt.localeCompare(a.weighedAt));
}

route("GET", "/api/weight-entries", ({ vault }) => json({ entries: listWeightEntries(vault).slice(0, 200) }));

route("POST", "/api/weight-entries", async ({ vault, body }) => {
  const input = (await body()) as Partial<Stored> & { weighedAt?: string };
  if (!input.weightKg || input.weightKg <= 0) return json({ message: "weightKg (> 0) er påkrævet" }, 400);
  const weighedAt = input.weighedAt ? new Date(input.weighedAt) : new Date();
  if (Number.isNaN(weighedAt.getTime())) return json({ message: "weighedAt er ugyldig" }, 400);

  const entry: WeightEntry = {
    id: newRecordId(),
    weightKg: input.weightKg,
    clothed: input.clothed ?? true,
    shoes: input.shoes ?? "UNKNOWN",
    toilet: input.toilet ?? "UNKNOWN",
    meal: input.meal ?? "UNKNOWN",
    timeOfDay: input.timeOfDay ?? "UNKNOWN",
    source: input.source ?? "MANUAL",
    note: input.note || null,
    weighedAt: weighedAt.toISOString(),
  };
  const { id, ...stored } = entry;
  await vault.put<Stored>(WEIGHT, id, stored);
  return json({ entry });
});

route("PATCH", "/api/weight-entries/:id", async ({ vault, params, body }) => {
  const { weightKg } = (await body()) as { weightKg?: number };
  if (!weightKg || weightKg <= 0) return json({ message: "weightKg (> 0) er påkrævet" }, 400);
  const existing = vault.get<Stored>(WEIGHT, params.id);
  if (!existing) return json({ message: "Vejningen findes ikke" }, 404);
  await vault.put<Stored>(WEIGHT, params.id, { ...existing, weightKg });
  return json({ updated: true });
});

route("DELETE", "/api/weight-entries/:id", async ({ vault, params }) => {
  if (!vault.get<Stored>(WEIGHT, params.id)) return json({ message: "Vejningen findes ikke" }, 404);
  await vault.remove(WEIGHT, params.id);
  return json({ deleted: true });
});
