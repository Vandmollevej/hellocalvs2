// Målinger, en smartvægt (eller et blodtryksapparat) sender sammen med en
// vejning, i den rækkefølge de vises i vejningens info-vindue
// (src/components/hf/EntryDetailsSheet.tsx). Navnene ligger i i18n under
// entrySheet.metrics.<type>. Typer, der ikke står her, vises ikke.

// unit "years" oversættes (entrySheet.years); øvrige enheder er sprogneutrale.
export type BodyMetricDisplay = { type: string; unit: string; decimals: number };

export const BODY_METRIC_DISPLAY: BodyMetricDisplay[] = [
  { type: "BODY_FAT_PERCENT", unit: "%", decimals: 1 },
  { type: "FAT_MASS_KG", unit: "kg", decimals: 1 },
  { type: "FAT_FREE_MASS_KG", unit: "kg", decimals: 1 },
  { type: "MUSCLE_MASS_KG", unit: "kg", decimals: 1 },
  { type: "SKELETAL_MUSCLE_MASS_KG", unit: "kg", decimals: 1 },
  { type: "BONE_MASS_KG", unit: "kg", decimals: 1 },
  { type: "BODY_WATER_PERCENT", unit: "%", decimals: 1 },
  { type: "EXTRACELLULAR_WATER_KG", unit: "kg", decimals: 1 },
  { type: "INTRACELLULAR_WATER_KG", unit: "kg", decimals: 1 },
  { type: "VISCERAL_FAT_INDEX", unit: "", decimals: 0 },
  { type: "PROTEIN_PERCENT", unit: "%", decimals: 1 },
  { type: "BMI", unit: "", decimals: 1 },
  { type: "BASAL_METABOLIC_RATE_KCAL", unit: "kcal", decimals: 0 },
  { type: "METABOLIC_AGE_YEARS", unit: "years", decimals: 0 },
  { type: "HEART_RATE_BPM", unit: "bpm", decimals: 0 },
  { type: "BLOOD_PRESSURE_SYSTOLIC_MMHG", unit: "mmHg", decimals: 0 },
  { type: "BLOOD_PRESSURE_DIASTOLIC_MMHG", unit: "mmHg", decimals: 0 },
  { type: "PULSE_WAVE_VELOCITY_M_S", unit: "m/s", decimals: 1 },
  { type: "VASCULAR_AGE_YEARS", unit: "years", decimals: 0 },
  { type: "NERVE_HEALTH_SCORE", unit: "", decimals: 0 },
  { type: "SKIN_CONDUCTANCE_US", unit: "µS", decimals: 0 },
  { type: "OXYGEN_SATURATION_PERCENT", unit: "%", decimals: 0 },
  { type: "TEMPERATURE_C", unit: "°C", decimals: 1 },
  { type: "SKIN_TEMPERATURE_C", unit: "°C", decimals: 1 },
  { type: "VO2_MAX", unit: "", decimals: 1 },
  { type: "HEIGHT_CM", unit: "cm", decimals: 0 },
];

export const BODY_METRIC_TYPES = BODY_METRIC_DISPLAY.map((metric) => metric.type);

// Målinger fra samme vejning ligger på (næsten) samme tidspunkt som vægten.
export const SAME_MEASUREMENT_MS = 2 * 60 * 1000;

export function formatBodyMetric(value: number, display: BodyMetricDisplay, unitLabel = display.unit, locale = "da-DK") {
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: display.decimals,
    maximumFractionDigits: display.decimals,
  }).format(value);
  return unitLabel ? `${number} ${unitLabel}` : number;
}

// Rækkefølge efter BODY_METRIC_DISPLAY; ukendte typer udelades.
export function orderBodyMetrics<T extends { type: string }>(metrics: T[]) {
  return BODY_METRIC_DISPLAY.flatMap((display) => {
    const found = metrics.find((metric) => metric.type === display.type);
    return found ? [{ ...found, display }] : [];
  });
}
