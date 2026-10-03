// Profil → Status (2026-10-03): nuværende vægt, målvægt og historik for vægt
// og kropsmål. Ingen nye datatyper — læser de samme WeightEntry- og
// BodyMeasurement-rækker som vægtloggen og Kropsmål-siden.

// Kun type-imports, så filen kan testes direkte med `node --test`.
import type { BodyMeasurementSeriesEntry } from "@/lib/body-measurement-series";
import type { BodyMeasurementField } from "@/lib/body-measurements";

export type StatusWeightEntry = { id: string; weightKg: number; weighedAt: string };

export type HistoryPoint = { id?: string; at: string; value: number };

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function oldestFirst(points: HistoryPoint[]) {
  return points.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Vejninger som forløb, ældste først. */
export function buildWeightHistory(entries: StatusWeightEntry[]): HistoryPoint[] {
  return oldestFirst(
    entries
      .filter((entry) => isPositive(entry.weightKg))
      .map((entry) => ({ id: entry.id, at: entry.weighedAt, value: entry.weightKg })),
  );
}

/**
 * Ét kropsmål som forløb, ældste først — alle målinger, ikke kun de seneste
 * 10 som statistikkens kropsmål-graf (buildBodyMeasurementSeries).
 */
export function buildMeasurementHistory(
  entries: BodyMeasurementSeriesEntry[],
  field: BodyMeasurementField,
): HistoryPoint[] {
  return oldestFirst(
    entries.flatMap((entry) => {
      const value = entry[field];
      return isPositive(value) ? [{ at: entry.measuredAt, value }] : [];
    }),
  );
}

/**
 * Nuværende vægt = seneste vejning. Uden vejninger bruges profilens
 * start-vægt (User.weightKg), så siden ikke står tom for nye brugere.
 */
export function currentWeightKg(history: HistoryPoint[], startWeightKg: number | null): number | null {
  if (history.length > 0) return history[history.length - 1].value;
  return startWeightKg != null && startWeightKg > 0 ? startWeightKg : null;
}

/** Kg tilbage til målet (positiv = skal tabe, negativ = skal tage på), én decimal. */
export function remainingToGoalKg(currentKg: number | null, targetKg: number | null): number | null {
  if (currentKg == null || targetKg == null || targetKg <= 0) return null;
  return Math.round((currentKg - targetKg) * 10) / 10;
}

export type StatusGoal = { createdAt: string; targets: { type: string; value: number }[] };

/**
 * Kropsmålenes mål fra Målsætning: pr. mål værdien fra den nyeste målsætning,
 * der har det. Kun de felter, der er sat — ingen mål giver et tomt objekt.
 */
export function latestBodyGoals(
  goals: StatusGoal[],
  fields: readonly BodyMeasurementField[],
): Partial<Record<BodyMeasurementField, number>> {
  const newestFirst = [...goals].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const result: Partial<Record<BodyMeasurementField, number>> = {};
  for (const field of fields) {
    for (const goal of newestFirst) {
      const target = goal.targets.find((entry) => entry.type === field);
      if (target && isPositive(target.value)) {
        result[field] = target.value;
        break;
      }
    }
  }
  return result;
}
