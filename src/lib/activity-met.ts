import type { TrainingIntensity } from "@/lib/pal-model";

// Kun type-import fra pal-model: node --test (uden alias-opløsning) skal
// kunne køre activity-met.test.mjs, og Node fjerner type-importer selv.
const INTENSITIES = ["LIGHT", "MODERATE", "VIGOROUS", "VERY_VIGOROUS"] as const satisfies readonly TrainingIntensity[];

/** Netto-kcal: (MET − 1) × kg × timer — samme formel som pal-model.netActivityKcal. */
function netKcal(met: number, weightKg: number, minutes: number) {
  if (!(met > 1) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return (met - 1) * weightKg * (minutes / 60);
}

// MET for konkrete aktiviteter (docs/ACTIVITY-PAL.md §7, Compendium of
// Physical Activities, pacompendium.com). Brutto-MET pr. sportstype og
// intensitet fra taletesten; kalorier regnes altid netto (MET − 1), fordi
// hvilestofskiftet allerede ligger i BMR × PAL. Standard-MET er et estimat
// for en gennemsnitsperson — derfor vises resultatet som "ca.".

type MetByIntensity = Record<TrainingIntensity, number>;

// Nøgler = SPORT_TYPES (src/lib/sport-icons.ts). Ukendte/brugertilføjede
// aktiviteter bruger "other".
const MET_TABLE: Record<string, MetByIntensity> = {
  //           let    moderat  høj    meget høj
  running:  { LIGHT: 6.0, MODERATE: 8.3, VIGOROUS: 9.8, VERY_VIGOROUS: 11.5 },
  cycling:  { LIGHT: 4.0, MODERATE: 6.8, VIGOROUS: 8.5, VERY_VIGOROUS: 10.5 },
  walking:  { LIGHT: 2.8, MODERATE: 3.5, VIGOROUS: 4.3, VERY_VIGOROUS: 5.5 },
  swimming: { LIGHT: 4.8, MODERATE: 6.0, VIGOROUS: 8.3, VERY_VIGOROUS: 10.0 },
  cardio:   { LIGHT: 4.0, MODERATE: 5.5, VIGOROUS: 7.5, VERY_VIGOROUS: 9.0 },
  ski:      { LIGHT: 4.3, MODERATE: 5.3, VIGOROUS: 7.0, VERY_VIGOROUS: 9.0 },
  strength: { LIGHT: 3.0, MODERATE: 3.5, VIGOROUS: 5.0, VERY_VIGOROUS: 6.0 },
  yoga:     { LIGHT: 2.3, MODERATE: 2.5, VIGOROUS: 3.3, VERY_VIGOROUS: 4.0 },
  football: { LIGHT: 4.0, MODERATE: 7.0, VIGOROUS: 8.0, VERY_VIGOROUS: 10.0 },
  other:    { LIGHT: 3.0, MODERATE: 4.5, VIGOROUS: 7.0, VERY_VIGOROUS: 9.0 },
};

export const DEFAULT_INTENSITY: TrainingIntensity = "MODERATE";

export function isTrainingIntensity(value: unknown): value is TrainingIntensity {
  return typeof value === "string" && (INTENSITIES as readonly string[]).includes(value);
}

/** Brutto-MET for sport + intensitet (tabellen ovenfor). */
export function metFor(sportType: string, intensity: TrainingIntensity = DEFAULT_INTENSITY): number {
  const row = MET_TABLE[sportType] ?? MET_TABLE.other;
  return row[intensity];
}

// Gang og løb efter hastighed (km/t), når distance + tid kendes — bedre end
// intensitet alene (docs/ACTIVITY-PAL.md §11). Interpoleret fra Compendium.
const WALK_RUN_BY_SPEED: [number, number][] = [
  [3.2, 2.8],
  [4.0, 3.0],
  [4.8, 3.5],
  [5.6, 4.3],
  [6.4, 5.0],
  [7.2, 6.0],
  [8.0, 8.3],
  [9.7, 9.8],
  [11.3, 11.0],
  [12.9, 11.8],
  [14.5, 12.8],
  [16.1, 14.5],
];

export function metForSpeed(speedKmh: number): number {
  if (!(speedKmh > 0)) return WALK_RUN_BY_SPEED[0][1];
  let previous = WALK_RUN_BY_SPEED[0];
  for (const point of WALK_RUN_BY_SPEED) {
    if (speedKmh <= point[0]) {
      if (point === previous) return point[1];
      const share = (speedKmh - previous[0]) / (point[0] - previous[0]);
      return previous[1] + share * (point[1] - previous[1]);
    }
    previous = point;
  }
  return WALK_RUN_BY_SPEED[WALK_RUN_BY_SPEED.length - 1][1];
}

export type ActivityEstimateInput = {
  sportType: string;
  minutes: number;
  weightKg: number | null;
  intensity?: TrainingIntensity | null;
  distanceKm?: number | null;
};

export type ActivityEstimate = {
  met: number;
  /** Netto-kcal afrundet til nærmeste 5. Null uden vægt. */
  kcal: number | null;
  method: "SPEED" | "INTENSITY";
};

/** Anslåede netto-kcal for en logget aktivitet. */
export function estimateActivityKcal(input: ActivityEstimateInput): ActivityEstimate {
  const usesSpeed = (input.sportType === "walking" || input.sportType === "running") && !!input.distanceKm && input.distanceKm > 0 && input.minutes > 0;
  const met = usesSpeed ? metForSpeed((input.distanceKm! / input.minutes) * 60) : metFor(input.sportType, input.intensity ?? DEFAULT_INTENSITY);
  const kcal = input.weightKg ? Math.round(netKcal(met, input.weightKg, input.minutes) / 5) * 5 : null;
  return { met: Math.round(met * 10) / 10, kcal, method: usesSpeed ? "SPEED" : "INTENSITY" };
}
