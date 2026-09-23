"use client";

// Målsætninger i boksen — erstatter /api/goals (docs/PRIVACY.md).
// Gennemført-status beregnes på enheden ud fra vejninger og kropsmål.

import { newRecordId } from "@/lib/vault/client";
import { json, route } from "@/lib/vault/local-api";
import { listWeightEntries } from "@/lib/vault/handlers/weight";
import { listBody } from "@/lib/vault/handlers/tracking";
import { readPrivateProfile, updatePrivateProfile } from "@/lib/vault/handlers/profile";
import {
  buildReadings,
  getGoalDirection,
  GOAL_TARGET_TYPES,
  latestValues,
  refreshGoal,
  toGoalDTO,
  unitForTarget,
  WEIGHT_TARGET,
  type GoalTargetType,
  type StoredGoal,
} from "@/lib/user-goals";
import type { VaultClient } from "@/lib/vault/client";

export const GOALS = "goals";

function readings(vault: VaultClient) {
  return buildReadings(listWeightEntries(vault), listBody(vault));
}

route("GET", "/api/goals", async ({ vault }) => {
  const current = readings(vault);
  const updates: { id: string; value: StoredGoal }[] = [];
  const goals = vault.list<StoredGoal>(GOALS).map(({ id, value }) => {
    const refreshed = refreshGoal(value, current);
    if (refreshed) updates.push({ id, value: refreshed });
    return { id, value: refreshed ?? value };
  });
  if (updates.length > 0) await vault.putMany(GOALS, updates);
  return json({
    goals: goals
      .sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))
      .map(({ id, value }) => toGoalDTO(id, value)),
  });
});

// Kalenderdato "YYYY-MM-DD"; én dags slæk bagud for tidszoner foran UTC.
function parseTargetDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return value >= yesterday ? value : null;
}

route("POST", "/api/goals", async ({ vault, body }) => {
  const input = (await body()) as { targetDate?: unknown; targets?: Record<string, unknown> };
  const targetDate = parseTargetDate(input.targetDate);
  if (!targetDate) return json({ message: "Ugyldig målsætningsdato" }, 400);

  const values: Partial<Record<GoalTargetType, number>> = {};
  for (const type of GOAL_TARGET_TYPES) {
    const value = input.targets?.[type];
    if (value == null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return json({ message: `Ugyldig værdi for ${type}` }, 400);
    }
    values[type] = value;
  }
  if (Object.keys(values).length === 0) return json({ message: "Mindst ét mål er påkrævet" }, 400);

  const latest = latestValues(readings(vault), readPrivateProfile(vault).weightKg);
  const goal: StoredGoal = {
    createdAt: new Date().toISOString(),
    targetDate,
    targets: GOAL_TARGET_TYPES.flatMap((type) => {
      const value = values[type];
      if (value == null) return [];
      const startValue = latest.get(type) ?? null;
      return [
        {
          id: newRecordId(),
          type,
          value,
          unit: unitForTarget(type),
          startValue,
          direction: startValue != null ? getGoalDirection(startValue, value) : null,
          completedAt: null,
        },
      ];
    }),
  };
  const id = newRecordId();
  await vault.put(GOALS, id, goal);

  // Profilen og Hello Doc læser targetWeightKg — hold det i sync med den
  // nyeste vægt-målsætning.
  if (values[WEIGHT_TARGET] != null) await updatePrivateProfile(vault, { targetWeightKg: values[WEIGHT_TARGET] });
  return json({ goal: { id } });
});
