import { estimateBmr } from "@/lib/weekly-energy-summary";

// Anbefalet serveringsstørrelse for en ret (docs/DECISIONS.md 2026-09-25).
// Delte retter har ingen personantal, kun gram. En servering er derfor en
// andel af brugerens eget dagsbehov: hovedmåltidet (aftensmad) regnes som
// 30 % af dagens energi, jf. den gængse danske måltidsfordeling:
//
//   Måltid           Andel af dagens energi
//   Morgenmad        20–25 %
//   Frokost          25–30 %
//   Aftensmad        30–35 %
//   Mellemmåltider   10–20 % i alt
//
// Dagsbehovet er hvilestofskiftet (Mifflin-St Jeor) × 1,4 (PAL for et
// stillesiddende hverdagsliv, NNR 2023). Mangler profildata, bruges EU's
// referenceindtag for en voksen (2000 kcal).
export const MAIN_MEAL_SHARE = 0.3;
export const PHYSICAL_ACTIVITY_LEVEL = 1.4;
export const REFERENCE_DAILY_KCAL = 2000;
export const MAX_RECIPE_PERSONS = 6;

export type PortionProfile = {
  weightKg?: number | null;
  heightCm?: number | null;
  birthDate?: string | Date | null;
  sex?: "MALE" | "FEMALE" | null;
};

function ageFrom(birthDate: string | Date | null | undefined, now = new Date()) {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function dailyKcalFor(profile: PortionProfile | null | undefined) {
  const bmr = profile
    ? estimateBmr({
        weightKg: profile.weightKg ?? null,
        heightCm: profile.heightCm ?? null,
        age: ageFrom(profile.birthDate),
        sex: profile.sex ?? null,
      })
    : null;
  return bmr ? bmr * PHYSICAL_ACTIVITY_LEVEL : REFERENCE_DAILY_KCAL;
}

// kcal i én anbefalet servering (hovedmåltid) for brugeren.
export function portionKcalFor(profile: PortionProfile | null | undefined) {
  return Math.round((dailyKcalFor(profile) * MAIN_MEAL_SHARE) / 10) * 10;
}

// Hvor mange serveringer en hel ret uden personantal svarer til.
export function servingsFor(totalKcal: number, portionKcal: number) {
  if (totalKcal <= 0 || portionKcal <= 0) return 1;
  return Math.max(1, Math.round(totalKcal / portionKcal));
}

// Faktor, ingrediensernes gram ganges med, så retten rækker til `persons`
// serveringer af brugerens anbefalede størrelse.
export function scaleFactorFor(totalKcal: number, portionKcal: number, persons: number) {
  if (totalKcal <= 0 || portionKcal <= 0) return 1;
  return (persons * portionKcal) / totalKcal;
}
