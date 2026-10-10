package dk.packroff.hellocal.screens.food

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.daysUntil
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.minus
import kotlinx.datetime.plus
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlin.math.max

/**
 * Native port of src/lib/custom-measurements.ts and src/lib/custom-measure-text.ts:
 * "Tilføj egen måling" (Indstillinger → Visning → Forside). Same storage key
 * as the web (hellocal.frontpage.customMeasurements), kept in secureStorage.
 */

const val CUSTOM_MEASURE_MAX_LINES = 2
const val CUSTOM_MEASURE_MAX_LINE_LENGTH = 15

fun clampMeasureText(raw: String): String =
    raw.replace("\r", "").split("\n").take(CUSTOM_MEASURE_MAX_LINES).joinToString("\n") { it.take(CUSTOM_MEASURE_MAX_LINE_LENGTH) }

fun measureTextLines(text: String): List<String> =
    clampMeasureText(text).split("\n").map { it.trim() }.filter { it.isNotEmpty() }

/** One word per line when the label does not fit on a single line. */
fun suggestMeasureText(label: String): String {
    val words = label.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.toMutableList()
    if (words.isEmpty()) return ""
    val full = words.joinToString(" ")
    if (full.length <= CUSTOM_MEASURE_MAX_LINE_LENGTH) return full
    val first = mutableListOf<String>()
    while (words.isNotEmpty() && (first + words[0]).joinToString(" ").length <= CUSTOM_MEASURE_MAX_LINE_LENGTH) {
        first.add(words.removeAt(0))
    }
    return clampMeasureText(first.joinToString(" ") + "\n" + words.joinToString(" "))
}

enum class MeasureGroup(val key: String) { Food("food"), Activity("activity"), Sleep("sleep"), Heart("heart"), Body("body") }

enum class MeasureKind { Food, Sum, Avg, Latest, Remaining }

data class MeasureParamDef(
    val key: String,
    val labelKey: String,
    val group: MeasureGroup,
    val kind: MeasureKind,
    val source: String?,
    val unit: String,
    val digits: Int = 0,
    val divisor: Double = 1.0,
)

private fun measureParam(key: String, group: MeasureGroup, kind: MeasureKind, source: String?, unit: String, digits: Int = 0, divisor: Double = 1.0) =
    MeasureParamDef(key, "customMeasure.param.$key", group, kind, source, unit, digits, divisor)

// Mirrors NUTRIENTS in src/lib/nutrients.ts (key, unit, digits).
private val MEASURE_NUTRIENT_DEFS = listOf(
    Triple("saturatedFat", "g", 1), Triple("unsaturatedFat", "g", 1), Triple("transFat", "g", 2), Triple("cholesterol", "mg", 0),
    Triple("sugar", "g", 1), Triple("fiber", "g", 1), Triple("salt", "g", 1), Triple("sodium", "mg", 0), Triple("potassium", "mg", 0),
    Triple("calcium", "mg", 0), Triple("magnesium", "mg", 0), Triple("iron", "mg", 1), Triple("zinc", "mg", 1), Triple("copper", "mg", 2),
    Triple("manganese", "mg", 2), Triple("selenium", "µg", 0), Triple("phosphorus", "mg", 0), Triple("iodine", "µg", 0),
    Triple("vitaminA", "µg", 0), Triple("vitaminC", "mg", 0), Triple("vitaminD", "µg", 1), Triple("vitaminE", "mg", 1),
    Triple("vitaminK", "µg", 0), Triple("vitaminB1", "mg", 2), Triple("vitaminB2", "mg", 2), Triple("vitaminB3", "mg", 1),
    Triple("vitaminB5", "mg", 1), Triple("vitaminB6", "mg", 2), Triple("vitaminB7", "µg", 1), Triple("vitaminB9", "µg", 0),
    Triple("vitaminB12", "µg", 1),
)

val MEASURE_PARAMS: List<MeasureParamDef> = listOf(
    measureParam("kcalIntake", MeasureGroup.Food, MeasureKind.Food, "kcal", "kcal"),
    measureParam("kcalRemaining", MeasureGroup.Food, MeasureKind.Remaining, null, "kcal"),
    measureParam("protein", MeasureGroup.Food, MeasureKind.Food, "protein", "g"),
    measureParam("carbs", MeasureGroup.Food, MeasureKind.Food, "carbs", "g"),
    measureParam("fat", MeasureGroup.Food, MeasureKind.Food, "fat", "g"),
) + MEASURE_NUTRIENT_DEFS.map { (key, unit, digits) ->
    MeasureParamDef("nutrient:$key", "addProduct.nutrient.$key", MeasureGroup.Food, MeasureKind.Food, key, unit, digits)
} + listOf(
    measureParam("kcalBurned", MeasureGroup.Activity, MeasureKind.Sum, "ACTIVE_ENERGY_KCAL", "kcal"),
    measureParam("restingEnergy", MeasureGroup.Activity, MeasureKind.Sum, "RESTING_ENERGY_KCAL", "kcal"),
    measureParam("steps", MeasureGroup.Activity, MeasureKind.Sum, "STEPS", ""),
    measureParam("distance", MeasureGroup.Activity, MeasureKind.Sum, "DISTANCE_KM", "km", 1),
    measureParam("water", MeasureGroup.Activity, MeasureKind.Sum, "WATER_ML", "l", 1, 1000.0),
    measureParam("exerciseMinutes", MeasureGroup.Activity, MeasureKind.Sum, "EXERCISE_MINUTES", "min"),
    measureParam("standMinutes", MeasureGroup.Activity, MeasureKind.Sum, "STAND_MINUTES", "min"),
    measureParam("floors", MeasureGroup.Activity, MeasureKind.Sum, "FLOORS_CLIMBED", ""),
    measureParam("zoneMinutes", MeasureGroup.Activity, MeasureKind.Sum, "ACTIVE_ZONE_MINUTES", "min"),
    measureParam("cardioLoad", MeasureGroup.Activity, MeasureKind.Sum, "CARDIO_LOAD", "", 1),
    measureParam("sleepDuration", MeasureGroup.Sleep, MeasureKind.Sum, "SLEEP_MINUTES", "t", 1, 60.0),
    measureParam("sleepInBed", MeasureGroup.Sleep, MeasureKind.Sum, "SLEEP_IN_BED_MINUTES", "t", 1, 60.0),
    measureParam("sleepAwake", MeasureGroup.Sleep, MeasureKind.Sum, "SLEEP_AWAKE_MINUTES", "min"),
    measureParam("sleepRem", MeasureGroup.Sleep, MeasureKind.Sum, "SLEEP_REM_MINUTES", "min"),
    measureParam("sleepLight", MeasureGroup.Sleep, MeasureKind.Sum, "SLEEP_LIGHT_MINUTES", "min"),
    measureParam("sleepDeep", MeasureGroup.Sleep, MeasureKind.Sum, "SLEEP_DEEP_MINUTES", "min"),
    measureParam("sleepScore", MeasureGroup.Sleep, MeasureKind.Avg, "SLEEP_SCORE", ""),
    measureParam("sleepEfficiency", MeasureGroup.Sleep, MeasureKind.Avg, "SLEEP_EFFICIENCY_PERCENT", "%", 1),
    measureParam("sleepAwakenings", MeasureGroup.Sleep, MeasureKind.Avg, "SLEEP_AWAKENINGS", ""),
    measureParam("heartRate", MeasureGroup.Heart, MeasureKind.Avg, "HEART_RATE_BPM", "bpm"),
    measureParam("restingHeartRate", MeasureGroup.Heart, MeasureKind.Avg, "RESTING_HEART_RATE_BPM", "bpm"),
    measureParam("heartRateMin", MeasureGroup.Heart, MeasureKind.Avg, "HEART_RATE_MIN_BPM", "bpm"),
    measureParam("heartRateMax", MeasureGroup.Heart, MeasureKind.Avg, "HEART_RATE_MAX_BPM", "bpm"),
    measureParam("hrv", MeasureGroup.Heart, MeasureKind.Avg, "HEART_RATE_VARIABILITY_MS", "ms", 1),
    measureParam("vo2Max", MeasureGroup.Heart, MeasureKind.Avg, "VO2_MAX", "", 1),
    measureParam("heartRateRecovery", MeasureGroup.Heart, MeasureKind.Avg, "HEART_RATE_RECOVERY_BPM", "bpm"),
    measureParam("respiratoryRate", MeasureGroup.Heart, MeasureKind.Avg, "RESPIRATORY_RATE_BPM", "/min", 1),
    measureParam("spo2", MeasureGroup.Heart, MeasureKind.Avg, "OXYGEN_SATURATION_PERCENT", "%", 1),
    measureParam("temperature", MeasureGroup.Heart, MeasureKind.Avg, "TEMPERATURE_C", "°C", 1),
    measureParam("stress", MeasureGroup.Heart, MeasureKind.Avg, "STRESS_SCORE", ""),
    measureParam("recoveryScore", MeasureGroup.Heart, MeasureKind.Avg, "RECOVERY_SCORE", "%"),
    measureParam("strain", MeasureGroup.Heart, MeasureKind.Avg, "STRAIN_SCORE", "", 1),
    measureParam("bloodGlucose", MeasureGroup.Heart, MeasureKind.Avg, "BLOOD_GLUCOSE_MMOL_L", "mmol/l", 1),
    measureParam("bodyFat", MeasureGroup.Body, MeasureKind.Latest, "BODY_FAT_PERCENT", "%", 1),
    measureParam("fatMass", MeasureGroup.Body, MeasureKind.Latest, "FAT_MASS_KG", "kg", 1),
    measureParam("fatFreeMass", MeasureGroup.Body, MeasureKind.Latest, "FAT_FREE_MASS_KG", "kg", 1),
    measureParam("muscleMass", MeasureGroup.Body, MeasureKind.Latest, "MUSCLE_MASS_KG", "kg", 1),
    measureParam("boneMass", MeasureGroup.Body, MeasureKind.Latest, "BONE_MASS_KG", "kg", 1),
    measureParam("bodyWater", MeasureGroup.Body, MeasureKind.Latest, "BODY_WATER_PERCENT", "%", 1),
    measureParam("visceralFat", MeasureGroup.Body, MeasureKind.Latest, "VISCERAL_FAT_INDEX", "", 1),
    measureParam("bmr", MeasureGroup.Body, MeasureKind.Latest, "BASAL_METABOLIC_RATE_KCAL", "kcal"),
    measureParam("bmi", MeasureGroup.Body, MeasureKind.Latest, "BMI", "", 1),
)

val MEASURE_PARAM_BY_KEY: Map<String, MeasureParamDef> = MEASURE_PARAMS.associateBy { it.key }

val MEASURE_PERIOD_KEYS = listOf(
    "today", "yesterday", "last7", "last30", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "thisYear", "lastYear",
)

/** [start, end) in local dates. */
fun measurePeriodRange(key: String, today: LocalDate): Pair<LocalDate, LocalDate> {
    val tomorrow = today.plus(DatePeriod(days = 1))
    val weekStart = today.minus(DatePeriod(days = today.dayOfWeek.isoDayNumber - DayOfWeek.MONDAY.isoDayNumber))
    val monthStart = LocalDate(today.year, today.monthNumber, 1)
    val yearStart = LocalDate(today.year, 1, 1)
    return when (key) {
        "yesterday" -> today.minus(DatePeriod(days = 1)) to today
        "last7" -> today.minus(DatePeriod(days = 6)) to tomorrow
        "last30" -> today.minus(DatePeriod(days = 29)) to tomorrow
        "thisWeek" -> weekStart to weekStart.plus(DatePeriod(days = 7))
        "lastWeek" -> weekStart.minus(DatePeriod(days = 7)) to weekStart
        "thisMonth" -> monthStart to monthStart.plus(DatePeriod(months = 1))
        "lastMonth" -> monthStart.minus(DatePeriod(months = 1)) to monthStart
        "thisYear" -> yearStart to yearStart.plus(DatePeriod(years = 1))
        "lastYear" -> yearStart.minus(DatePeriod(years = 1)) to yearStart
        else -> today to tomorrow
    }
}

@Serializable
data class CustomMeasurement(
    val id: String,
    val name: String,
    val description: String = "",
    val param: String,
    val period: String,
    val text: String = "",
)

class MeasureDay(
    val date: LocalDate,
    val kcal: Double,
    val protein: Double,
    val carbs: Double,
    val fat: Double,
    val nutrients: Map<String, Double>,
)

class MeasureMetric(val type: String, val value: Double, val date: LocalDate, val recordedAt: String)

/** Value and unit, or "—" without data. Periods over one day give a daily average. */
fun computeMeasurement(measurement: CustomMeasurement, days: List<MeasureDay>, metrics: List<MeasureMetric>, goalKcal: Double, today: LocalDate): Pair<String, String> {
    val def = MEASURE_PARAM_BY_KEY[measurement.param] ?: return "—" to ""
    val (start, end) = measurePeriodRange(measurement.period, today)
    val tomorrow = today.plus(DatePeriod(days = 1))
    val last = if (end < tomorrow) end else tomorrow
    val elapsedDays = max(1, start.daysUntil(last))
    fun out(raw: Double?) = if (raw == null) "—" to "" else daNumber(raw / def.divisor, def.digits) to def.unit
    fun inRange(date: LocalDate) = date >= start && date < end

    if (def.kind == MeasureKind.Food || def.kind == MeasureKind.Remaining) {
        val intake = days.filter { inRange(it.date) }.sumOf { day ->
            when {
                def.kind == MeasureKind.Remaining || def.source == "kcal" -> day.kcal
                def.source == "protein" -> day.protein
                def.source == "carbs" -> day.carbs
                def.source == "fat" -> day.fat
                else -> day.nutrients[def.source ?: ""] ?: 0.0
            }
        }
        val total = if (def.kind == MeasureKind.Remaining) max(0.0, goalKcal * elapsedDays - intake) else intake
        return out(total / elapsedDays)
    }

    val rows = metrics.filter { it.type == def.source && inRange(it.date) }
    if (rows.isEmpty()) return out(null)
    return when (def.kind) {
        MeasureKind.Sum -> out(rows.sumOf { it.value } / elapsedDays)
        MeasureKind.Avg -> out(rows.sumOf { it.value } / rows.size)
        else -> out(rows.maxBy { it.recordedAt }.value)
    }
}

fun newMeasurementId(): String = "m" + FoodTime.now().toEpochMilliseconds().toString(36) + (0..9999).random().toString(36)

/** Per-device list of the user's own measurements (same key as the web). */
object CustomMeasurePrefs {
    private const val KEY = "hellocal.frontpage.customMeasurements"
    private val serializer = ListSerializer(CustomMeasurement.serializer())

    private fun load(): List<CustomMeasurement> {
        val raw = runCatching { NativeHooks.secureStorage.get(KEY) }.getOrNull() ?: return emptyList()
        return runCatching { ApiJson.decodeFromString(serializer, raw) }.getOrNull().orEmpty()
            .filter { it.param in MEASURE_PARAM_BY_KEY && it.period in MEASURE_PERIOD_KEYS }
            .map { it.copy(text = clampMeasureText(it.text)) }
    }

    var measurements by mutableStateOf(load())
        private set

    fun save(list: List<CustomMeasurement>) {
        measurements = list
        runCatching { NativeHooks.secureStorage.set(KEY, ApiJson.encodeToString(serializer, list)) }
    }
}
