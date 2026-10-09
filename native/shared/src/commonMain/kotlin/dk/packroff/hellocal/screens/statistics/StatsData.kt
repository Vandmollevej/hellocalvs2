package dk.packroff.hellocal.screens.statistics

import dk.packroff.hellocal.api.Api
import kotlinx.datetime.Clock
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlin.coroutines.cancellation.CancellationException

// Data the statistics module reads from the same /api routes as the web
// (src/app/statistics/**, src/app/profile/status). Fields are read straight
// from the JSON so a single odd value never breaks a whole list.

// ---------- JSON helpers ----------

internal fun JsonElement?.asObject(): JsonObject? = this as? JsonObject

internal fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

internal fun JsonObject.number(key: String): Double? =
    (this[key] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull?.takeIf { it.isFinite() }

internal fun JsonObject.flag(key: String): Boolean? = (this[key] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull

internal fun JsonObject.objects(key: String): List<JsonObject> =
    (this[key] as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()

/** A JSON object of numbers (e.g. nutrientSnapshot) — null when the field is missing/null. */
internal fun JsonObject.numberMap(key: String): Map<String, Double>? {
    val obj = this[key] as? JsonObject ?: return null
    return obj.entries.mapNotNull { (k, v) ->
        (v as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull?.takeIf { it.isFinite() }?.let { k to it }
    }.toMap()
}

internal fun parseMillis(value: String?): Long? =
    value?.let { runCatching { Instant.parse(it).toEpochMilliseconds() }.getOrNull() }

/** Runs [block]; any failure except cancellation becomes null (the web's `.catch(() => …)`). */
internal suspend fun <T> attempt(block: suspend () -> T): T? = try {
    block()
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    null
}

// ---------- Dates (the phone's own time zone, like the browser) ----------

internal val statsTimeZone: TimeZone get() = TimeZone.currentSystemDefault()

internal fun nowMillis(): Long = Clock.System.now().toEpochMilliseconds()

internal fun todayLocal(): LocalDate = Clock.System.now().toLocalDateTime(statsTimeZone).date

internal fun localDateTimeOf(millis: Long): LocalDateTime = Instant.fromEpochMilliseconds(millis).toLocalDateTime(statsTimeZone)

internal fun LocalDate.startMillis(): Long = atStartOfDayIn(statsTimeZone).toEpochMilliseconds()

internal fun LocalDate.plusDays(days: Int): LocalDate = plus(days, DateTimeUnit.DAY)

internal fun LocalDate.plusMonths(months: Int): LocalDate = plus(months, DateTimeUnit.MONTH)

/** "YYYY-MM-DD" (src/lib/sleep-quality.ts localDateKey). */
internal fun LocalDate.isoKey(): String =
    "$year-${monthNumber.toString().padStart(2, '0')}-${dayOfMonth.toString().padStart(2, '0')}"

/** Minutes after local midnight. */
internal fun LocalDateTime.minutesOfDay(): Int = hour * 60 + minute

/** [start, end) as calendar days in the phone's time zone. */
internal data class DayRange(val start: LocalDate, val end: LocalDate) {
    val startMillis: Long get() = start.startMillis()
    val endMillis: Long get() = end.startMillis()
    fun contains(millis: Long): Boolean = millis >= startMillis && millis < endMillis
}

// ---------- Models ----------

internal data class MeatShare(val type: String, val share: Double)

/** src/lib/food-classification.ts FoodClassification (computed by the server). */
internal data class FoodClassification(
    val productType: String?,
    val meat: List<MeatShare>,
    val isAlcohol: Boolean,
    val alcoholPercent: Double?,
    val isSugaryDrink: Boolean,
    val sugarPer100g: Double?,
)

/** One registration from GET /api/registrations (RegistrationTotals + SourceRegistration). */
internal class StatRegistration(
    val id: String?,
    val productId: String?,
    val dishId: String?,
    val genericIngredientId: String?,
    val title: String,
    val kcal: Double,
    val protein: Double,
    val carbs: Double,
    val fat: Double?,
    /** The older single *Snapshot fields that are set (sugar, fiber, …). */
    val legacy: Map<String, Double>,
    val nutrientSnapshot: Map<String, Double>?,
    val nutrientEstimated: Map<String, Double>,
    val nutrientTolerance: Map<String, Double>,
    val sugarSnapshot: Double?,
    val amountGrams: Double?,
    val createdAtMillis: Long,
    val createdAt: LocalDateTime,
    val imageUrl: String?,
    val classification: FoodClassification?,
)

/** ActivityTotals (src/lib/stat-cards.ts). */
internal class StatActivity(
    val sportType: String,
    val durationMinutes: Double,
    val caloriesBurned: Double,
    val startedAtMillis: Long,
    val startedAt: LocalDateTime,
)

/** HealthMetricTotals (src/lib/stat-cards.ts). */
internal class StatMetric(val type: String, val value: Double, val recordedAtMillis: Long, val recordedAt: LocalDateTime)

/** The parts of IntegrationCardStatus (src/lib/integrations.ts) the statistics pages read. */
internal class StatIntegration(
    val provider: String,
    val label: String,
    val icon: String?,
    val kind: String,
    val description: String,
    val connectable: Boolean,
    val legacy: Boolean,
    val pageSlug: String,
    val status: String,
    val readsBodyFat: Boolean,
)

internal data class SleepRating(val date: LocalDate, val rating: Int)

internal data class BudgetSnapshot(val date: String, val budgetKcal: Double)

internal class WeightEntry(val id: String?, val weightKg: Double, val weighedAtMillis: Long, val weighedAtIso: String, val timeOfDay: String)

/** One BodyMeasurement row: field ("waistCm") → value. */
internal class BodyEntry(val measuredAtMillis: Long, val measuredAtIso: String, val values: Map<String, Double>)

internal class StatusGoal(val createdAtMillis: Long, val targets: List<Pair<String, Double>>)

private val LEGACY_SNAPSHOT_FIELDS = listOf(
    "sugar" to "sugarSnapshot",
    "fiber" to "fiberSnapshot",
    "salt" to "saltSnapshot",
    "potassium" to "potassiumSnapshot",
    "calcium" to "calciumSnapshot",
    "iron" to "ironSnapshot",
    "saturatedFat" to "saturatedFatSnapshot",
    "unsaturatedFat" to "unsaturatedFatSnapshot",
    "transFat" to "transFatSnapshot",
    "cholesterol" to "cholesterolSnapshot",
    "vitaminA" to "vitaminASnapshot",
    "vitaminC" to "vitaminCSnapshot",
)

internal val LEGACY_NUTRIENT_KEYS: List<String> = LEGACY_SNAPSHOT_FIELDS.map { it.first }

private fun parseClassification(obj: JsonObject?): FoodClassification? {
    if (obj == null) return null
    return FoodClassification(
        productType = obj.string("productType"),
        meat = obj.objects("meat").mapNotNull { m ->
            val type = m.string("type") ?: return@mapNotNull null
            MeatShare(type, m.number("share") ?: 0.0)
        },
        isAlcohol = obj.flag("isAlcohol") == true,
        alcoholPercent = obj.number("alcoholPercent"),
        isSugaryDrink = obj.flag("isSugaryDrink") == true,
        sugarPer100g = obj.number("sugarPer100g"),
    )
}

internal fun parseRegistrations(json: JsonElement): List<StatRegistration> =
    json.asObject()?.objects("registrations").orEmpty().mapNotNull { r ->
        val millis = parseMillis(r.string("createdAt")) ?: return@mapNotNull null
        StatRegistration(
            id = r.string("id"),
            productId = r.string("productId"),
            dishId = r.string("dishId"),
            genericIngredientId = r.string("genericIngredientId"),
            title = r.string("titleSnapshot") ?: "",
            kcal = r.number("kcalSnapshot") ?: 0.0,
            protein = r.number("proteinSnapshot") ?: 0.0,
            carbs = r.number("carbsSnapshot") ?: 0.0,
            fat = r.number("fatSnapshot"),
            legacy = LEGACY_SNAPSHOT_FIELDS.mapNotNull { (key, field) -> r.number(field)?.let { key to it } }.toMap(),
            nutrientSnapshot = r.numberMap("nutrientSnapshot"),
            nutrientEstimated = r.numberMap("nutrientEstimatedSnapshot") ?: emptyMap(),
            nutrientTolerance = r.numberMap("nutrientToleranceSnapshot") ?: emptyMap(),
            sugarSnapshot = r.number("sugarSnapshot"),
            amountGrams = r.number("amountGrams"),
            createdAtMillis = millis,
            createdAt = localDateTimeOf(millis),
            imageUrl = r["product"].asObject()?.string("imageUrl"),
            classification = parseClassification(r["classification"].asObject()),
        )
    }

internal fun parseActivities(json: JsonElement): List<StatActivity> =
    json.asObject()?.objects("activities").orEmpty().mapNotNull { a ->
        val millis = parseMillis(a.string("startedAt")) ?: return@mapNotNull null
        StatActivity(
            sportType = a.string("sportType") ?: "other",
            durationMinutes = a.number("durationMinutes") ?: 0.0,
            caloriesBurned = a.number("caloriesBurned") ?: 0.0,
            startedAtMillis = millis,
            startedAt = localDateTimeOf(millis),
        )
    }

internal fun parseMetrics(json: JsonElement): List<StatMetric> =
    json.asObject()?.objects("metrics").orEmpty().mapNotNull { m ->
        val millis = parseMillis(m.string("recordedAt")) ?: return@mapNotNull null
        StatMetric(m.string("type") ?: return@mapNotNull null, m.number("value") ?: return@mapNotNull null, millis, localDateTimeOf(millis))
    }

internal fun parseIntegrations(json: JsonElement): List<StatIntegration> =
    json.asObject()?.objects("integrations").orEmpty().map { i ->
        StatIntegration(
            provider = i.string("provider") ?: "",
            label = i.string("label") ?: "",
            icon = i.string("icon"),
            kind = i.string("kind") ?: "",
            description = i.string("description") ?: "",
            connectable = i.flag("connectable") == true,
            legacy = i.flag("legacy") == true,
            pageSlug = i.string("pageSlug") ?: "",
            status = i.string("status") ?: "DISCONNECTED",
            readsBodyFat = i["settings"].asObject()?.get("read").asObject()?.flag("bodyFat") == true,
        )
    }

internal suspend fun loadRegistrations(): List<StatRegistration> = parseRegistrations(Api.get("/api/registrations"))
internal suspend fun loadActivities(): List<StatActivity> = parseActivities(Api.get("/api/activities"))
internal suspend fun loadMetrics(): List<StatMetric> = parseMetrics(Api.get("/api/health-metrics"))
internal suspend fun loadIntegrations(): List<StatIntegration> = parseIntegrations(Api.get("/api/integrations"))
internal suspend fun loadProfileUser(): JsonObject = Api.get("/api/profile").asObject()?.get("user").asObject() ?: JsonObject(emptyMap())

/** GET /api/sleep-quality?from=&to= (src/lib/sleep-quality.ts fetchSleepQuality). */
internal suspend fun loadSleepQuality(from: LocalDate, to: LocalDate): List<SleepRating> =
    Api.get("/api/sleep-quality?from=${from.isoKey()}&to=${to.isoKey()}").asObject()?.objects("entries").orEmpty().mapNotNull { e ->
        val date = e.string("date")?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return@mapNotNull null
        SleepRating(date, (e.number("rating") ?: return@mapNotNull null).toInt())
    }

internal suspend fun loadDailyBudgets(): List<BudgetSnapshot> =
    Api.get("/api/daily-budgets").asObject()?.objects("snapshots").orEmpty().mapNotNull { s ->
        BudgetSnapshot(s.string("date") ?: return@mapNotNull null, s.number("budgetKcal") ?: return@mapNotNull null)
    }

internal suspend fun loadWeightEntries(): List<WeightEntry> =
    Api.get("/api/weight-entries").asObject()?.objects("entries").orEmpty().mapNotNull { e ->
        val iso = e.string("weighedAt") ?: return@mapNotNull null
        val millis = parseMillis(iso) ?: return@mapNotNull null
        WeightEntry(e.string("id"), e.number("weightKg") ?: return@mapNotNull null, millis, iso, e.string("timeOfDay") ?: "UNKNOWN")
    }

internal suspend fun loadBodyEntries(): List<BodyEntry> =
    Api.get("/api/body-measurements").asObject()?.objects("entries").orEmpty().mapNotNull { e ->
        val iso = e.string("measuredAt") ?: return@mapNotNull null
        val millis = parseMillis(iso) ?: return@mapNotNull null
        BodyEntry(millis, iso, BODY_MEASUREMENT_FIELDS.mapNotNull { f -> e.number(f.field)?.let { f.field to it } }.toMap())
    }

internal suspend fun loadGoals(): List<StatusGoal> =
    Api.get("/api/goals").asObject()?.objects("goals").orEmpty().map { g ->
        StatusGoal(
            parseMillis(g.string("createdAt")) ?: 0L,
            g.objects("targets").mapNotNull { t -> (t.string("type") ?: return@mapNotNull null) to (t.number("value") ?: return@mapNotNull null) },
        )
    }

// ---------- Body measurements (src/lib/body-measurements.ts) ----------

internal class BodyMeasurementDef(val field: String, val nameKey: String, val image: String?)

internal val BODY_MEASUREMENT_FIELDS = listOf(
    BodyMeasurementDef("chestCm", "bodyMeasurements.names.chest", "chest"),
    BodyMeasurementDef("waistCm", "bodyMeasurements.names.waist", "waist"),
    BodyMeasurementDef("hipCm", "bodyMeasurements.names.hip", null),
    BodyMeasurementDef("upperArmCm", "bodyMeasurements.names.upperArm", "arm"),
    BodyMeasurementDef("thighCm", "bodyMeasurements.names.thigh", "leg"),
)

/** The drawing for a measurement by the profile's sex (FEMALE when unknown). */
internal fun bodyMeasurementImage(def: BodyMeasurementDef, sex: String?): String? =
    def.image?.let { "/body-measurements/${if (sex == "MALE") "male" else "female"}-$it.png" }
