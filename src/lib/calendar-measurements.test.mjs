// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMeasurementValue, formatWeightKg, measurementsForDay } from "./calendar-measurements.ts";

const onOct3 = (d) => d.toISOString().startsWith("2026-10-03");

test("vejning og vægtens målinger samles til ét tidspunkt", () => {
  const items = measurementsForDay(
    [{ id: "w1", weightKg: 80.2, weighedAt: "2026-10-03T06:10:00.000Z", source: "WITHINGS" }],
    [
      { type: "MUSCLE_MASS_KG", value: 59.5, recordedAt: "2026-10-03T06:10:00.000Z", source: "WITHINGS" },
      { type: "BODY_FAT_PERCENT", value: 21.5, recordedAt: "2026-10-03T06:10:30.000Z", source: "WITHINGS" },
      { type: "STEPS", value: 9000, recordedAt: "2026-10-03T00:00:00.000Z", source: "WITHINGS" },
      { type: "BODY_FAT_PERCENT", value: 22, recordedAt: "2026-10-02T06:10:00.000Z", source: "WITHINGS" },
    ],
    onOct3
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].weightKg, 80.2);
  assert.deepEqual(items[0].metrics.map((m) => m.type), ["BODY_FAT_PERCENT", "MUSCLE_MASS_KG"]);
});

test("måling uden vejning (blodtryk) står for sig", () => {
  const items = measurementsForDay(
    [],
    [
      { type: "BLOOD_PRESSURE_SYSTOLIC_MMHG", value: 128, recordedAt: "2026-10-03T19:00:00.000Z" },
      { type: "BLOOD_PRESSURE_DIASTOLIC_MMHG", value: 82, recordedAt: "2026-10-03T19:00:00.000Z" },
    ],
    onOct3
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].weightKg, null);
  assert.equal(items[0].metrics.length, 2);
});

test("formatering", () => {
  assert.equal(formatWeightKg(80), "80,0 kg");
  assert.equal(formatMeasurementValue({ type: "BODY_FAT_PERCENT", value: 21.46, recordedAt: "" }), "21,5 %");
  assert.equal(formatMeasurementValue({ type: "VISCERAL_FAT_INDEX", value: 9, recordedAt: "" }), "9");
});
