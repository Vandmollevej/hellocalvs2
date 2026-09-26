// Fælles definition af kropsmålene (BodyMeasurement-kolonnerne). Både
// Kropsmål-siden og Målsætning bygger deres felter herfra, så de to lister
// aldrig kan komme ud af sync.

// Illustrationerne er brugerens egne tegninger (Icons/Kropsmål), kopieret
// uændret til public/body-measurements (2026-09-25). Billedet vælges ud fra
// profilens køn (User.sex) — aldrig gemt på selve målingen. Hofte har ingen
// godkendt tegning og vises derfor uden billede.
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
