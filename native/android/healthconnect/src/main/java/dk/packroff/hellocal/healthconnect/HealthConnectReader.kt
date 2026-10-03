// Reads Health Connect into the ingest format, one read type at a time and only
// for types the user switched on and granted. Day sums (steps, energy, heart
// rate …) use Health Connect's own aggregation, which de-duplicates phone and
// watch. Records Hello Cal itself wrote (dataOrigin = our package) are never
// sent back, so nothing loops between the two.
package dk.packroff.hellocal.healthconnect

import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.BodyWaterMassRecord
import androidx.health.connect.client.records.BoneMassRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.LeanBodyMassRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CancellationException
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.reflect.KClass

/** [complete] is false when a read failed for another reason than a missing permission. */
data class ReadResult(val data: IngestRequest, val complete: Boolean)

class HealthConnectReader(
    private val client: HealthConnectClient,
    private val ownPackage: String,
    private val granted: Set<String>,
    private val zone: ZoneId = ZoneId.systemDefault(),
) {
    private var complete = true

    suspend fun read(settings: SyncSettings, since: Instant, until: Instant): ReadResult {
        complete = true
        val fromDay = since.atZone(zone).toLocalDate()
        val from = fromDay.atStartOfDay(zone).toInstant()
        val window = Window(fromDay, from, until)

        val metrics = mutableListOf<IngestMetric>()
        val needsWeights = settings.reads("weight") || settings.reads("bodyWater")
        val weights = if (needsWeights) safely { readAll(WeightRecord::class, from, until) } else emptyList()

        if (settings.reads("bodyFat")) {
            metrics += safely { samples(BodyFatRecord::class, "BODY_FAT_PERCENT", window, { it.time }) { round1(it.percentage.value) } }
        }
        if (settings.reads("fatFreeMass")) {
            metrics += safely { samples(LeanBodyMassRecord::class, "FAT_FREE_MASS_KG", window, { it.time }) { round2(it.mass.inKilograms) } }
        }
        if (settings.reads("bodyWater")) metrics += safely { bodyWater(window, weights) }
        if (settings.reads("boneMass")) {
            metrics += safely { samples(BoneMassRecord::class, "BONE_MASS_KG", window, { it.time }) { round2(it.mass.inKilograms) } }
        }
        if (settings.reads("steps")) {
            metrics += safely { perDay(StepsRecord::class, "STEPS", StepsRecord.COUNT_TOTAL, window) { it.toDouble() } }
            metrics += safely { perDay(DistanceRecord::class, "DISTANCE_KM", DistanceRecord.DISTANCE_TOTAL, window) { round2(it.inKilometers) } }
            metrics += safely { perDay(FloorsClimbedRecord::class, "FLOORS_CLIMBED", FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL, window) { round1(it) } }
        }
        if (settings.reads("energy")) {
            metrics += safely {
                perDay(ActiveCaloriesBurnedRecord::class, "ACTIVE_ENERGY_KCAL", ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL, window) {
                    it.inKilocalories.roundToInt().toDouble()
                }
            }
            metrics += safely { restingEnergy(window) }
        }
        if (settings.reads("heart")) metrics += heart(window)
        if (settings.reads("sleep")) metrics += safely { sleep(window) }
        if (settings.reads("water")) metrics += safely { water(window) }
        if (settings.reads("body")) {
            metrics += safely { samples(HeightRecord::class, "HEIGHT_CM", window, { it.time }) { round1(it.height.inMeters * 100) } }
            metrics += safely { samples(BodyTemperatureRecord::class, "TEMPERATURE_C", window, { it.time }) { round1(it.temperature.inCelsius) } }
            metrics += safely {
                samples(BloodGlucoseRecord::class, "BLOOD_GLUCOSE_MMOL_L", window, { it.time }) { round1(it.level.inMillimolesPerLiter) }
            }
        }

        val weightItems = if (settings.reads("weight")) {
            weights.map { IngestWeight(round2(it.weight.inKilograms), it.time.toString(), originOf(it)) }
        } else {
            emptyList()
        }
        val activities = if (settings.reads("activities")) safely { activities(window) } else emptyList()

        return ReadResult(IngestRequest(metrics = metrics, weights = weightItems, activities = activities), complete)
    }

    private data class Window(val fromDay: LocalDate, val from: Instant, val until: Instant)

    private suspend fun heart(window: Window): List<IngestMetric> = buildList {
        addAll(safely { perDay(HeartRateRecord::class, "HEART_RATE_BPM", HeartRateRecord.BPM_AVG, window) { it.toDouble() } })
        addAll(safely { perDay(HeartRateRecord::class, "HEART_RATE_MIN_BPM", HeartRateRecord.BPM_MIN, window) { it.toDouble() } })
        addAll(safely { perDay(HeartRateRecord::class, "HEART_RATE_MAX_BPM", HeartRateRecord.BPM_MAX, window) { it.toDouble() } })
        addAll(safely { samples(RestingHeartRateRecord::class, "RESTING_HEART_RATE_BPM", window, { it.time }) { it.beatsPerMinute.toDouble() } })
        addAll(safely {
            samples(HeartRateVariabilityRmssdRecord::class, "HEART_RATE_VARIABILITY_MS", window, { it.time }) { round1(it.heartRateVariabilityMillis) }
        })
        addAll(safely { samples(OxygenSaturationRecord::class, "OXYGEN_SATURATION_PERCENT", window, { it.time }) { round1(it.percentage.value) } })
        addAll(safely { samples(RespiratoryRateRecord::class, "RESPIRATORY_RATE_BPM", window, { it.time }) { round1(it.rate) } })
        addAll(safely { samples(Vo2MaxRecord::class, "VO2_MAX", window, { it.time }) { round1(it.vo2MillilitersPerMinuteKilogram) } })
        addAll(safely {
            samples(BloodPressureRecord::class, "BLOOD_PRESSURE_SYSTOLIC_MMHG", window, { it.time }) { round1(it.systolic.inMillimetersOfMercury) }
        })
        addAll(safely {
            samples(BloodPressureRecord::class, "BLOOD_PRESSURE_DIASTOLIC_MMHG", window, { it.time }) { round1(it.diastolic.inMillimetersOfMercury) }
        })
    }

    /** Body water as % of body weight, only next to a weighing (±2 min) — same rule as the Withings sync. */
    private suspend fun bodyWater(window: Window, weights: List<WeightRecord>): List<IngestMetric> {
        if (!canRead(BodyWaterMassRecord::class)) return emptyList()
        return readAll(BodyWaterMassRecord::class, window.from, window.until).mapNotNull { water ->
            val weight = weights.minByOrNull { abs(Duration.between(it.time, water.time).seconds) }
                ?.takeIf { abs(Duration.between(it.time, water.time).seconds) <= 120 && it.weight.inKilograms > 0 }
                ?: return@mapNotNull null
            val percent = round1(water.mass.inKilograms / weight.weight.inKilograms * 100)
            IngestMetric("BODY_WATER_PERCENT", percent, water.time.toString(), originOf(water))
        }
    }

    /** Basal energy only when the user actually has BMR records (otherwise Health Connect may estimate it). */
    private suspend fun restingEnergy(window: Window): List<IngestMetric> {
        if (!canRead(BasalMetabolicRateRecord::class)) return emptyList()
        if (readAll(BasalMetabolicRateRecord::class, window.from.minus(Duration.ofDays(30)), window.until).isEmpty()) return emptyList()
        return perDay(BasalMetabolicRateRecord::class, "RESTING_ENERGY_KCAL", BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL, window) {
            it.inKilocalories.roundToInt().toDouble()
        }
    }

    private suspend fun activities(window: Window): List<IngestActivity> {
        if (!canRead(ExerciseSessionRecord::class)) return emptyList()
        return readAll(ExerciseSessionRecord::class, window.from, window.until).mapNotNull { session ->
            val minutes = (Duration.between(session.startTime, session.endTime).seconds / 60.0).roundToInt()
            if (minutes < 1) return@mapNotNull null
            IngestActivity(
                sportType = ExerciseTypes.nameOf(session.exerciseType),
                startedAt = session.startTime.toString(),
                durationMinutes = minutes,
                caloriesBurned = sessionCalories(session),
                origin = originOf(session),
            )
        }
    }

    /** Active calories from the same app as the session, so phone + watch are not added together. */
    private suspend fun sessionCalories(session: ExerciseSessionRecord): Double {
        if (!canRead(ActiveCaloriesBurnedRecord::class)) return 0.0
        val result = try {
            client.aggregate(
                AggregateRequest(
                    metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                    dataOriginFilter = setOf(session.metadata.dataOrigin),
                ),
            )
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            null
        }
        return result?.get(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)?.inKilocalories?.roundToInt()?.toDouble() ?: 0.0
    }

    /**
     * One night per local date of the session end. If several apps logged the
     * same night, the app with the longest total is used (no double counting).
     */
    private suspend fun sleep(window: Window): List<IngestMetric> {
        if (!canRead(SleepSessionRecord::class)) return emptyList()
        val sessions = readAll(SleepSessionRecord::class, window.from.minus(Duration.ofHours(12)), window.until)
        val byDay = sessions.groupBy { it.endTime.atZone(it.endZoneOffset ?: zone).toLocalDate() }
        return byDay.filterKeys { !it.isBefore(window.fromDay) }.flatMap { (day, nightSessions) ->
            val chosen = nightSessions.groupBy(::originOf).values.maxBy { group -> group.sumOf { minutes(it.startTime, it.endTime) } }
            val inBed = chosen.sumOf { minutes(it.startTime, it.endTime) }
            val stages = chosen.flatMap { it.stages }
            fun stageMinutes(types: Set<Int>) = stages.filter { it.stage in types }.sumOf { minutes(it.startTime, it.endTime) }
            val awake = stageMinutes(AWAKE_STAGES)
            val key = dayKey(day)
            val origin = originOf(chosen.first())
            buildList {
                add(IngestMetric("SLEEP_MINUTES", (inBed - awake).roundToInt().toDouble(), key, origin))
                add(IngestMetric("SLEEP_IN_BED_MINUTES", inBed.roundToInt().toDouble(), key, origin))
                if (stages.isNotEmpty()) {
                    add(IngestMetric("SLEEP_AWAKE_MINUTES", awake.roundToInt().toDouble(), key, origin))
                    add(IngestMetric("SLEEP_DEEP_MINUTES", stageMinutes(setOf(SleepSessionRecord.STAGE_TYPE_DEEP)).roundToInt().toDouble(), key, origin))
                    add(IngestMetric("SLEEP_REM_MINUTES", stageMinutes(setOf(SleepSessionRecord.STAGE_TYPE_REM)).roundToInt().toDouble(), key, origin))
                    add(IngestMetric("SLEEP_LIGHT_MINUTES", stageMinutes(setOf(SleepSessionRecord.STAGE_TYPE_LIGHT)).roundToInt().toDouble(), key, origin))
                }
            }
        }
    }

    /** Water is summed from raw records, because Hello Cal writes hydration itself and must not count it back. */
    private suspend fun water(window: Window): List<IngestMetric> {
        if (!canRead(HydrationRecord::class)) return emptyList()
        val records = readAll(HydrationRecord::class, window.from, window.until)
        return records.groupBy { it.startTime.atZone(it.startZoneOffset ?: zone).toLocalDate() }.map { (day, drinks) ->
            val origin = drinks.groupingBy(::originOf).eachCount().maxBy { it.value }.key
            IngestMetric("WATER_ML", drinks.sumOf { it.volume.inMilliliters }.roundToInt().toDouble(), dayKey(day), origin)
        }
    }

    private suspend fun <T : Any> perDay(
        recordType: KClass<out Record>,
        type: String,
        metric: AggregateMetric<T>,
        window: Window,
        value: (T) -> Double,
    ): List<IngestMetric> {
        if (!canRead(recordType)) return emptyList()
        val buckets = client.aggregateGroupByPeriod(
            AggregateGroupByPeriodRequest(
                metrics = setOf(metric),
                timeRangeFilter = TimeRangeFilter.between(window.fromDay.atStartOfDay(), LocalDateTime.ofInstant(window.until, zone)),
                timeRangeSlicer = Period.ofDays(1),
            ),
        )
        return buckets.mapNotNull { bucket ->
            val total = bucket.result[metric] ?: return@mapNotNull null
            IngestMetric(type, value(total), dayKey(bucket.startTime.toLocalDate()), originOf(bucket.result))
        }
    }

    private suspend fun <T : Record> samples(
        recordType: KClass<T>,
        type: String,
        window: Window,
        time: (T) -> Instant,
        value: (T) -> Double,
    ): List<IngestMetric> {
        if (!canRead(recordType)) return emptyList()
        return readAll(recordType, window.from, window.until).map { IngestMetric(type, value(it), time(it).toString(), originOf(it)) }
    }

    /** All pages of a record type, without the records Hello Cal wrote itself. */
    private suspend fun <T : Record> readAll(recordType: KClass<T>, from: Instant, until: Instant): List<T> {
        if (!canRead(recordType)) return emptyList()
        val records = mutableListOf<T>()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = recordType,
                    timeRangeFilter = TimeRangeFilter.between(from, until),
                    pageToken = pageToken,
                ),
            )
            records += response.records.filter { it.metadata.dataOrigin.packageName != ownPackage }
            pageToken = response.pageToken
        } while (!pageToken.isNullOrEmpty())
        return records
    }

    private suspend fun <T> safely(block: suspend () -> List<T>): List<T> = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: SecurityException) {
        emptyList()
    } catch (e: Exception) {
        Log.w(TAG, "Health Connect read failed: ${e.javaClass.simpleName}")
        complete = false
        emptyList()
    }

    private fun canRead(type: KClass<out Record>) = HealthConnectPermissions.canRead(granted, type)

    private fun originOf(record: Record): String = record.metadata.dataOrigin.packageName

    private fun originOf(result: AggregationResult): String? =
        result.dataOrigins.map { it.packageName }.filter { it != ownPackage }.minOrNull()

    private companion object {
        const val TAG = "HelloCalHealthConnect"

        val AWAKE_STAGES = setOf(
            SleepSessionRecord.STAGE_TYPE_AWAKE,
            SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
            SleepSessionRecord.STAGE_TYPE_OUT_OF_BED,
        )

        /** Server convention for day sums: the local date at midnight UTC (see google-health.ts). */
        fun dayKey(day: LocalDate) = "${day}T00:00:00.000Z"

        fun minutes(start: Instant, end: Instant) = Duration.between(start, end).seconds / 60.0

        fun round1(value: Double) = (value * 10).roundToInt() / 10.0

        fun round2(value: Double) = (value * 100).roundToInt() / 100.0
    }
}
