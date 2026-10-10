// Slider-intervaller til målsætningsformularen (vises under tastaturet, når et
// felt har fokus). Værdierne er i den viste enhed. Klientsikker.
export type GoalSliderRange = { min: number; max: number; step: number };

const COMPOSITION: Record<string, GoalSliderRange> = {
  bodyFatPercent: { min: 3, max: 60, step: 0.5 },
  muscleMassKg: { min: 10, max: 80, step: 0.5 },
};

const NUTRITION: Record<string, GoalSliderRange> = {
  kcal: { min: 800, max: 5000, step: 50 },
  proteinG: { min: 20, max: 400, step: 5 },
  carbsG: { min: 20, max: 800, step: 5 },
  fatG: { min: 10, max: 300, step: 5 },
};

export function compositionSliderRange(field: string): GoalSliderRange {
  return COMPOSITION[field] ?? { min: 0, max: 100, step: 1 };
}

export function nutritionSliderRange(field: string): GoalSliderRange {
  return NUTRITION[field] ?? { min: 0, max: 100, step: 1 };
}

const ACTIVITY: Record<string, GoalSliderRange> = {
  stepsPerDay: { min: 1000, max: 30000, step: 500 },
  activeMinutesPerWeek: { min: 30, max: 600, step: 10 },
  strengthDaysPerWeek: { min: 1, max: 7, step: 1 },
  workoutsPerWeek: { min: 1, max: 14, step: 1 },
  runKmPerWeek: { min: 1, max: 100, step: 1 },
  cycleKmPerWeek: { min: 5, max: 400, step: 5 },
  heartRateAboveBpm: { min: 80, max: 190, step: 1 },
};

export function activitySliderRange(field: string): GoalSliderRange {
  return ACTIVITY[field] ?? { min: 0, max: 100, step: 1 };
}

export function weightSliderRange(unit: "kg" | "lb"): GoalSliderRange {
  return unit === "kg" ? { min: 30, max: 200, step: 0.5 } : { min: 66, max: 440, step: 1 };
}

export function lengthSliderRange(unit: "cm" | "in"): GoalSliderRange {
  return unit === "cm" ? { min: 20, max: 200, step: 0.5 } : { min: 8, max: 80, step: 0.5 };
}
