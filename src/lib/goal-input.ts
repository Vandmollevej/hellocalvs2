import { GOAL_TARGET_TYPES, type GoalTargetType } from "@/lib/user-goals";

// Validering af målsætnings-input, delt af POST /api/goals og
// PATCH /api/goals/[id].

// Kalenderdato "YYYY-MM-DD" → Date kl. 12:00 UTC, så datoen ikke skifter ved
// tidszonekonvertering. Null ved ugyldig dato eller en dato før i dag.
export function parseTargetDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  // Én dags slæk, så en klient i en tidszone foran UTC kan vælge sin egen "i dag".
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return value >= yesterday ? date : null;
}

// { weight?: number, waistCm?: number, … } → validerede værdier, eller
// navnet på det første ugyldige felt.
export function parseTargetValues(
  raw: Record<string, unknown>,
): { values: Partial<Record<GoalTargetType, number>> } | { invalid: string } {
  const values: Partial<Record<GoalTargetType, number>> = {};
  for (const type of GOAL_TARGET_TYPES) {
    const value = raw[type];
    if (value == null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return { invalid: type };
    values[type] = value;
  }
  return { values };
}
