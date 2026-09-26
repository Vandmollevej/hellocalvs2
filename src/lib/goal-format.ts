import { BODY_MEASUREMENT_FIELDS } from "@/lib/body-measurements";
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
  return BODY_MEASUREMENT_FIELDS.find(({ field }) => field === type)?.nameKey ?? type;
}

export function isGoalCompleted(goal: GoalDTO) {
  return goal.targets.length > 0 && goal.targets.every((target) => target.completedAt);
}

// "YYYY-MM-DD" → lokal Date kl. 12, så dagen ikke skifter med tidszonen.
export function goalDisplayDate(goal: GoalDTO) {
  return goal.targetDate ? new Date(`${goal.targetDate}T12:00:00`) : new Date(goal.createdAt);
}
