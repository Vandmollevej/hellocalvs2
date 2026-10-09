// Tips til at nå dagens mål (docs/DECISIONS.md 2026-10-07): ud fra hvad
// brugeren plejer at spise pr. dag (gennemsnit over seneste dage med
// registreringer) foreslås en gåtur eller mere grønt, hvis det ligger over
// kalorie-målet. Ren logik uden database.

export type GoalTip = { avgKcal: number; goalKcal: number; excessKcal: number; km: number; text: string };

const KCAL_PER_KG_PER_KM = 0.55; // gang, groft overslag
const CARROT_KCAL_PER_100G = 40;
export const MIN_TIP_EXCESS_KCAL = 80;
export const MIN_TIP_DAYS = 4;

function fmt(n: number) {
  return Math.round(n).toLocaleString("da-DK");
}

export function buildGoalTip(input: { dailyTotals: number[]; goalKcal: number; weightKg?: number | null }): GoalTip | null {
  const days = input.dailyTotals.filter((total) => total > 0);
  if (days.length < MIN_TIP_DAYS || input.goalKcal <= 0) return null;
  const avgKcal = days.reduce((sum, total) => sum + total, 0) / days.length;
  const excessKcal = avgKcal - input.goalKcal;
  if (excessKcal < MIN_TIP_EXCESS_KCAL) return null;

  const weight = input.weightKg && input.weightKg > 30 ? input.weightKg : 70;
  const km = Math.max(1, Math.round(excessKcal / (KCAL_PER_KG_PER_KM * weight)));
  const carrotGrams = Math.round(excessKcal / CARROT_KCAL_PER_100G) * 100;
  const walk = km <= 8 ? `Går du ca. ${km} km` : `Går du en lang tur (ca. ${km} km)`;
  const text =
    `Du plejer at spise ca. ${fmt(avgKcal)} kcal om dagen — ${fmt(excessKcal)} over dit mål på ${fmt(input.goalKcal)}. ` +
    `${walk}, eller spiser lidt flere gulerødder i stedet for energitæt mad (${fmt(Math.min(carrotGrams, 1000))} g fylder, men rummer få kalorier), kan du holde dagens mål.`;
  return { avgKcal: Math.round(avgKcal), goalKcal: input.goalKcal, excessKcal: Math.round(excessKcal), km, text };
}
