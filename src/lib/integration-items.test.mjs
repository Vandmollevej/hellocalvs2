// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { garminItems } from "./integrations/garmin-items.ts";
import { whoopItems, whoopLocalDay } from "./integrations/whoop-items.ts";
import { huaweiDailyItems, huaweiField, huaweiSleepItems, huaweiTimeMs, huaweiWeightItems } from "./integrations/huawei-items.ts";
import { brandForOrigin } from "./integrations/origins.ts";
import { withingsItems } from "./integrations/withings-items.ts";
import { filterItemsBySettings } from "./integrations/sync-settings.ts";

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

test("Withings: alle vægtens målinger kommer med, ikke kun vægt og fedt", () => {
  const items = withingsItems([
    {
      date: 1_790_000_000,
      measures: [
        { type: 1, value: 78400, unit: -3 },
        { type: 6, value: 215, unit: -1 },
        { type: 8, value: 16856, unit: -3 },
        { type: 5, value: 61544, unit: -3 },
        { type: 76, value: 331, unit: -1 },
        { type: 77, value: 4312, unit: -2 },
        { type: 88, value: 31, unit: -1 },
        { type: 170, value: 9, unit: 0 },
        { type: 226, value: 1712, unit: 0 },
        { type: 10, value: 128, unit: 0 },
        { type: 9, value: 82, unit: 0 },
        { type: 11, value: 64, unit: 0 },
        { type: 4, value: 182, unit: -2 },
        { type: 999, value: 1, unit: 0 },
      ],
    },
  ]);
  const weight = items.find((i) => i.kind === "weight");
  assert.equal(weight.payload.weightKg, 78.4);
  const m = byType(items);
  assert.equal(m.BODY_FAT_PERCENT.value, 21.5);
  assert.equal(m.FAT_MASS_KG.value, 16.86);
  assert.equal(m.FAT_FREE_MASS_KG.value, 61.54);
  assert.equal(m.MUSCLE_MASS_KG.value, 33.1);
  assert.equal(m.BODY_WATER_KG.value, 43.12);
  assert.equal(m.BODY_WATER_PERCENT.value, 55);
  assert.equal(m.BONE_MASS_KG.value, 3.1);
  assert.equal(m.VISCERAL_FAT_INDEX.value, 9);
  assert.equal(m.BASAL_METABOLIC_RATE_KCAL.value, 1712);
  assert.equal(m.BLOOD_PRESSURE_SYSTOLIC_MMHG.value, 128);
  assert.equal(m.BLOOD_PRESSURE_DIASTOLIC_MMHG.value, 82);
  assert.equal(m.HEART_RATE_BPM.value, 64);
  assert.equal(m.HEIGHT_CM.value, 182);
  assert.equal(Object.keys(m).length, 13, "ukendte måletyper springes over");

  // Standardvalgene for Withings lader alle målingerne komme igennem.
  assert.equal(filterItemsBySettings("WITHINGS", null, items).length, items.length);
});

test("Garmin og Huawei: knoglemasse og øvrige vægtmålinger", () => {
  const garmin = byType(garminItems("bodyComps", [{ measurementTimeInSeconds: 1_790_000_000, weightInGrams: 78400, boneMassInGrams: 3100 }]));
  assert.equal(garmin.BONE_MASS_KG.value, 3.1);
  const huawei = byType(
    huaweiWeightItems([
      {
        startTime: 1_790_000_000_000,
        value: [
          { fieldName: "body_weight", floatValue: 78.4 },
          { fieldName: "bone_salt", floatValue: 3.1 },
          { fieldName: "visceral_fat_level", floatValue: 9 },
          { fieldName: "basal_metabolism", floatValue: 1712 },
        ],
      },
    ])
  );
  assert.equal(huawei.BONE_MASS_KG.value, 3.1);
  assert.equal(huawei.VISCERAL_FAT_INDEX.value, 9);
  assert.equal(huawei.BASAL_METABOLIC_RATE_KCAL.value, 1712);
});
