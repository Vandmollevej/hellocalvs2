import {
  BODY_MEASUREMENT_FIELDS,
  BODY_MEASUREMENT_UNIT,
  isBodyMeasurementField,
  type BodyMeasurementField,
} from "@/lib/body-measurements";

// Målsætninger (docs/DECISIONS.md, 2026-09-22). En målsætning er et dateret
// sæt targets — vægt og/eller kropsmål. Gennemført-status beregnes ud fra
// vejninger og kropsmål og gemmes som completedAt, der aldrig ryddes igen.
//
// Ren logik uden database: data ligger krypteret i brugerens boks og
// beregnes på enheden (docs/PRIVACY.md, src/lib/vault/handlers/goals.ts).

export const WEIGHT_TARGET = "weight";
export type GoalTargetType = typeof WEIGHT_TARGET | BodyMeasurementField;
export type GoalDirection = "INCREASE" | "DECREASE" | "MAINTAIN";

// Rækkefølgen målsætningens targets vises i: vægt øverst, derefter kropsmålene
// i samme rækkefølge som på Kropsmål-siden.
export const GOAL_TARGET_TYPES: GoalTargetType[] = [
  WEIGHT_TARGET,
  ...BODY_MEASUREMENT_FIELDS.map(({ field }) => field),
];

export function isGoalTargetType(value: string): value is GoalTargetType {
  return value === WEIGHT_TARGET || isBodyMeasurementField(value);
}

export function unitForTarget(type: GoalTargetType) {
  return type === WEIGHT_TARGET ? "kg" : BODY_MEASUREMENT_UNIT;
}

// Floats fra input sammenlignes med en lille tolerance; "fasthold" regnes
// som nået inden for en halv visningsdecimal.
const EPSILON = 1e-6;
const MAINTAIN_TOLERANCE = 0.05;

export function getGoalDirection(startValue: number, targetValue: number): GoalDirection {
  if (targetValue > startValue + EPSILON) return "INCREASE";
  if (targetValue < startValue - EPSILON) return "DECREASE";
  return "MAINTAIN";
}

export function hasReachedGoal(currentValue: number, targetValue: number, direction: GoalDirection) {
  switch (direction) {
    case "INCREASE":
      return currentValue >= targetValue - EPSILON;
    case "DECREASE":
      return currentValue <= targetValue + EPSILON;
    case "MAINTAIN":
      return Math.abs(currentValue - targetValue) <= MAINTAIN_TOLERANCE;
  }
}

export type Reading = { value: number; at: string };
export type WeightReading = { weightKg: number; weighedAt: string };
export type MeasurementReading = Partial<Record<BodyMeasurementField, number | null>> & { measuredAt: string };

// Alle registrerede værdier pr. target-type, ældste først.
export function buildReadings(weights: WeightReading[], measurements: MeasurementReading[]) {
  const readings = new Map<GoalTargetType, Reading[]>();
  readings.set(
    WEIGHT_TARGET,
    weights
      .map((entry) => ({ value: entry.weightKg, at: entry.weighedAt }))
      .sort((a, b) => a.at.localeCompare(b.at))
  );
  const sorted = [...measurements].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  for (const { field } of BODY_MEASUREMENT_FIELDS) {
    const list: Reading[] = [];
    for (const row of sorted) {
      const value = row[field];
      if (value != null) list.push({ value, at: row.measuredAt });
    }
    readings.set(field, list);
  }
  return readings;
}

// Seneste registrerede værdi pr. target-type — bruges som startværdi, når en
// ny målsætning oprettes. fallbackWeight = profilens startvægt.
export function latestValues(readings: Map<GoalTargetType, Reading[]>, fallbackWeight: number | null) {
  const latest = new Map<GoalTargetType, number>();
  for (const type of GOAL_TARGET_TYPES) {
    const list = readings.get(type) ?? [];
    if (list.length > 0) latest.set(type, list[list.length - 1].value);
  }
  if (!latest.has(WEIGHT_TARGET) && fallbackWeight != null) latest.set(WEIGHT_TARGET, fallbackWeight);
  return latest;
}

export type StoredGoalTarget = {
  id: string;
  type: string;
  value: number;
  unit: string;
  startValue: number | null;
  direction: GoalDirection | null;
  completedAt: string | null;
};

export type StoredGoal = { createdAt: string; targetDate: string | null; targets: StoredGoalTarget[] };

// Markerer åbne targets som nået, hvis en måling registreret efter
// målsætningens oprettelse opfylder målet i den gemte retning. Et target uden
// startværdi får sin første efterfølgende måling som startværdi.
// Returnerer den opdaterede målsætning, eller null hvis intet ændrede sig.
export function refreshGoal(goal: StoredGoal, readings: Map<GoalTargetType, Reading[]>): StoredGoal | null {
  let changed = false;
  const targets = goal.targets.map((target) => {
    if (target.completedAt || !isGoalTargetType(target.type)) return target;
    let candidates = (readings.get(target.type) ?? []).filter((reading) => reading.at >= goal.createdAt);

    let startValue = target.startValue;
    let direction = target.direction;
    if (startValue == null || direction == null) {
      if (candidates.length === 0) return target;
      startValue = candidates[0].value;
      direction = getGoalDirection(startValue, target.value);
      candidates = candidates.slice(1);
    }
    const reached = candidates.find((reading) => hasReachedGoal(reading.value, target.value, direction!));
    const directionChanged = startValue !== target.startValue || direction !== target.direction;
    if (!reached && !directionChanged) return target;
    changed = true;
    return { ...target, startValue, direction, completedAt: reached ? reached.at : target.completedAt };
  });
  return changed ? { ...goal, targets } : null;
}

export type GoalTargetDTO = {
  id: string;
  type: GoalTargetType;
  value: number;
  unit: string;
  completedAt: string | null;
};

export type GoalDTO = {
  id: string;
  createdAt: string;
  // "YYYY-MM-DD" — den kalenderdato, målsætningen ønskes nået.
  targetDate: string | null;
  targets: GoalTargetDTO[];
};

export function toGoalDTO(id: string, goal: StoredGoal): GoalDTO {
  return {
    id,
    createdAt: goal.createdAt,
    targetDate: goal.targetDate,
    targets: goal.targets
      .filter((target): target is StoredGoalTarget & { type: GoalTargetType } => isGoalTargetType(target.type))
      .sort((a, b) => GOAL_TARGET_TYPES.indexOf(a.type) - GOAL_TARGET_TYPES.indexOf(b.type))
      .map((target) => ({
        id: target.id,
        type: target.type,
        value: target.value,
        unit: target.unit,
        completedAt: target.completedAt,
      })),
  };
}
