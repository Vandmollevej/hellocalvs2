// Mål-tips (Indstillinger → Visning → Tips): når brugerens sædvanlige
// dagsindtag ligger over dagens mål, foreslås en lille justering — en gåtur
// eller lidt flere gulerødder i stedet for noget af maden. Ren beregning;
// ingen UI her.

export const TIP_HISTORY_DAYS = 28;
export const TIP_MIN_LOGGED_DAYS = 5;
/** Ca. kcal pr. km gang (ca. 60 kcal for en voksen). */
export const KCAL_PER_KM_WALKED = 60;
/** Gulerod ca. 0,4 kcal/g mod ca. 2 kcal/g for en almindelig kost: spar ca. 1,6 kcal pr. gram, der byttes. */
export const KCAL_SAVED_PER_GRAM_SWAPPED = 1.6;

export type GoalTip = {
  /** Sædvanligt dagsindtag (gennemsnit af loggede dage). */
  typicalKcal: number;
  /** Hvor meget det ligger over dagens mål (inkl. motion). */
  overKcal: number;
  walkKm: number;
  carrotGrams: number;
};

/** Gennemsnit af de loggede dage før `today`; null hvis for få dage. */
export function typicalDailyKcal(
  dailyTotals: Map<string, number>,
  today: Date,
  dayKey: (date: Date) => string,
): number | null {
  let sum = 0;
  let count = 0;
  for (let offset = 1; offset <= TIP_HISTORY_DAYS; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const kcal = dailyTotals.get(dayKey(day)) ?? 0;
    if (kcal > 0) {
      sum += kcal;
      count += 1;
    }
  }
  return count >= TIP_MIN_LOGGED_DAYS ? Math.round(sum / count) : null;
}

/** Tip for i dag, eller null hvis intet er nødvendigt (under mål, eller allerede overskredet i dag). */
export function buildGoalTip(input: {
  typicalKcal: number | null;
  goalKcal: number;
  bonusKcal: number;
  intakeKcal: number;
}): GoalTip | null {
  const { typicalKcal, goalKcal, bonusKcal, intakeKcal } = input;
  if (typicalKcal === null) return null;
  const allowance = goalKcal + bonusKcal;
  const over = typicalKcal - allowance;
  if (over < 50 || intakeKcal > allowance) return null;
  return {
    typicalKcal,
    overKcal: Math.round(over),
    walkKm: Math.max(1, Math.round(over / KCAL_PER_KM_WALKED)),
    carrotGrams: Math.max(50, Math.round(over / KCAL_SAVED_PER_GRAM_SWAPPED / 50) * 50),
  };
}
