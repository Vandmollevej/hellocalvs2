// Fælles definition af kropsmålene (BodyMeasurement-kolonnerne). Både
// Kropsmål-siden og Målsætning bygger deres felter herfra, så de to lister
// aldrig kan komme ud af sync.

export const BODY_MEASUREMENT_FIELDS = [
  { field: "waistCm", labelKey: "bodyMeasurements.waist", nameKey: "bodyMeasurements.names.waist" },
  { field: "hipCm", labelKey: "bodyMeasurements.hip", nameKey: "bodyMeasurements.names.hip" },
  { field: "chestCm", labelKey: "bodyMeasurements.chest", nameKey: "bodyMeasurements.names.chest" },
  { field: "thighCm", labelKey: "bodyMeasurements.thigh", nameKey: "bodyMeasurements.names.thigh" },
  { field: "upperArmCm", labelKey: "bodyMeasurements.upperArm", nameKey: "bodyMeasurements.names.upperArm" },
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
