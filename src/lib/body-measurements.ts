// Fælles definition af kropsmålene (BodyMeasurement-kolonnerne). Både
// Kropsmål-siden og Målsætning bygger deres felter herfra, så de to lister
// aldrig kan komme ud af sync.

// Illustrationerne er brugerens egne tegninger (Icons/Kropsmål), kopieret
// uændret til public/body-measurements (2026-09-25). Billedet vælges ud fra
// profilens køn (User.sex) — aldrig gemt på selve målingen. Hofte har ingen
// godkendt tegning og vises derfor uden billede. Hals blev fjernet igen
// 2026-09-29 (BodyMeasurement.neckCm findes stadig i databasen, men bruges ikke).
export type BodyMeasurementSex = "FEMALE" | "MALE";

function drawing(name: string): Record<BodyMeasurementSex, string> {
  return {
    FEMALE: `/body-measurements/female-${name}.png`,
    MALE: `/body-measurements/male-${name}.png`,
  };
}

export const BODY_MEASUREMENT_FIELDS = [
  {
    field: "chestCm",
    labelKey: "bodyMeasurements.chest",
    nameKey: "bodyMeasurements.names.chest",
    image: drawing("chest"),
  },
  {
    field: "waistCm",
    labelKey: "bodyMeasurements.waist",
    nameKey: "bodyMeasurements.names.waist",
    image: drawing("waist"),
  },
  {
    field: "hipCm",
    labelKey: "bodyMeasurements.hip",
    nameKey: "bodyMeasurements.names.hip",
    image: null,
  },
  {
    field: "upperArmCm",
    labelKey: "bodyMeasurements.upperArm",
    nameKey: "bodyMeasurements.names.upperArm",
    image: drawing("arm"),
  },
  {
    field: "thighCm",
    labelKey: "bodyMeasurements.thigh",
    nameKey: "bodyMeasurements.names.thigh",
    image: drawing("leg"),
  },
  // Bagdel, ankel og læg har endnu ingen godkendt tegning (2026-10-09).
  {
    field: "buttockCm",
    labelKey: "bodyMeasurements.buttock",
    nameKey: "bodyMeasurements.names.buttock",
    image: null,
  },
  {
    field: "calfCm",
    labelKey: "bodyMeasurements.calf",
    nameKey: "bodyMeasurements.names.calf",
    image: null,
  },
  {
    field: "ankleCm",
    labelKey: "bodyMeasurements.ankle",
    nameKey: "bodyMeasurements.names.ankle",
    image: null,
  },
] as const;

export type BodyMeasurementField = (typeof BODY_MEASUREMENT_FIELDS)[number]["field"];

export const BODY_MEASUREMENT_UNIT = "cm";

export function isBodyMeasurementField(value: string): value is BodyMeasurementField {
  return BODY_MEASUREMENT_FIELDS.some((definition) => definition.field === value);
}

export function emptyBodyMeasurementValues(): Record<BodyMeasurementField, string> {
  return Object.fromEntries(BODY_MEASUREMENT_FIELDS.map(({ field }) => [field, ""])) as Record<
    BodyMeasurementField,
    string
  >;
}

// Brugerens valg under Indstillinger → Visning: hvilke mål Kropsmål-siden
// viser. Null (aldrig valgt) = alle vises; et mål skjules kun, når det
// eksplicit er sat til false.
export type BodyMeasurementVisibility = Partial<Record<BodyMeasurementField, boolean>>;

export function isBodyMeasurementVisible(
  visibility: BodyMeasurementVisibility | null | undefined,
  field: BodyMeasurementField,
): boolean {
  return visibility?.[field] !== false;
}
