package dk.packroff.hellocal.screens.calendar

import kotlin.math.floor
import kotlinx.datetime.Clock
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.offsetAt
import kotlinx.datetime.plus
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull

// Data used by the calendar (src/app/calendar/page.tsx). The API rows are read
// leniently from JSON and turned into these small domain types once, with the
// timestamps already converted to the phone's local time (the web does
// `new Date(createdAt)` everywhere, i.e. local time).

internal data class CalRegistration(
    val id: String,
    val title: String,
    val kcal: Double,
    val protein: Double,
    val amountGrams: Double?,
    val at: LocalDateTime,
    val imageUrl: String?,
    val isDrink: Boolean,
)

internal data class CalActivity(
    val id: String,
    val sportType: String,
    val at: LocalDateTime,
    val durationMinutes: Double,
    val caloriesBurned: Double,
)

/** Water from /water/create (own table, no calories). */
internal data class CalWater(val id: String, val amountMl: Double, val at: LocalDateTime)

internal data class CalWeighIn(
    val id: String,
    val weightKg: Double,
    val at: LocalDateTime,
    val epochMs: Long,
    val source: String?,
)

internal data class CalMetric(
    val id: String?,
    val type: String,
    val source: String?,
    val value: Double,
    val recordedAt: String,
    val at: LocalDateTime,
    val epochMs: Long,
)

internal data class CalBudget(val date: LocalDate, val budgetKcal: Double)

internal data class CalGoalTarget(val id: String, val type: String, val value: Double, val unit: String, val completed: Boolean)

internal data class CalGoal(val id: String, val targetDate: LocalDate?, val targets: List<CalGoalTarget>)

internal data class SleepDefaults(val defaultBedtime: String?, val defaultWakeTime: String?)

internal data class SleepScheduleEntry(val weekday: Int, val bedtime: String?, val wakeTime: String?)

internal data class WorkShiftEntry(val date: LocalDate, val bedtime: String?, val wakeTime: String?)

/** src/lib/weekly-energy-summary.ts EnergyProfile. */
internal data class EnergyProfile(
    val weightKg: Double?,
    val heightCm: Double?,
    val age: Int?,
    val sex: String?,
    val activityLevel: String?,
    val palBase: Double?,
    val trainingAllowanceKcal: Double?,
)

// ---------- JSON helpers ----------

internal fun JsonElement?.asObj(): JsonObject? = this as? JsonObject

internal fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull

internal fun JsonObject.dbl(key: String): Double? = (this[key] as? JsonPrimitive)?.let { if (it.isString) it.content.toDoubleOrNull() else it.doubleOrNull }

internal fun JsonObject.bool(key: String): Boolean? = (this[key] as? JsonPrimitive)?.booleanOrNull

internal fun JsonObject.objects(key: String): List<JsonObject> = (this[key] as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()

// ---------- Time helpers ----------

internal val calTz: TimeZone get() = TimeZone.currentSystemDefault()

internal fun nowLocal(): LocalDateTime = Clock.System.now().toLocalDateTime(calTz)

internal fun parseInstant(value: String?): Instant? = value?.let { runCatching { Instant.parse(it) }.getOrNull() }

/** ISO timestamp → local time; a bare "YYYY-MM-DD" → local midnight. */
internal fun parseLocal(value: String?): LocalDateTime? =
    parseInstant(value)?.toLocalDateTime(calTz)
        ?: value?.let { runCatching { LocalDate.parse(it.take(10)).at(0, 0) }.getOrNull() }

/** The local date-time at [hour]:[minute]. */
internal fun LocalDate.at(hour: Int, minute: Int): LocalDateTime = LocalDateTime(year, monthNumber, dayOfMonth, hour, minute)

internal fun LocalDateTime.epochMs(): Long = toInstant(calTz).toEpochMilliseconds()

internal fun LocalDate.startMs(): Long = atStartOfDayIn(calTz).toEpochMilliseconds()

internal fun LocalDate.plusDays(days: Int): LocalDate = plus(days, DateTimeUnit.DAY)

internal fun LocalDate.plusMonths(months: Int): LocalDate = plus(months, DateTimeUnit.MONTH)

/** Minutes east of UTC, like clientTzOffsetMinutesEast() in src/lib/daily-budget.ts. */
internal fun tzOffsetMinutesEast(): Int = calTz.offsetAt(Clock.System.now()).totalSeconds / 60

/** JavaScript Math.round (halves round up). */
internal fun jsRound(value: Double): Long = floor(value + 0.5).toLong()

internal fun pad2(value: Int): String = value.toString().padStart(2, '0')

internal fun minutesFromMidnight(time: LocalDateTime): Int = time.hour * 60 + time.minute

// ---------- Parsing the API rows ----------

/** GET /api/registrations → { registrations: [...] } */
internal fun parseRegistrations(root: JsonElement): List<CalRegistration> =
    (root.asObj()?.objects("registrations") ?: emptyList()).mapNotNull { row ->
        val id = row.str("id") ?: return@mapNotNull null
        val at = parseLocal(row.str("createdAt")) ?: return@mapNotNull null
        CalRegistration(
            id = id,
            title = row.str("titleSnapshot") ?: "",
            kcal = row.dbl("kcalSnapshot") ?: 0.0,
            protein = row.dbl("proteinSnapshot") ?: 0.0,
            amountGrams = row.dbl("amountGrams"),
            at = at,
            imageUrl = row["product"].asObj()?.str("imageUrl"),
            isDrink = row["classification"].asObj()?.bool("isDrink") ?: false,
        )
    }

/** GET /api/activities → { activities: [...] } */
internal fun parseActivities(root: JsonElement): List<CalActivity> =
    (root.asObj()?.objects("activities") ?: emptyList()).mapNotNull { row ->
        CalActivity(
            id = row.str("id") ?: return@mapNotNull null,
            sportType = row.str("sportType") ?: "other",
            at = parseLocal(row.str("startedAt")) ?: return@mapNotNull null,
            durationMinutes = row.dbl("durationMinutes") ?: 0.0,
            caloriesBurned = row.dbl("caloriesBurned") ?: 0.0,
        )
    }

/** GET /api/water-entries → { entries: [...] } */
internal fun parseWater(root: JsonElement): List<CalWater> =
    (root.asObj()?.objects("entries") ?: emptyList()).mapNotNull { row ->
        CalWater(
            id = row.str("id") ?: return@mapNotNull null,
            amountMl = row.dbl("amountMl") ?: 0.0,
            at = parseLocal(row.str("loggedAt")) ?: return@mapNotNull null,
        )
    }

/** GET /api/weight-entries → { entries: [...] } */
internal fun parseWeighIns(root: JsonElement): List<CalWeighIn> =
    (root.asObj()?.objects("entries") ?: emptyList()).mapNotNull { row ->
        val instant = parseInstant(row.str("weighedAt")) ?: return@mapNotNull null
        CalWeighIn(
            id = row.str("id") ?: return@mapNotNull null,
            weightKg = row.dbl("weightKg") ?: return@mapNotNull null,
            at = instant.toLocalDateTime(calTz),
            epochMs = instant.toEpochMilliseconds(),
            source = row.str("source"),
        )
    }

/** GET /api/health-metrics → { metrics: [...] } */
internal fun parseMetrics(root: JsonElement): List<CalMetric> =
    (root.asObj()?.objects("metrics") ?: emptyList()).mapNotNull { row ->
        val recordedAt = row.str("recordedAt") ?: return@mapNotNull null
        val instant = parseInstant(recordedAt) ?: return@mapNotNull null
        CalMetric(
            id = row.str("id"),
            type = row.str("type") ?: return@mapNotNull null,
            source = row.str("source"),
            value = row.dbl("value") ?: return@mapNotNull null,
            recordedAt = recordedAt,
            at = instant.toLocalDateTime(calTz),
            epochMs = instant.toEpochMilliseconds(),
        )
    }

/** GET /api/daily-budgets → { snapshots: [{ date, budgetKcal }] } */
internal fun parseBudgets(root: JsonElement): List<CalBudget> =
    (root.asObj()?.objects("snapshots") ?: emptyList()).mapNotNull { row ->
        val date = row.str("date")?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() } ?: return@mapNotNull null
        CalBudget(date, row.dbl("budgetKcal") ?: return@mapNotNull null)
    }

/** GET /api/goals → { goals: GoalDTO[] } */
internal fun parseGoals(root: JsonElement): List<CalGoal> =
    (root.asObj()?.objects("goals") ?: emptyList()).mapNotNull { row ->
        CalGoal(
            id = row.str("id") ?: return@mapNotNull null,
            targetDate = row.str("targetDate")?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() },
            targets = row.objects("targets").mapNotNull { target ->
                CalGoalTarget(
                    id = target.str("id") ?: return@mapNotNull null,
                    type = target.str("type") ?: return@mapNotNull null,
                    value = target.dbl("value") ?: 0.0,
                    unit = target.str("unit") ?: "",
                    completed = target.str("completedAt") != null,
                )
            },
        )
    }

/** src/lib/age.ts computeAge. */
internal fun computeAge(birthDate: String?, today: LocalDate): Int? {
    val birth = parseLocal(birthDate)?.date ?: return null
    var age = today.year - birth.year
    val hadBirthday = today.monthNumber > birth.monthNumber ||
        (today.monthNumber == birth.monthNumber && today.dayOfMonth >= birth.dayOfMonth)
    if (!hadBirthday) age -= 1
    return if (age >= 0) age else null
}

/** GET /api/profile → { user } — sleep defaults and the energy profile. */
internal fun parseProfile(root: JsonElement, today: LocalDate): Pair<SleepDefaults?, EnergyProfile?> {
    val user = root.asObj()?.get("user").asObj() ?: return null to null
    val defaults = SleepDefaults(user.str("defaultBedtime"), user.str("defaultWakeTime"))
    val profile = EnergyProfile(
        weightKg = user.dbl("weightKg"),
        heightCm = user.dbl("heightCm"),
        age = computeAge(user.str("birthDate"), today),
        sex = user.str("sex"),
        activityLevel = user.str("activityLevel"),
        palBase = user.dbl("palBase"),
        trainingAllowanceKcal = user.dbl("trainingAllowanceKcal"),
    )
    return defaults to profile
}

/** GET /api/sleep-schedule → { schedules: [{ weekday, bedtime, wakeTime }] } (weekday 0 = Monday). */
internal fun parseSchedules(root: JsonElement): Map<Int, SleepScheduleEntry> =
    (root.asObj()?.objects("schedules") ?: emptyList()).mapNotNull { row ->
        val weekday = row.dbl("weekday")?.toInt() ?: return@mapNotNull null
        weekday to SleepScheduleEntry(weekday, row.str("bedtime"), row.str("wakeTime"))
    }.toMap()

/** GET /api/work-shifts → { shifts: [{ date, bedtime, wakeTime }] } keyed by local date. */
internal fun parseShifts(root: JsonElement): Map<LocalDate, WorkShiftEntry> =
    (root.asObj()?.objects("shifts") ?: emptyList()).mapNotNull { row ->
        val date = parseLocal(row.str("date"))?.date ?: return@mapNotNull null
        date to WorkShiftEntry(date, row.str("bedtime"), row.str("wakeTime"))
    }.toMap()

// ---------- Danish date texts (the web hard-codes da-DK for these) ----------

internal val DA_MONTHS = listOf(
    "januar", "februar", "marts", "april", "maj", "juni",
    "juli", "august", "september", "oktober", "november", "december",
)
internal val DA_MONTHS_SHORT = listOf("jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec.")
internal val DA_WEEKDAYS = listOf("mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag")
internal val DA_WEEKDAYS_SHORT = listOf("man.", "tirs.", "ons.", "tors.", "fre.", "lør.", "søn.")

internal fun weekdayIndex(date: LocalDate): Int = date.dayOfWeek.isoDayNumber - 1

/** toLocaleDateString("da-DK", { month: "long", year: "numeric" }) → "oktober 2026" */
internal fun monthYearLabel(date: LocalDate): String = "${DA_MONTHS[date.monthNumber - 1]} ${date.year}"

/** { day: "numeric", month: "short" } → "5. okt." */
internal fun dayMonthShort(date: LocalDate): String = "${date.dayOfMonth}. ${DA_MONTHS_SHORT[date.monthNumber - 1]}"

/** { dateStyle: "long" } → "8. oktober 2026" */
internal fun longDate(date: LocalDate): String = "${date.dayOfMonth}. ${DA_MONTHS[date.monthNumber - 1]} ${date.year}"

/** { weekday: "long", day: "numeric", month: "long" } → "torsdag den 8. oktober" */
internal fun dayTitle(date: LocalDate): String = "${DA_WEEKDAYS[weekdayIndex(date)]} den ${date.dayOfMonth}. ${DA_MONTHS[date.monthNumber - 1]}"

/** { weekday: "short" } → "man." */
internal fun weekdayShort(date: LocalDate): String = DA_WEEKDAYS_SHORT[weekdayIndex(date)]

/** Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }) → "07.30" */
internal fun clock(time: LocalDateTime): String = "${pad2(time.hour)}.${pad2(time.minute)}"

/** CSS text-transform: capitalize. */
internal fun capitalizeWords(text: String): String = text.split(" ").joinToString(" ") { word -> word.replaceFirstChar { it.uppercase() } }

internal fun capitalizeFirst(text: String): String = text.replaceFirstChar { it.uppercase() }
