// Aktivitetsmål i en målsætning: det, sportsure og aktivitetsmålere tracker
// (skridt, løb/cykling i km, aktive minutter, træningsdage, puls). Dagligt eller
// ugentligt rettesnore som ernæringsmål — de bliver aldrig "nået" af en enkelt
// måling. Klientsikker (ingen Prisma).
//
// WHO (Guidelines on physical activity, 2020) for voksne: 150–300 min moderat
// aktivitet pr. uge (eller 75–150 min hård), plus styrketræning mindst 2 dage
// pr. uge. Moderat intensitet svarer til ca. 64–76 % af maksimal puls
// (maks ≈ 220 − alder). WHO angiver ikke et skridtmål.
export const ACTIVITY_GOAL_FIELDS = [
  { field: "stepsPerDay", unit: "skridt/dag", nameKey: "goals.activity.stepsPerDay" },
  { field: "activeMinutesPerWeek", unit: "min/uge", nameKey: "goals.activity.activeMinutesPerWeek" },
  { field: "strengthDaysPerWeek", unit: "dage/uge", nameKey: "goals.activity.strengthDaysPerWeek" },
  { field: "workoutsPerWeek", unit: "pas/uge", nameKey: "goals.activity.workoutsPerWeek" },
  { field: "runKmPerWeek", unit: "km/uge", nameKey: "goals.activity.runKmPerWeek" },
  { field: "cycleKmPerWeek", unit: "km/uge", nameKey: "goals.activity.cycleKmPerWeek" },
  { field: "heartRateAboveBpm", unit: "bpm", nameKey: "goals.activity.heartRateAboveBpm" },
] as const;

// WHO-forslag, som formularens "Brug WHO-anbefaling"-knap udfylder.
export const WHO_ACTIVITY_SUGGESTION: Partial<Record<ActivityGoalField, string>> = {
  activeMinutesPerWeek: "150",
  strengthDaysPerWeek: "2",
};

export type ActivityGoalField = (typeof ACTIVITY_GOAL_FIELDS)[number]["field"];

export function isActivityGoalField(value: string): value is ActivityGoalField {
  return ACTIVITY_GOAL_FIELDS.some(({ field }) => field === value);
}

export function emptyActivityGoalValues(): Record<ActivityGoalField, string> {
  return Object.fromEntries(ACTIVITY_GOAL_FIELDS.map(({ field }) => [field, ""])) as Record<ActivityGoalField, string>;
}
