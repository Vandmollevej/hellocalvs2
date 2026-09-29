import type { GoalDirection, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BODY_MEASUREMENT_FIELDS,
  BODY_MEASUREMENT_UNIT,
  isBodyMeasurementField,
  type BodyMeasurementField,
} from "@/lib/body-measurements";
import { COMPOSITION_GOAL_FIELDS, isCompositionGoalField, type CompositionGoalField } from "@/lib/goal-composition";
import { isNutritionGoalField, NUTRITION_GOAL_FIELDS, type NutritionGoalField } from "@/lib/goal-nutrition";

// Målsætninger (docs/DECISIONS.md, 2026-09-22). En målsætning er et dateret
// sæt targets — vægt, kropsmål og/eller ernæring (dagligt kcal/makroer). Gennemført-status beregnes her
// server-side og gemmes som completedAt, der aldrig ryddes igen.

export const WEIGHT_TARGET = "weight";
export type GoalTargetType = typeof WEIGHT_TARGET | BodyMeasurementField | CompositionGoalField | NutritionGoalField;

// Rækkefølgen målsætningens targets vises i: vægt øverst, derefter kropsmålene
// i samme rækkefølge som på Kropsmål-siden, til sidst ernæring.
export const GOAL_TARGET_TYPES: GoalTargetType[] = [
  WEIGHT_TARGET,
  ...BODY_MEASUREMENT_FIELDS.map(({ field }) => field),
  ...COMPOSITION_GOAL_FIELDS.map(({ field }) => field),
  ...NUTRITION_GOAL_FIELDS.map(({ field }) => field),
];

export function isGoalTargetType(value: string): value is GoalTargetType {
  return value === WEIGHT_TARGET || isBodyMeasurementField(value) || isCompositionGoalField(value) || isNutritionGoalField(value);
}

export function unitForTarget(type: GoalTargetType) {
  if (type === WEIGHT_TARGET) return "kg";
  const composition = COMPOSITION_GOAL_FIELDS.find(({ field }) => field === type);
  if (composition) return composition.unit;
  const nutrition = NUTRITION_GOAL_FIELDS.find(({ field }) => field === type);
  return nutrition ? nutrition.unit : BODY_MEASUREMENT_UNIT;
}

// Floats fra input/DB sammenlignes med en lille tolerance; "fasthold" regnes
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

type Reading = { value: number; at: Date };

// Alle registrerede værdier pr. target-type siden `since`, ældste først.
async function loadReadings(userId: string, since: Date) {
  const [weights, measurements, metrics] = await Promise.all([
    prisma.weightEntry.findMany({
      where: { userId, weighedAt: { gte: since } },
      orderBy: { weighedAt: "asc" },
      select: { weightKg: true, weighedAt: true },
    }),
    prisma.bodyMeasurement.findMany({
      where: { userId, measuredAt: { gte: since } },
      orderBy: { measuredAt: "asc" },
    }),
    prisma.healthMetric.findMany({
      where: { userId, type: { in: COMPOSITION_GOAL_FIELDS.map(({ metricType }) => metricType) }, recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
      select: { type: true, value: true, recordedAt: true },
    }),
  ]);

  const readings = new Map<GoalTargetType, Reading[]>();
  readings.set(
    WEIGHT_TARGET,
    weights.map((entry) => ({ value: entry.weightKg, at: entry.weighedAt })),
  );
  for (const { field } of BODY_MEASUREMENT_FIELDS) {
    const list: Reading[] = [];
    for (const row of measurements) {
      const value = row[field];
      if (value != null) list.push({ value, at: row.measuredAt });
    }
    readings.set(field, list);
  }
  for (const { field, metricType } of COMPOSITION_GOAL_FIELDS) {
    readings.set(
      field,
      metrics.filter((metric) => metric.type === metricType).map((metric) => ({ value: metric.value, at: metric.recordedAt })),
    );
  }
  return readings;
}

// Seneste registrerede værdi pr. target-type — bruges som startværdi, når en
// ny målsætning oprettes.
export async function getLatestValues(userId: string) {
  const [latestWeight, user, measurements, metrics] = await Promise.all([
    prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: { weighedAt: "desc" },
      select: { weightKg: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { weightKg: true } }),
    prisma.bodyMeasurement.findMany({
      where: { userId },
      orderBy: { measuredAt: "desc" },
      take: 200,
    }),
    prisma.healthMetric.findMany({
      where: { userId, type: { in: COMPOSITION_GOAL_FIELDS.map(({ metricType }) => metricType) } },
      orderBy: { recordedAt: "desc" },
      take: 200,
      select: { type: true, value: true },
    }),
  ]);

  const latest = new Map<GoalTargetType, number>();
  const weight = latestWeight?.weightKg ?? user?.weightKg ?? null;
  if (weight != null) latest.set(WEIGHT_TARGET, weight);
  for (const { field } of BODY_MEASUREMENT_FIELDS) {
    const row = measurements.find((measurement) => measurement[field] != null);
    if (row) latest.set(field, row[field] as number);
  }
  for (const { field, metricType } of COMPOSITION_GOAL_FIELDS) {
    const metric = metrics.find((entry) => entry.type === metricType);
    if (metric) latest.set(field, metric.value);
  }
  return latest;
}

// Markerer åbne targets som nået, hvis en måling registreret efter
// målsætningens oprettelse opfylder målet i den gemte retning. Et target uden
// startværdi (ingen historik ved oprettelsen) får sin første efterfølgende
// måling som startværdi, og vurderes derefter på de følgende målinger.
export async function refreshGoalCompletion(userId: string) {
  const openTargets = await prisma.goalTarget.findMany({
    where: { completedAt: null, goal: { userId } },
    include: { goal: { select: { createdAt: true } } },
  });
  if (openTargets.length === 0) return;

  const since = openTargets.reduce(
    (earliest, target) => (target.goal.createdAt < earliest ? target.goal.createdAt : earliest),
    openTargets[0].goal.createdAt,
  );
  const readings = await loadReadings(userId, since);

  for (const target of openTargets) {
    if (!isGoalTargetType(target.type)) continue;
    let candidates = (readings.get(target.type) ?? []).filter(
      (reading) => reading.at >= target.goal.createdAt,
    );

    let startValue = target.startValue;
    let direction = target.direction;
    if (startValue == null || direction == null) {
      if (candidates.length === 0) continue;
      startValue = candidates[0].value;
      direction = getGoalDirection(startValue, target.value);
      candidates = candidates.slice(1);
    }

    const reached = candidates.find((reading) => hasReachedGoal(reading.value, target.value, direction));
    const directionChanged = startValue !== target.startValue || direction !== target.direction;
    if (!reached && !directionChanged) continue;

    await prisma.goalTarget.update({
      where: { id: target.id },
      data: {
        startValue,
        direction,
        ...(reached ? { completedAt: reached.at } : {}),
      },
    });
  }
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

type GoalWithTargets = Prisma.GoalGetPayload<{ include: { targets: true } }>;

function toGoalDTO(goal: GoalWithTargets): GoalDTO {
  return {
    id: goal.id,
    createdAt: goal.createdAt.toISOString(),
    targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
    targets: goal.targets
      .filter((target): target is typeof target & { type: GoalTargetType } => isGoalTargetType(target.type))
      .sort((a, b) => GOAL_TARGET_TYPES.indexOf(a.type) - GOAL_TARGET_TYPES.indexOf(b.type))
      .map((target) => ({
        id: target.id,
        type: target.type,
        value: target.value,
        unit: target.unit,
        completedAt: target.completedAt?.toISOString() ?? null,
      })),
  };
}

export async function listGoals(userId: string): Promise<GoalDTO[]> {
  await refreshGoalCompletion(userId);
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { targets: true },
  });
  return goals.map(toGoalDTO);
}

// Én målsætning — kun hvis den tilhører brugeren.
export async function getGoal(userId: string, goalId: string): Promise<GoalDTO | null> {
  await refreshGoalCompletion(userId);
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    include: { targets: true },
  });
  return goal ? toGoalDTO(goal) : null;
}

export async function createGoal(
  userId: string,
  targetDate: Date,
  values: Partial<Record<GoalTargetType, number>>,
) {
  const latest = await getLatestValues(userId);
  const entries = GOAL_TARGET_TYPES.flatMap((type) => {
    const value = values[type];
    return value != null ? [{ type, value }] : [];
  });

  return prisma.$transaction(async (tx) => {
    const goal = await tx.goal.create({
      data: {
        userId,
        targetDate,
        targets: {
          create: entries.map(({ type, value }) => {
            const startValue = latest.get(type) ?? null;
            return {
              type,
              value,
              unit: unitForTarget(type),
              startValue,
              direction: startValue != null ? getGoalDirection(startValue, value) : null,
            };
          }),
        },
      },
    });

    // Hello Doc og profilen læser stadig User.targetWeightKg — hold det i sync
    // med den nyeste vægt-målsætning.
    const weight = values[WEIGHT_TARGET];
    if (weight != null) {
      await tx.user.update({ where: { id: userId }, data: { targetWeightKg: weight } });
    }
    return goal;
  });
}

// Redigering af en eksisterende målsætning. Uændrede targets beholder deres
// startværdi og gennemført-status; et ændret mål er et nyt mål og får ny
// startværdi (seneste måling) og nulstillet completedAt. False hvis
// målsætningen ikke tilhører brugeren.
export async function updateGoal(
  userId: string,
  goalId: string,
  targetDate: Date,
  values: Partial<Record<GoalTargetType, number>>,
) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId }, include: { targets: true } });
  if (!goal) return false;
  const latest = await getLatestValues(userId);

  await prisma.$transaction(async (tx) => {
    await tx.goal.update({ where: { id: goalId }, data: { targetDate } });

    for (const target of goal.targets) {
      const value = isGoalTargetType(target.type) ? values[target.type] : undefined;
      if (value == null) {
        await tx.goalTarget.delete({ where: { id: target.id } });
      } else if (Math.abs(value - target.value) > EPSILON) {
        const startValue = latest.get(target.type as GoalTargetType) ?? null;
        await tx.goalTarget.update({
          where: { id: target.id },
          data: {
            value,
            startValue,
            direction: startValue != null ? getGoalDirection(startValue, value) : null,
            completedAt: null,
          },
        });
      }
    }

    const existing = new Set(goal.targets.map((target) => target.type));
    for (const type of GOAL_TARGET_TYPES) {
      const value = values[type];
      if (value == null || existing.has(type)) continue;
      const startValue = latest.get(type) ?? null;
      await tx.goalTarget.create({
        data: {
          goalId,
          type,
          value,
          unit: unitForTarget(type),
          startValue,
          direction: startValue != null ? getGoalDirection(startValue, value) : null,
        },
      });
    }

    // User.targetWeightKg følger den nyeste vægt-målsætning (jf. createGoal).
    const weight = values[WEIGHT_TARGET];
    if (weight != null) {
      const newestWeightGoal = await tx.goal.findFirst({
        where: { userId, targets: { some: { type: WEIGHT_TARGET } } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (newestWeightGoal?.id === goalId) {
        await tx.user.update({ where: { id: userId }, data: { targetWeightKg: weight } });
      }
    }
  });
  return true;
}
