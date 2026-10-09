// Vejninger og kropsmålinger i kalenderens dagsvisning (2026-10-03, brugeren:
// "Jeg har synkroniseret Withings, men min vægt mv. står ikke i kalenderen").
// En vejning og de målinger, vægten tog samtidig (fedtprocent, muskelmasse …),
// samles til ét tidspunkt; målinger uden vejning (fx blodtryk) står for sig.
// Dagssummer (skridt, søvn …, gemt kl. 00:00 UTC) hører ikke hjemme her.
// Klientsikker (ingen Prisma).

export type CalendarWeighIn = { id: string; weightKg: number; weighedAt: string; source?: string };
export type CalendarMetric = { id?: string; type: string; value: number; recordedAt: string; source?: string };

// Rækkefølge og enhed i visningen. Kun enkeltmålinger med et tidspunkt.
export const MEASUREMENT_TYPES: { type: string; unit: string; digits: number }[] = [
  { type: "BODY_FAT_PERCENT", unit: "%", digits: 1 },
  { type: "FAT_MASS_KG", unit: "kg", digits: 1 },
  { type: "FAT_FREE_MASS_KG", unit: "kg", digits: 1 },
  { type: "MUSCLE_MASS_KG", unit: "kg", digits: 1 },
  { type: "SKELETAL_MUSCLE_MASS_KG", unit: "kg", digits: 1 },
  { type: "BONE_MASS_KG", unit: "kg", digits: 1 },
  { type: "BODY_WATER_PERCENT", unit: "%", digits: 1 },
  { type: "EXTRACELLULAR_WATER_KG", unit: "kg", digits: 1 },
  { type: "INTRACELLULAR_WATER_KG", unit: "kg", digits: 1 },
  { type: "VISCERAL_FAT_INDEX", unit: "", digits: 0 },
  { type: "PROTEIN_PERCENT", unit: "%", digits: 1 },
  { type: "BASAL_METABOLIC_RATE_KCAL", unit: "kcal", digits: 0 },
  { type: "METABOLIC_AGE_YEARS", unit: "år", digits: 0 },
  { type: "BMI", unit: "", digits: 1 },
  { type: "HEIGHT_CM", unit: "cm", digits: 0 },
  { type: "BLOOD_PRESSURE_SYSTOLIC_MMHG", unit: "mmHg", digits: 0 },
  { type: "BLOOD_PRESSURE_DIASTOLIC_MMHG", unit: "mmHg", digits: 0 },
  { type: "HEART_RATE_BPM", unit: "bpm", digits: 0 },
  { type: "PULSE_WAVE_VELOCITY_M_S", unit: "m/s", digits: 1 },
  { type: "VASCULAR_AGE_YEARS", unit: "år", digits: 0 },
  { type: "OXYGEN_SATURATION_PERCENT", unit: "%", digits: 0 },
  { type: "TEMPERATURE_C", unit: "°C", digits: 1 },
  { type: "SKIN_TEMPERATURE_C", unit: "°C", digits: 1 },
  { type: "BLOOD_GLUCOSE_MMOL_L", unit: "mmol/l", digits: 1 },
  { type: "NERVE_HEALTH_SCORE", unit: "", digits: 0 },
  { type: "SKIN_CONDUCTANCE_US", unit: "µS", digits: 1 },
];
const ORDER = new Map(MEASUREMENT_TYPES.map((m, i) => [m.type, i]));

// Samme vindue som dublet-reglen for vejninger (store-items.ts).
const SAME_MEASUREMENT_MS = 2 * 60 * 1000;

export type CalendarMeasurement = {
  id: string;
  time: Date;
  weightKg: number | null;
  source: string | null;
  metrics: CalendarMetric[];
};

// Dagssummer gemmes som datoen kl. 00:00:00.000 UTC — de er ikke målinger med et klokkeslæt.
const isDaySum = (recordedAt: string) => recordedAt.endsWith("T00:00:00.000Z");

export function measurementsForDay(weighIns: CalendarWeighIn[], metrics: CalendarMetric[], isDay: (time: Date) => boolean): CalendarMeasurement[] {
  const items: CalendarMeasurement[] = weighIns
    .filter((w) => isDay(new Date(w.weighedAt)))
    .map((w) => ({ id: `weight-${w.id}`, time: new Date(w.weighedAt), weightKg: w.weightKg, source: w.source ?? null, metrics: [] }));

  const samples = metrics
    .filter((m) => ORDER.has(m.type) && !isDaySum(m.recordedAt) && isDay(new Date(m.recordedAt)))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  for (const m of samples) {
    const at = new Date(m.recordedAt).getTime();
    const match = items.find(
      (item) => Math.abs(item.time.getTime() - at) <= SAME_MEASUREMENT_MS && !item.metrics.some((x) => x.type === m.type)
    );
    if (match) {
      match.metrics.push(m);
      if (!match.source && m.source) match.source = m.source;
    } else {
      items.push({ id: `metric-${m.id ?? `${m.type}-${m.recordedAt}`}`, time: new Date(at), weightKg: null, source: m.source ?? null, metrics: [m] });
    }
  }

  for (const item of items) item.metrics.sort((a, b) => (ORDER.get(a.type) ?? 0) - (ORDER.get(b.type) ?? 0));
  return items.sort((a, b) => a.time.getTime() - b.time.getTime());
}

export function formatMeasurementValue(metric: CalendarMetric): string {
  const spec = MEASUREMENT_TYPES.find((m) => m.type === metric.type);
  const formatted = new Intl.NumberFormat("da-DK", { maximumFractionDigits: spec?.digits ?? 1 }).format(metric.value);
  return spec?.unit ? `${formatted} ${spec.unit}` : formatted;
}

export function formatWeightKg(weightKg: number): string {
  return `${new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(weightKg)} kg`;
}

// Logoet for den smartvægt/app, der har leveret målingen (public/integrations/).
// Klientsikker modsvar til katalogets ikon — kilder uden logo giver null.
const SOURCE_ICON_SLUGS = new Set(["apple-health", "garmin", "google-health", "health-connect", "polar-flow", "samsung-health", "strava", "withings"]);

export function integrationIconForSource(source: string | null): string | null {
  if (!source) return null;
  const slug = source === "FITBIT" ? "google-health" : source.toLowerCase().replace(/_/g, "-");
  return SOURCE_ICON_SLUGS.has(slug) ? `/integrations/${slug}.png` : null;
}
