// Faste mål som fallback. Kaloriemålet pr. dato kommer nu fra
// DailyBudgetSnapshot (src/lib/daily-budget.ts, docs/ACTIVITY-PAL.md);
// DAILY_KCAL_GOAL gælder kun dage før brugerens første snapshot.
export const DAILY_KCAL_GOAL = 3299;
export const DAILY_PROTEIN_GOAL = 120;
// Placeholder for target weight (per docs/SPECIFICATION.md §5 — should be set via
// onboarding/user settings, which don't exist yet; same placeholder status
// as DAILY_KCAL_GOAL above). Set to the one demo user's stated goal (100 kg).
export const WEIGHT_GOAL_KG = 100;
