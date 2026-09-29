import { BODY_MEASUREMENT_FIELDS } from "@/lib/body-measurements";
import { COMPOSITION_GOAL_FIELDS, isCompositionGoalField } from "@/lib/goal-composition";
import { isNutritionGoalField, NUTRITION_GOAL_FIELDS } from "@/lib/goal-nutrition";
import type { GoalDTO, GoalTargetDTO } from "@/lib/user-goals";

// Visningshjælpere til målsætningssiderne (ingen forretningslogik).

export function formatGoalDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(value))
    .replace(/[/-]/g, ".");
}

export function formatGoalValue(value: number) {
  return new Intl.NumberFormat("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
}

export function goalTargetNameKey(type: GoalTargetDTO["type"]) {
  if (type === "weight") return "goals.weight";
  return (
    BODY_MEASUREMENT_FIELDS.find(({ field }) => field === type)?.nameKey ??
    COMPOSITION_GOAL_FIELDS.find(({ field }) => field === type)?.nameKey ??
    NUTRITION_GOAL_FIELDS.find(({ field }) => field === type)?.nameKey ??
    type
  );
}

// Ernæringsmål er daglige rettesnore og bliver aldrig "nået" af en måling, så
// kun vægt og kropsmål afgør, om målsætningen er nået.
export function isGoalCompleted(goal: GoalDTO) {
  const measurable = goal.targets.filter((target) => !isNutritionGoalField(target.type));
  return measurable.length > 0 && measurable.every((target) => target.completedAt);
}

// "YYYY-MM-DD" → lokal Date kl. 12, så dagen ikke skifter med tidszonen.
export function goalDisplayDate(goal: GoalDTO) {
  return goal.targetDate ? new Date(`${goal.targetDate}T12:00:00`) : new Date(goal.createdAt);
}

// Ikonkategori pr. target: vægt, kropsmål eller ernæring (kcal/makroer).
export type GoalTargetCategory = "weight" | "body" | "nutrition";

export function goalTargetCategory(type: string): GoalTargetCategory {
  if (type === "weight") return "weight";
  if (BODY_MEASUREMENT_FIELDS.some(({ field }) => field === type) || isCompositionGoalField(type)) return "body";
  return "nutrition";
}

// De kategorier, en målsætning indeholder, i fast rækkefølge.
export function goalCategories(goal: GoalDTO): GoalTargetCategory[] {
  const present = new Set(goal.targets.map((target) => goalTargetCategory(target.type)));
  return (["weight", "body", "nutrition"] as const).filter((category) => present.has(category));
}

// Kommende = ikke nået og med en målsætningsdato fra i dag og frem; nærmeste først.
export function upcomingGoals(goals: GoalDTO[], todayIso: string) {
  return goals
    .filter((goal) => !isGoalCompleted(goal) && goal.targetDate != null && goal.targetDate >= todayIso)
    .sort((a, b) => (a.targetDate as string).localeCompare(b.targetDate as string));
}
