// Default daily goals. The kcal goal is per user (User.dailyKcalGoal); this is
// only the fallback when the user has none. Use resolveDailyKcalGoal().
export const DAILY_KCAL_GOAL = 3299;

export function resolveDailyKcalGoal(user: { dailyKcalGoal?: number | null } | null | undefined): number {
  return user?.dailyKcalGoal && user.dailyKcalGoal > 0 ? user.dailyKcalGoal : DAILY_KCAL_GOAL;
}
export const DAILY_PROTEIN_GOAL = 120;
// Placeholder for target weight (per docs/SPECIFICATION.md §5 — should be set via
// onboarding/user settings, which don't exist yet; same placeholder status
// as DAILY_KCAL_GOAL above). Set to the one demo user's stated goal (100 kg).
export const WEIGHT_GOAL_KG = 100;
