// Samlinger i brugerens boks (docs/PRIVACY.md "Boks"). Navnene kendes kun af
// klienten; serveren ser et HMAC-tag pr. samling. En samling, der ikke står
// her, synkroniseres ikke af denne version af appen.
export const VAULT_COLLECTIONS = [
  "profile",
  "registrations",
  "weight",
  "bodyMeasurements",
  "goals",
  "water",
  "menstrualCycle",
  "sleepSchedule",
  "workShifts",
  "activities",
  "healthMetrics",
  "favorites",
  "dishes",
  "searchHistory",
  "integrations",
  "settings",
] as const;

export type VaultCollection = (typeof VAULT_COLLECTIONS)[number];
