// Måleserien bag kropsmål-graferne på statistiksiden: ét mål (fx talje) som
// forløb over de seneste målinger. Ingen nye datatyper — læser de samme
// BodyMeasurement-rækker som Kropsmål-siden (/api/body-measurements).

import type { BodyMeasurementField } from "@/lib/body-measurements";

export type BodyMeasurementSeriesEntry = Partial<Record<BodyMeasurementField, number | null>> & {
  measuredAt: string;
};

export type BodyMeasurementPoint = { measuredAt: string; value: number };

export type BodyMeasurementSeries = {
  points: BodyMeasurementPoint[];
  latest: number | null;
  /** Ændring fra næstseneste til seneste måling (null ved under to målinger). */
  change: number | null;
};

/** Højst så mange målinger pr. graf — kropsmål tages typisk ugentligt eller sjældnere. */
export const BODY_MEASUREMENT_CHART_POINTS = 10;

export function buildBodyMeasurementSeries(
  entries: BodyMeasurementSeriesEntry[],
  field: BodyMeasurementField,
  maxPoints = BODY_MEASUREMENT_CHART_POINTS,
): BodyMeasurementSeries {
  const points = entries
    .flatMap((entry) => {
      const value = entry[field];
      return typeof value === "number" && Number.isFinite(value) && value > 0
        ? [{ measuredAt: entry.measuredAt, value }]
        : [];
    })
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
    .slice(-maxPoints);

  const latest = points.length > 0 ? points[points.length - 1].value : null;
  const change =
    points.length > 1 ? Math.round((points[points.length - 1].value - points[points.length - 2].value) * 10) / 10 : null;

  return { points, latest, change };
}
