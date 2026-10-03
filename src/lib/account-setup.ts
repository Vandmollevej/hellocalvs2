// Kontoopsætning (docs/DECISIONS.md 2026-10-03): fremdriften på Profil regnes
// ud fra de felter, brugeren har udfyldt — uanset om det skete i guiden eller
// ved selv at åbne felterne. Er alle tre trin klaret, forsvinder både
// kontoopsætningskassen og proceslinjen.

export type AccountSetupUser = {
  sex?: string | null;
  birthDate?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goalMode?: string | null;
  activityLevel?: string | null;
  defaultBedtime?: string | null;
  defaultWakeTime?: string | null;
};

export type AccountSetupStepId = "aboutYou" | "goals" | "habits";

export function accountSetupDone(user: AccountSetupUser): Record<AccountSetupStepId, boolean> {
  return {
    aboutYou: Boolean(user.sex && user.birthDate && user.heightCm && user.weightKg),
    goals: Boolean(user.goalMode),
    habits: Boolean(user.activityLevel && user.defaultBedtime && user.defaultWakeTime),
  };
}

export function isAccountSetupComplete(user: AccountSetupUser) {
  return Object.values(accountSetupDone(user)).every(Boolean);
}
