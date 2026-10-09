"use client";

// Kropsmål som statistikgraf (2026-10-02): samme kort som på Kropsmål-siden —
// tegningen til venstre i fast bredde — men til højre vises målingernes
// forløb som graf i stedet for indtastningsfeltet. Serien bygges i
// src/lib/body-measurement-series.ts.

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  BODY_MEASUREMENT_FIELDS,
  type BodyMeasurementField,
  type BodyMeasurementSex,
} from "@/lib/body-measurements";
import { buildBodyMeasurementSeries, type BodyMeasurementSeriesEntry } from "@/lib/body-measurement-series";
import { cmToIn, formatLength, lengthUnitLabel, useUnits, type HeightUnit } from "@/lib/units";

const WIDTH = 200;
const HEIGHT = 84;
const LEFT = 6;
const RIGHT = WIDTH - 6;
const TOP = 10;
const BOTTOM = HEIGHT - 10;

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" }).format(new Date(value));
}

function formatChange(cm: number, unit: HeightUnit) {
  const value = unit === "in" ? cmToIn(cm) : cm;
  return `${String(Math.round(value * 10) / 10).replace(".", ",")} ${lengthUnitLabel(unit)}`;
}

export function BodyMeasurementChart({
  field,
  entries,
  sex,
  loading = false,
}: {
  field: BodyMeasurementField;
  entries: BodyMeasurementSeriesEntry[];
  sex: BodyMeasurementSex | null;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  // Målingerne gemmes i cm; visningen følger brugerens valg (cm/tommer).
  const { height: lengthUnit } = useUnits();
  const definition = BODY_MEASUREMENT_FIELDS.find((d) => d.field === field);
  if (!definition) return null;

  const { points, latest, change } = buildBodyMeasurementSeries(entries, field);
  const label = t(definition.nameKey);

  // x efter tid (ikke jævnt fordelt), så uregelmæssige målinger ses som de er.
  const times = points.map((p) => new Date(p.measuredAt).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const values = points.map((p) => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const x = (time: number) =>
    maxTime === minTime ? (LEFT + RIGHT) / 2 : LEFT + ((time - minTime) / (maxTime - minTime)) * (RIGHT - LEFT);
  const y = (value: number) =>
    maxValue === minValue ? (TOP + BOTTOM) / 2 : BOTTOM - ((value - minValue) / (maxValue - minValue)) * (BOTTOM - TOP);
  const coords = points.map((p, i) => ({ x: x(times[i]), y: y(p.value) }));

  return (
    <div className="items-center hf-card--row hf-card--form hf-card">
      <span className="flex h-[108px] w-20 shrink-0 items-center justify-center">
        {definition.image && (
          <Image
            src={definition.image[sex ?? "FEMALE"]}
            alt=""
            width={80}
            height={108}
            className="h-full w-full object-contain"
          />
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="hf-type-body hf-type-strong text-hf-black">{label}</p>
          {latest !== null && (
            <p className="hf-type-body hf-type-strong shrink-0 text-hf-black">
              {formatLength(latest, lengthUnit)}
            </p>
          )}
        </div>

        {loading ? (
          <div className="h-[84px] animate-pulse rounded-xl bg-hf-tan-dark" />
        ) : points.length === 0 ? (
          <div className="flex h-[84px] flex-col items-start justify-center gap-1">
            <p className="hf-type-small text-text-secondary">{t("bodyMeasurementChart.noData")}</p>
            <Link href="/profile/body-measurements" className="hf-type-small hf-type-strong text-hf-black underline">
              {t("bodyMeasurementChart.register")}
            </Link>
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full overflow-visible"
              role="img"
              aria-label={t("bodyMeasurementChart.aria", { name: label })}
            >
              {points.length > 1 && (
                <>
                  <text x={LEFT} y={TOP - 3} fontSize="8" fill="var(--hf-gray)">
                    {formatLength(maxValue, lengthUnit)}
                  </text>
                  <text x={LEFT} y={BOTTOM + 9} fontSize="8" fill="var(--hf-gray)">
                    {formatLength(minValue, lengthUnit)}
                  </text>
                  <polyline
                    points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
                    fill="none"
                    stroke="var(--hf-green)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {coords.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--hf-green)" />
              ))}
            </svg>
            <div className="flex items-baseline justify-between gap-2">
              <span className="hf-type-micro text-text-secondary">
                {points.length > 1
                  ? `${formatShortDate(points[0].measuredAt)} – ${formatShortDate(points[points.length - 1].measuredAt)}`
                  : formatShortDate(points[0].measuredAt)}
              </span>
              {change !== null && change !== 0 && (
                <span className="hf-type-micro hf-type-strong text-hf-black">
                  {t("bodyMeasurementChart.change", {
                    value: `${change > 0 ? "+" : "−"}${formatChange(Math.abs(change), lengthUnit)}`,
                  })}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
