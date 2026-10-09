package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.offsetAt
import kotlinx.datetime.toLocalDateTime
import kotlinx.datetime.todayIn
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/**
 * GET /api/profile → user. Only the fields the profile screens read; the
 * route returns the whole User row (minus secrets), unknown keys are ignored.
 */
@Serializable
data class ProfileUser(
    val id: String = "",
    val displayName: String = "",
    val email: String = "",
    val phone: String? = null,
    val region: String? = null,
    val weightKg: Double? = null,
    val startWeightUpdatedAt: String? = null,
    val createdAt: String? = null,
    val targetWeightKg: Double? = null,
    val heightCm: Double? = null,
    val birthDate: String? = null,
    val sex: String? = null,
    val activityLevel: String? = null,
    val goalMode: String? = null,
    val goalPaceKgPerWeek: Double? = null,
    val defaultBedtime: String? = null,
    val defaultWakeTime: String? = null,
    val shiftWorkEnabled: Boolean = false,
    val photoDiaryRequiresPasscode: Boolean = false,
    val wantsPushNotifications: Boolean = false,
    val wantsUpdateNewsEmails: Boolean = false,
    val wantsAdviceEmails: Boolean = false,
    val wantsPartnerOffersEmails: Boolean = false,
)

object ProfileApi {
    suspend fun loadUser(): ProfileUser =
        ApiJson.decodeFromJsonElement(ProfileUser.serializer(), Api.get("/api/profile").jsonObject["user"]!!)

    /** PATCH /api/profile — the web saves continuously, field by field. */
    suspend fun patch(body: Map<String, Any?>): JsonElement = Api.patch("/api/profile", body)

    /** The calculation (docs/ACTIVITY-PAL.md) with the phone's time zone (src/lib/daily-budget.ts activitySummaryUrl). */
    fun activitySummaryUrl(): String {
        val offsetMinutes = TimeZone.currentSystemDefault().offsetAt(Clock.System.now()).totalSeconds / 60
        return "/api/profile/activity?tz=$offsetMinutes"
    }

    suspend fun loadEnergySummary(): EnergySummary? {
        val summary = (Api.get(activitySummaryUrl()) as? JsonObject)?.get("summary") ?: return null
        return runCatching { ApiJson.decodeFromJsonElement(EnergySummary.serializer(), summary) }.getOrNull()
    }
}

/** Waits [delayMs] after the last call before running — the web's 500 ms save timeout. */
class ProfileDebouncer(private val scope: CoroutineScope, private val delayMs: Long = 500) {
    private var job: Job? = null

    fun run(block: suspend () -> Unit) {
        job?.cancel()
        job = scope.launch {
            delay(delayMs)
            runCatching { block() }
        }
    }
}

// ---------- EnergySummary (src/lib/activity-profile.ts) ----------

@Serializable
data class DailyEnergyEstimate(val kcal: Double = 0.0, val low: Double = 0.0, val high: Double = 0.0, val baselineKcal: Double = 0.0)

@Serializable
data class EnergyCalibration(
    val reason: String = "",
    val weight: Double = 0.0,
    val loggedDays: Int = 0,
    val averageIntakeKcal: Double? = null,
    val slopeKgPerWeek: Double? = null,
    val learnedKcal: Double? = null,
)

@Serializable
data class DailyBudget(
    val budgetKcal: Double = 0.0,
    val deltaKcal: Double = 0.0,
    val targetWeightKg: Double? = null,
    val weeksToTarget: Double? = null,
    val adjustments: List<String> = emptyList(),
)

@Serializable
data class EnergySummary(
    val bmr: Double? = null,
    val pal: Double? = null,
    val level: String? = null,
    val trainingAllowanceKcal: Double = 0.0,
    val daily: DailyEnergyEstimate? = null,
    val calibration: EnergyCalibration? = null,
    val needKcal: Double? = null,
    val budget: DailyBudget? = null,
    val missing: List<String> = emptyList(),
)

// ---------- Goals (src/lib/user-goals.ts GoalDTO) ----------

@Serializable
data class GoalTarget(val id: String, val type: String, val value: Double, val unit: String, val completedAt: String? = null)

@Serializable
data class Goal(val id: String, val createdAt: String, val targetDate: String? = null, val targets: List<GoalTarget> = emptyList())

// ---------- Weight entries (GET /api/weight-entries) ----------

@Serializable
data class WeightEntry(
    val id: String = "",
    val weightKg: Double,
    val clothed: Boolean = false,
    val shoes: String = "UNKNOWN",
    val toilet: String = "UNKNOWN",
    val meal: String = "UNKNOWN",
    val timeOfDay: String = "UNKNOWN",
    val note: String? = null,
    val weighedAt: String,
)

object ProfileWeights {
    suspend fun entries(): List<WeightEntry> {
        val list = (Api.get("/api/weight-entries") as? JsonObject)?.get("entries") ?: return emptyList()
        return ApiJson.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(WeightEntry.serializer()), list)
    }

    private const val MIN_TREND_SAMPLES = 5
    private const val SMOOTHING_ALPHA = 0.3
    private const val MEAL_PROXIMITY_MS = 2L * 60 * 60 * 1000
    private const val MEAL_ADJUSTMENT_KG = 0.4

    /**
     * src/lib/weight-trend.ts latestTrendWeight: separate smoothed averages for
     * morning and evening weigh-ins, minus a little when food was logged close
     * to the weigh-in. null until there are enough weigh-ins.
     */
    fun latestTrendWeight(entries: List<WeightEntry>, mealTimesMs: List<Long>): Double? {
        if (entries.size < MIN_TREND_SAMPLES) return null
        val sorted = entries.mapNotNull { entry -> ProfileDates.parseInstant(entry.weighedAt)?.let { entry to it.toEpochMilliseconds() } }.sortedBy { it.second }
        var morning: Double? = null
        var evening: Double? = null
        var other: Double? = null
        var trend: Double? = null
        fun ema(previous: Double?, value: Double) = if (previous == null) value else SMOOTHING_ALPHA * value + (1 - SMOOTHING_ALPHA) * previous
        for ((entry, at) in sorted) {
            val nearMeal = mealTimesMs.any { kotlin.math.abs(it - at) <= MEAL_PROXIMITY_MS }
            val adjusted = if (nearMeal) entry.weightKg - MEAL_ADJUSTMENT_KG else entry.weightKg
            when (entry.timeOfDay) {
                "MORNING" -> morning = ema(morning, adjusted)
                "EVENING" -> evening = ema(evening, adjusted)
                else -> other = ema(other, adjusted)
            }
            val active = listOfNotNull(morning, evening, other)
            trend = active.sum() / active.size
        }
        return trend
    }

    /** createdAt of every registration (GET /api/registrations) as epoch ms — the meals for the trend. */
    suspend fun mealTimes(): List<Long> {
        val list = (Api.get("/api/registrations") as? JsonObject)?.get("registrations") as? kotlinx.serialization.json.JsonArray ?: return emptyList()
        return list.mapNotNull { item ->
            val createdAt = (item as? JsonObject)?.get("createdAt")?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content }
            ProfileDates.parseInstant(createdAt)?.toEpochMilliseconds()
        }
    }
}

// ---------- Dates ----------

object ProfileDates {
    private val tz get() = TimeZone.currentSystemDefault()

    fun today(): LocalDate = Clock.System.todayIn(tz)

    /** Local "YYYY-MM-DD" for today (localTodayIso on the web). */
    fun todayIso(): String = today().toString()

    fun parseInstant(iso: String?): Instant? = iso?.let { runCatching { Instant.parse(it) }.getOrNull() }

    /** The calendar date part of "YYYY-MM-DD…" (birth dates, target dates). */
    fun parseDay(value: String?): LocalDate? {
        val match = Regex("^(\\d{4})-(\\d{2})-(\\d{2})").find(value ?: "") ?: return null
        return runCatching { LocalDate(match.groupValues[1].toInt(), match.groupValues[2].toInt(), match.groupValues[3].toInt()) }.getOrNull()
    }

    private fun two(n: Int) = n.toString().padStart(2, '0')

    private fun shortMonth(month: Int) = dk.packroff.hellocal.ui.ProfileShortMonths[month - 1]

    /** Intl da-DK {day: numeric, month: short, year: numeric}: "3. okt. 2026". */
    fun dayMonthYear(iso: String?): String {
        val local = parseInstant(iso)?.toLocalDateTime(tz) ?: return ""
        return "${local.dayOfMonth}. ${shortMonth(local.monthNumber)} ${local.year}"
    }

    /** Same for a plain date. */
    fun dayMonthYear(date: LocalDate): String = "${date.dayOfMonth}. ${shortMonth(date.monthNumber)} ${date.year}"

    /** Intl da-DK {day: numeric, month: short, hour, minute}: "3. okt. 14.05". */
    fun dayMonthTime(iso: String?): String {
        val local = parseInstant(iso)?.toLocalDateTime(tz) ?: return ""
        return "${local.dayOfMonth}. ${shortMonth(local.monthNumber)} ${two(local.hour)}.${two(local.minute)}"
    }

    /** toLocaleDateString("da-DK"): "3.10.2026". */
    fun shortDate(iso: String?): String {
        val local = parseInstant(iso)?.toLocalDateTime(tz) ?: return ""
        return "${local.dayOfMonth}.${local.monthNumber}.${local.year}"
    }

    /** toLocaleString(): "3.10.2026 14.05.09". */
    fun dateTime(iso: String?): String {
        val local = parseInstant(iso)?.toLocalDateTime(tz) ?: return ""
        return "${local.dayOfMonth}.${local.monthNumber}.${local.year} ${two(local.hour)}.${two(local.minute)}.${two(local.second)}"
    }

    /** dateStyle short + timeStyle short (da-DK): "03.10.2026 14.05". */
    fun shortDateTime(iso: String?): String {
        val local = parseInstant(iso)?.toLocalDateTime(tz) ?: return ""
        return "${two(local.dayOfMonth)}.${two(local.monthNumber)}.${local.year} ${two(local.hour)}.${two(local.minute)}"
    }

    /** "HH.mm" (da-DK hour/minute). */
    fun time(iso: String?): String {
        val local = parseInstant(iso)?.toLocalDateTime(tz) ?: return ""
        return "${two(local.hour)}.${two(local.minute)}"
    }

    /** formatGoalDate: "03.10.2026" for a "YYYY-MM-DD" date or an ISO timestamp. */
    fun goalDate(value: String): String {
        val date = if (value.length == 10) parseDay(value) else parseInstant(value)?.toLocalDateTime(tz)?.date
        return date?.let { "${two(it.dayOfMonth)}.${two(it.monthNumber)}.${it.year}" } ?: value
    }

    /** goalDisplayDate: the target date, else the creation day. */
    fun goalDisplayDate(goal: Goal): LocalDate =
        goal.targetDate?.let { parseDay(it) } ?: parseInstant(goal.createdAt)?.toLocalDateTime(tz)?.date ?: today()

    /** Danish short month without the dot ("okt") for GoalDateSquare. */
    fun monthAbbrev(date: LocalDate): String = shortMonth(date.monthNumber).removeSuffix(".")

    fun isSameLocalDay(iso: String, day: LocalDate): Boolean = parseInstant(iso)?.toLocalDateTime(tz)?.date == day

    fun localDateTime(iso: String?) = parseInstant(iso)?.toLocalDateTime(tz)

    /** computeAge (src/lib/age.ts): whole years since the birth date, or null. */
    fun age(birthDate: String?): Int? {
        val birth = parseDay(birthDate) ?: return null
        val now = today()
        var age = now.year - birth.year
        val hadBirthday = now.monthNumber > birth.monthNumber || (now.monthNumber == birth.monthNumber && now.dayOfMonth >= birth.dayOfMonth)
        if (!hadBirthday) age -= 1
        return if (age >= 0) age else null
    }
}

// ---------- Phone (src/lib/phone.ts) ----------

object ProfilePhone {
    private val callingCodes = mapOf("DK" to "45", "SE" to "46", "NO" to "47", "FI" to "358", "IS" to "354", "DE" to "49", "GB" to "44", "NL" to "31", "US" to "1")
    private val nationalLengths = mapOf("45" to 8, "47" to 8, "354" to 7)

    sealed interface Result {
        data class Ok(val e164: String) : Result
        data class Invalid(val empty: Boolean) : Result
    }

    fun validate(input: String, region: String?): Result {
        val raw = input.trim()
        if (raw.isEmpty()) return Result.Invalid(empty = true)
        if (!Regex("^[+\\d\\s().-]+$").matches(raw)) return Result.Invalid(false)
        val compact = raw.replace(Regex("[\\s().-]+"), "")
        val digits: String
        if (compact.startsWith("+")) {
            if (compact.substring(1).contains('+')) return Result.Invalid(false)
            digits = compact.substring(1).filter { it.isDigit() }
        } else if (compact.startsWith("00")) {
            digits = compact.substring(2).filter { it.isDigit() }
        } else {
            val national = compact.filter { it.isDigit() }
            val code = callingCodes[(region ?: "DK").uppercase()] ?: callingCodes.getValue("DK")
            val expected = nationalLengths[code]
            val bad = if (expected != null) national.length != expected else national.length < 4 || national.length > 14
            if (bad) return Result.Invalid(false)
            digits = code + national.trimStart('0')
        }
        if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return Result.Invalid(false)
        return Result.Ok("+$digits")
    }

    /** "+45 12 34 56 78" for Danish numbers, else the E.164 number as stored. */
    fun format(e164: String?): String {
        if (e164.isNullOrEmpty()) return ""
        if (Regex("^\\+45\\d{8}$").matches(e164)) {
            return "+45 " + e164.substring(3).chunked(2).joinToString(" ")
        }
        return e164
    }
}

/** JS String(number): "72" for whole numbers, "72.5" otherwise. */
fun jsNumber(value: Double): String =
    if (value == kotlin.math.floor(value) && kotlin.math.abs(value) < 1e15) value.toLong().toString() else value.toString()

/** JS Math.round (halves round up, unlike kotlin.math.round). */
fun jsRound(value: Double): Double = kotlin.math.floor(value + 0.5)

/** Math.round(value * 10) / 10 */
fun round1(value: Double): Double = jsRound(value * 10) / 10.0
