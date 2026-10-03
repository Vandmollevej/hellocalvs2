// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { garminItems } from "./integrations/garmin-items.ts";
import { whoopItems, whoopLocalDay } from "./integrations/whoop-items.ts";
import { huaweiDailyItems, huaweiField, huaweiSleepItems, huaweiTimeMs, huaweiWeightItems } from "./integrations/huawei-items.ts";
import { brandForOrigin } from "./integrations/origins.ts";
import { readTypeOf } from "./integrations/sync-settings.ts";
import { withingsActivityItems, withingsMeasureItems, withingsSleepItems, withingsWorkoutItems } from "./integrations/withings-items.ts";
import { polarCardioLoadItems, polarRechargeItems, polarSleepItems } from "./integrations/polar-items.ts";
import { fitbitNumber, fitbitSeriesItems, fitbitSleepItems } from "./integrations/fitbit-items.ts";
import { huaweiSampleItems, HUAWEI_SAMPLE_TYPES } from "./integrations/huawei-items.ts";

const byType = (items) => Object.fromEntries(items.filter((i) => i.kind === "metric").map((i) => [i.payload.type, i.payload]));

test("Garmin: dagsopsummering bliver dagssummer på den lokale dato", () => {
  const items = garminItems("dailies", [
    { calendarDate: "2026-10-01", steps: 8421, distanceInMeters: 6234, activeKilocalories: 410, averageStressLevel: -1, vigorousIntensityDurationInSeconds: 600 },
  ]);
  const m = byType(items);
  assert.equal(m.STEPS.value, 8421);
  assert.equal(m.STEPS.recordedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(m.DISTANCE_KM.value, 6.23);
  assert.equal(m.ACTIVE_ENERGY_KCAL.value, 410);
  assert.equal(m.ACTIVE_ZONE_MINUTES.value, 20);
  assert.equal(m.STRESS_SCORE, undefined, "-1 betyder ikke målt");
});

test("Garmin: kropssammensætning giver vejning i kg og målinger", () => {
  const items = garminItems("bodyComps", [{ measurementTimeInSeconds: 1_790_000_000, weightInGrams: 78400, bodyFatInPercent: 21.5, muscleMassInGrams: 33100 }]);
  const weight = items.find((i) => i.kind === "weight");
  assert.equal(weight.payload.weightKg, 78.4);
  assert.equal(weight.payload.source, "GARMIN");
  assert.equal(byType(items).MUSCLE_MASS_KG.value, 33.1);
});

test("Garmin: knoglemasse i kg", () => {
  const items = garminItems("bodyComps", [{ measurementTimeInSeconds: 1_790_000_000, boneMassInGrams: 3200 }]);
  assert.equal(byType(items).BONE_MASS_KG.value, 3.2);
});

test("Garmin: træning uden varighed springes over", () => {
  const items = garminItems("activities", [
    { activityType: "RUNNING", startTimeInSeconds: 1_790_000_000, durationInSeconds: 1800, activeKilocalories: 320 },
    { activityType: "WALKING", startTimeInSeconds: 1_790_000_000 },
  ]);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].payload, { source: "GARMIN", sportType: "running", startedAt: new Date(1_790_000_000_000).toISOString(), durationMinutes: 30, caloriesBurned: 320 });
});

test("WHOOP: lokal dato følger tidszonen", () => {
  assert.equal(whoopLocalDay("2026-09-30T23:30:00.000Z", "+02:00"), "2026-10-01");
  assert.equal(whoopLocalDay("2026-10-01T03:00:00.000Z", "-05:00"), "2026-09-30");
});

test("WHOOP: søvn, restitution og træning", () => {
  const items = whoopItems(
    [{ start: "2026-10-01T16:00:00.000Z", end: "2026-10-01T16:45:00.000Z", sport_name: "Running", score_state: "SCORED", score: { kilojoule: 1673.6 } }],
    [
      {
        id: "s1",
        end: "2026-10-01T05:00:00.000Z",
        timezone_offset: "+02:00",
        score_state: "SCORED",
        score: { stage_summary: { total_in_bed_time_milli: 8 * 3_600_000, total_awake_time_milli: 30 * 60_000 }, sleep_performance_percentage: 91 },
      },
      { id: "nap", end: "2026-10-01T13:00:00.000Z", nap: true, score_state: "SCORED", score: {} },
    ],
    [{ sleep_id: "s1", created_at: "2026-10-01T05:10:00.000Z", score_state: "SCORED", score: { resting_heart_rate: 52, hrv_rmssd_milli: 61.2 } }]
  );
  const activity = items.find((i) => i.kind === "activity");
  assert.equal(activity.payload.durationMinutes, 45);
  assert.equal(activity.payload.caloriesBurned, 400);
  const m = byType(items);
  assert.equal(m.SLEEP_MINUTES.value, 450);
  assert.equal(m.SLEEP_MINUTES.recordedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(m.RESTING_HEART_RATE_BPM.recordedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(m.HEART_RATE_VARIABILITY_MS.value, 61.2);
  assert.equal(items.filter((i) => i.payload.type === "SLEEP_MINUTES").length, 1, "lur tæller ikke");
});

test("Huawei: tidsstempler i s, ms og ns", () => {
  assert.equal(huaweiTimeMs(1_790_000_000), 1_790_000_000_000);
  assert.equal(huaweiTimeMs(1_790_000_000_000), 1_790_000_000_000);
  assert.equal(huaweiTimeMs("1790000000000000000"), 1_790_000_000_000);
  assert.equal(huaweiTimeMs(undefined), null);
});

test("Huawei: feltværdier og dagssummer", () => {
  assert.equal(huaweiField([{ fieldName: "steps", integerValue: 5 }], "steps"), 5);
  const startOfDayCopenhagen = Date.parse("2026-09-30T22:00:00.000Z");
  const items = huaweiDailyItems("STEPS", ["steps"], [
    { startTime: startOfDayCopenhagen, sampleSet: [{ samplePoints: [{ value: [{ fieldName: "steps", integerValue: 9120 }] }] }] },
  ]);
  assert.equal(items[0].payload.value, 9120);
  assert.equal(items[0].payload.recordedAt, "2026-10-01T00:00:00.000Z");
});

test("Huawei: vægt og søvn", () => {
  const weights = huaweiWeightItems([{ endTime: 1_790_000_000_000, value: [{ fieldName: "body_weight", floatValue: 80.2 }, { fieldName: "body_fat_rate", floatValue: 19 }] }]);
  assert.equal(weights.find((i) => i.kind === "weight").payload.weightKg, 80.2);
  assert.equal(byType(weights).BODY_FAT_PERCENT.value, 19);
  const sleep = huaweiSleepItems([{ endTime: Date.parse("2026-10-01T05:00:00.000Z") * 1e6, value: [{ fieldName: "all_sleep_time", integerValue: 420 }] }]);
  assert.equal(byType(sleep).SLEEP_MINUTES.value, 420);
  assert.equal(byType(sleep).SLEEP_MINUTES.recordedAt, "2026-10-01T00:00:00.000Z");
});

test("Afsender-app genkendes som mærke", () => {
  assert.equal(brandForOrigin("com.sec.android.app.shealth"), "SAMSUNG_HEALTH");
  assert.equal(brandForOrigin("com.qingniu.renpho"), "RENPHO");
  assert.equal(brandForOrigin("com.eufylife.smarthome"), "EUFY");
  assert.equal(brandForOrigin("com.mi.health"), "XIAOMI");
  assert.equal(brandForOrigin("com.huami.watch.hmwatchmanager"), "XIAOMI");
  assert.equal(brandForOrigin("com.tuya.smartlife"), "TUYA");
  assert.equal(brandForOrigin("com.garmin.android.apps.connectmobile"), null);
  assert.equal(brandForOrigin(undefined), null);
});

test("Withings: hele kropssammensætningen, højde i cm og kropsvand i %", () => {
  const items = withingsMeasureItems([
    {
      date: 1_790_000_000,
      measures: [
        { type: 1, value: 80000, unit: -3 },
        { type: 4, value: 182, unit: -2 },
        { type: 5, value: 6200, unit: -2 },
        { type: 6, value: 225, unit: -1 },
        { type: 8, value: 1800, unit: -2 },
        { type: 11, value: 62, unit: 0 },
        { type: 76, value: 5880, unit: -2 },
        { type: 77, value: 4400, unit: -2 },
        { type: 88, value: 320, unit: -2 },
        { type: 170, value: 9, unit: 0 },
        { type: 999, value: 1, unit: 0 },
      ],
    },
  ]);
  const weight = items.find((i) => i.kind === "weight");
  assert.equal(weight.payload.weightKg, 80);
  const m = byType(items);
  assert.equal(m.HEIGHT_CM.value, 182);
  assert.equal(m.FAT_FREE_MASS_KG.value, 62);
  assert.equal(m.BODY_FAT_PERCENT.value, 22.5);
  assert.equal(m.FAT_MASS_KG.value, 18);
  assert.equal(m.HEART_RATE_BPM.value, 62);
  assert.equal(m.MUSCLE_MASS_KG.value, 58.8);
  assert.equal(m.BODY_WATER_PERCENT.value, 55);
  assert.equal(m.BONE_MASS_KG.value, 3.2);
  assert.equal(m.VISCERAL_FAT_INDEX.value, 9);
  assert.equal(items.length, 10, "ukendte måletyper springes over");
});

test("Hver kropsmåling har sin egen til/fra-række", () => {
  const metric = (type) => ({ kind: "metric", payload: { type } });
  assert.equal(readTypeOf(metric("BODY_FAT_PERCENT")), "bodyFat");
  assert.equal(readTypeOf(metric("FAT_MASS_KG")), "bodyFat");
  assert.equal(readTypeOf(metric("MUSCLE_MASS_KG")), "muscleMass");
  assert.equal(readTypeOf(metric("FAT_FREE_MASS_KG")), "fatFreeMass");
  assert.equal(readTypeOf(metric("BODY_WATER_PERCENT")), "bodyWater");
  assert.equal(readTypeOf(metric("BONE_MASS_KG")), "boneMass");
  assert.equal(readTypeOf(metric("VISCERAL_FAT_INDEX")), "visceralFat");
  assert.equal(readTypeOf(metric("HEIGHT_CM")), "body");
});

test("Withings: hele kropssammensætningen fra én vejning", () => {
  const items = withingsMeasureItems([
    {
      date: 1_790_000_000,
      measures: [
        { type: 1, value: 80000, unit: -3 },
        { type: 6, value: 215, unit: -1 },
        { type: 8, value: 1720, unit: -2 },
        { type: 5, value: 6280, unit: -2 },
        { type: 76, value: 5950, unit: -2 },
        { type: 77, value: 4400, unit: -2 },
        { type: 88, value: 330, unit: -2 },
        { type: 170, value: 9, unit: 0 },
        { type: 226, value: 1750, unit: 0 },
        { type: 227, value: 38, unit: 0 },
        { type: 168, value: 1800, unit: -2 },
        { type: 91, value: 72, unit: -1 },
        { type: 4, value: 1820, unit: -3 },
      ],
    },
  ]);
  assert.equal(items.find((i) => i.kind === "weight").payload.weightKg, 80);
  const m = byType(items);
  assert.equal(m.BODY_FAT_PERCENT.value, 21.5);
  assert.equal(m.FAT_MASS_KG.value, 17.2);
  assert.equal(m.FAT_FREE_MASS_KG.value, 62.8);
  assert.equal(m.MUSCLE_MASS_KG.value, 59.5);
  assert.equal(m.BODY_WATER_PERCENT.value, 55);
  assert.equal(m.BONE_MASS_KG.value, 3.3);
  assert.equal(m.VISCERAL_FAT_INDEX.value, 9);
  assert.equal(m.BASAL_METABOLIC_RATE_KCAL.value, 1750);
  assert.equal(m.METABOLIC_AGE_YEARS.value, 38);
  assert.equal(m.EXTRACELLULAR_WATER_KG.value, 18);
  assert.equal(m.PULSE_WAVE_VELOCITY_M_S.value, 7.2);
  assert.equal(m.HEIGHT_CM.value, 182);
  assert.ok(Object.values(m).every((p) => p.source === "WITHINGS"));
});

test("Withings: blodtryk og puls fra blodtryksmåler", () => {
  const m = byType(withingsMeasureItems([{ date: 1_790_000_000, measures: [{ type: 10, value: 128, unit: 0 }, { type: 9, value: 82, unit: 0 }, { type: 11, value: 64, unit: 0 }] }]));
  assert.equal(m.BLOOD_PRESSURE_SYSTOLIC_MMHG.value, 128);
  assert.equal(m.BLOOD_PRESSURE_DIASTOLIC_MMHG.value, 82);
  assert.equal(m.HEART_RATE_BPM.value, 64);
});

test("Withings: dagsaktivitet, søvn og træning", () => {
  const a = byType(withingsActivityItems([{ date: "2026-10-01", steps: 9100, distance: 7250, elevation: 6, calories: 420, moderate: 1200, intense: 600, hr_average: 71 }]));
  assert.equal(a.STEPS.recordedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(a.DISTANCE_KM.value, 7.25);
  assert.equal(a.FLOORS_CLIMBED.value, 6);
  assert.equal(a.EXERCISE_MINUTES.value, 30);
  assert.equal(a.ACTIVE_ZONE_MINUTES.value, 40);

  const s = byType(
    withingsSleepItems([
      {
        date: "2026-10-02",
        startdate: Date.parse("2026-10-01T21:30:00Z") / 1000,
        enddate: Date.parse("2026-10-02T05:00:00Z") / 1000,
        timezone: "Europe/Copenhagen",
        data: { total_sleep_time: 25200, deepsleepduration: 5400, wakeupcount: 2, sleep_efficiency: 0.93, sleep_score: 81 },
      },
    ])
  );
  assert.equal(s.SLEEP_MINUTES.value, 420);
  assert.equal(s.SLEEP_DEEP_MINUTES.value, 90);
  assert.equal(s.SLEEP_EFFICIENCY_PERCENT.value, 93);
  assert.equal(s.SLEEP_START_MINUTE_OF_DAY.value, 23 * 60 + 30);
  assert.equal(s.SLEEP_END_MINUTE_OF_DAY.value, 7 * 60);

  const [w] = withingsWorkoutItems([{ category: 2, startdate: 1_790_000_000, enddate: 1_790_001_800, data: { calories: 310 } }]);
  assert.deepEqual(w.payload, { source: "WITHINGS", sportType: "running", startedAt: new Date(1_790_000_000_000).toISOString(), durationMinutes: 30, caloriesBurned: 310 });
});

test("Garmin: knoglemasse, blodtryk, VO2 max og SpO2", () => {
  const body = byType(garminItems("bodyComps", [{ measurementTimeInSeconds: 1_790_000_000, boneMassInGrams: 3200 }]));
  assert.equal(body.BONE_MASS_KG.value, 3.2);
  const bp = byType(garminItems("bloodPressures", [{ measurementTimeInSeconds: 1_790_000_000, systolic: 121, diastolic: 79 }]));
  assert.equal(bp.BLOOD_PRESSURE_SYSTOLIC_MMHG.value, 121);
  const um = byType(garminItems("userMetrics", [{ calendarDate: "2026-10-01", vo2Max: 48, fitnessAge: 35 }]));
  assert.equal(um.VO2_MAX.value, 48);
  assert.equal(um.FITNESS_AGE_YEARS.value, 35);
  const ox = byType(garminItems("pulseox", [{ startTimeInSeconds: 1_790_000_000, timeOffsetSpo2Values: { 0: 96, 60: 98 } }]));
  assert.equal(ox.OXYGEN_SATURATION_PERCENT.value, 97);
});

test("WHOOP: strain, restitution og hudtemperatur", () => {
  const m = byType(
    whoopItems([], [], [{ created_at: "2026-10-02T06:00:00Z", score_state: "SCORED", score: { recovery_score: 67, skin_temp_celsius: 33.4 } }], [
      { start: "2026-10-01T22:30:00Z", timezone_offset: "+02:00", score_state: "SCORED", score: { strain: 12.4, max_heart_rate: 171 } },
    ])
  );
  assert.equal(m.RECOVERY_SCORE.value, 67);
  assert.equal(m.SKIN_TEMPERATURE_C.value, 33.4);
  assert.equal(m.STRAIN_SCORE.value, 12.4);
  assert.equal(m.STRAIN_SCORE.recordedAt, "2026-10-02T00:00:00.000Z");
});

test("Huawei: hele vægtens sammensætning og blodtryk", () => {
  const m = byType(
    huaweiWeightItems([
      {
        endTime: 1_790_000_000_000,
        value: [
          { fieldName: "body_weight", floatValue: 80 },
          { fieldName: "bone_salt", floatValue: 3.1 },
          { fieldName: "visceral_fat_level", floatValue: 8 },
          { fieldName: "basal_metabolism", floatValue: 1700 },
          { fieldName: "moisture", floatValue: 44 },
        ],
      },
    ])
  );
  assert.equal(m.BONE_MASS_KG.value, 3.1);
  assert.equal(m.VISCERAL_FAT_INDEX.value, 8);
  assert.equal(m.BASAL_METABOLIC_RATE_KCAL.value, 1700);
  assert.equal(m.BODY_WATER_PERCENT.value, 55);

  const bp = HUAWEI_SAMPLE_TYPES.find((t) => t.scope === "bloodpressure");
  const s = byType(huaweiSampleItems(bp.metrics, [{ endTime: 1_790_000_000_000, value: [{ fieldName: "systolic_pressure", floatValue: 125 }, { fieldName: "diastolic_pressure", floatValue: 80 }] }]));
  assert.equal(s.BLOOD_PRESSURE_SYSTOLIC_MMHG.value, 125);
  assert.equal(s.BLOOD_PRESSURE_DIASTOLIC_MMHG.value, 80);
});

test("Polar: søvn, Nightly Recharge og cardio load", () => {
  const s = byType(polarSleepItems([{ date: "2026-10-02", sleep_start_time: "2026-10-01T23:10:00+02:00", sleep_end_time: "2026-10-02T07:00:00+02:00", light_sleep: 14400, deep_sleep: 5400, rem_sleep: 5400, sleep_score: 82 }]));
  assert.equal(s.SLEEP_MINUTES.value, 420);
  assert.equal(s.SLEEP_IN_BED_MINUTES.value, 470);
  assert.equal(s.SLEEP_START_MINUTE_OF_DAY.value, 23 * 60 + 10);
  const r = byType(polarRechargeItems([{ date: "2026-10-02", heart_rate_avg: 52, heart_rate_variability_avg: 61, breathing_rate_avg: 14.2 }]));
  assert.equal(r.HEART_RATE_VARIABILITY_MS.value, 61);
  assert.equal(byType(polarCardioLoadItems([{ date: "2026-10-02", cardio_load: 88.5 }])).CARDIO_LOAD.value, 88.5);
});

test("Fitbit: talstrenge, VO2 max-interval og hovedsøvn", () => {
  assert.equal(fitbitNumber("44-48"), 46);
  assert.equal(byType(fitbitSeriesItems("STEPS", [{ dateTime: "2026-10-01", value: "8123" }])).STEPS.value, 8123);
  assert.equal(byType(fitbitSeriesItems("RESTING_HEART_RATE_BPM", [{ dateTime: "2026-10-01", value: { restingHeartRate: 58 } }], (v) => v.restingHeartRate)).RESTING_HEART_RATE_BPM.value, 58);
  const items = fitbitSleepItems([
    { dateOfSleep: "2026-10-02", isMainSleep: true, minutesAsleep: 410, levels: { summary: { deep: { minutes: 80 }, wake: { minutes: 30, count: 3 } } } },
    { dateOfSleep: "2026-10-02", isMainSleep: false, minutesAsleep: 25 },
  ]);
  const m = byType(items);
  assert.equal(m.SLEEP_MINUTES.value, 410);
  assert.equal(m.SLEEP_AWAKENINGS.value, 3);
});
