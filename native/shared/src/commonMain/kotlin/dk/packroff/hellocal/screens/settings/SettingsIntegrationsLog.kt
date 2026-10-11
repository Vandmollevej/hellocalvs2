package dk.packroff.hellocal.screens.settings

import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.screens.calendar.MEASUREMENT_TYPES
import dk.packroff.hellocal.screens.food.FoodTime
import dk.packroff.hellocal.screens.statistics.sportMeta
import dk.packroff.hellocal.ui.CaptureDates
import dk.packroff.hellocal.ui.formatNumber
import kotlin.math.floor
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable

// Pure helpers for the log on the connected integration page: the JSON shape of
// GET /api/integrations/<pageSlug>/log and the value text / day grouping of
// src/lib/integrations/log-format.ts and log-window.ts. No UI in this file.

/** The periods of the history dropdown (log-window.ts HISTORY_RANGES); "today" always has its own section. */
internal val SETTINGS_INTEGRATIONS_HISTORY_RANGES = listOf("yesterday", "week", "month", "year", "all")

/** log-window.ts LOG_TIME_ZONE: days are always counted in Danish time. */
private val SETTINGS_LOG_ZONE: TimeZone by lazy { settingsCopenhagenZone() }

/** log-format.ts IntegrationLogEntry. */
@Serializable
data class SettingsIntegrationLogEntry(
    val id: String = "",
    /** "metric" | "weight" | "activity" */
    val kind: String = "metric",
    /** HealthMetricType, "WEIGHT" or the normalised sport type. */
    val type: String = "",
    /** Metric: the value; weigh-in: kg; activity: duration in minutes. */
    val value: Double = 0.0,
    /** Activity: burnt kcal. */
    val kcal: Double? = null,
    val at: String = "",
    /** Day total (stored at 00:00 UTC): shown as "Hele dagen" without a time. */
    val daySum: Boolean = false,
)

/** log-format.ts IntegrationLogResponse. */
@Serializable
data class SettingsIntegrationLogResponse(
    val range: String = "",
    val entries: List<SettingsIntegrationLogEntry> = emptyList(),
    /** Rows in the period before the list was cut to the latest. */
    val total: Int = 0,
)

/** One day of the grouped log (day = "YYYY-MM-DD" in Danish time). */
internal class SettingsIntegrationLogDay(val day: String, val entries: List<SettingsIntegrationLogEntry>)

private class SettingsLogSpec(val unit: String, val digits: Int, val style: String? = null)

private val LOG_COUNT = SettingsLogSpec("", 0)
private val LOG_BPM = SettingsLogSpec("bpm", 0)
private val LOG_MINUTES = SettingsLogSpec("min", 0, "duration")
private val LOG_MS = SettingsLogSpec("ms", 0)

// Types that calendar-measurements does not know (body measurements live there).
private val SETTINGS_LOG_SPECS: Map<String, SettingsLogSpec> = mapOf(
    "STEPS" to LOG_COUNT,
    "DISTANCE_KM" to SettingsLogSpec("km", 1),
    "FLOORS_CLIMBED" to LOG_COUNT,
    "ACTIVE_ENERGY_KCAL" to SettingsLogSpec("kcal", 0),
    "RESTING_ENERGY_KCAL" to SettingsLogSpec("kcal", 0),
    "WATER_ML" to SettingsLogSpec("ml", 0),
    "EXERCISE_MINUTES" to LOG_MINUTES,
    "STAND_MINUTES" to LOG_MINUTES,
    "ACTIVE_ZONE_MINUTES" to LOG_MINUTES,
    "RESTING_HEART_RATE_BPM" to LOG_BPM,
    "RESTING_HEART_RATE_MINUTES" to LOG_MINUTES,
    "HEART_RATE_MIN_BPM" to LOG_BPM,
    "HEART_RATE_MAX_BPM" to LOG_BPM,
    "HEART_RATE_RECOVERY_BPM" to LOG_BPM,
    "HEART_RATE_VARIABILITY_MS" to LOG_MS,
    "RESPIRATORY_RATE_BPM" to SettingsLogSpec("/min", 1),
    "VO2_MAX" to SettingsLogSpec("ml/kg/min", 1),
    "STRESS_SCORE" to LOG_COUNT,
    "EDA_RESPONSES" to LOG_COUNT,
    "CARDIO_LOAD" to LOG_COUNT,
    "RECOVERY_SCORE" to LOG_COUNT,
    "STRAIN_SCORE" to SettingsLogSpec("", 1),
    "FITNESS_AGE_YEARS" to SettingsLogSpec("år", 0),
    "QRS_INTERVAL_MS" to LOG_MS,
    "PR_INTERVAL_MS" to LOG_MS,
    "QT_INTERVAL_MS" to LOG_MS,
    "QTC_INTERVAL_MS" to LOG_MS,
    "SLEEP_MINUTES" to LOG_MINUTES,
    "SLEEP_IN_BED_MINUTES" to LOG_MINUTES,
    "SLEEP_AWAKE_MINUTES" to LOG_MINUTES,
    "SLEEP_REM_MINUTES" to LOG_MINUTES,
    "SLEEP_LIGHT_MINUTES" to LOG_MINUTES,
    "SLEEP_DEEP_MINUTES" to LOG_MINUTES,
    "SLEEP_START_MINUTE_OF_DAY" to SettingsLogSpec("", 0, "clock"),
    "SLEEP_END_MINUTE_OF_DAY" to SettingsLogSpec("", 0, "clock"),
    "SLEEP_SCORE" to LOG_COUNT,
    "SLEEP_EFFICIENCY_PERCENT" to SettingsLogSpec("%", 0),
    "SLEEP_AWAKENINGS" to LOG_COUNT,
    "BODY_WATER_KG" to SettingsLogSpec("kg", 1),
    "METABOLIC_AGE" to SettingsLogSpec("år", 0),
    "VASCULAR_AGE" to SettingsLogSpec("år", 0),
    "ELECTROCHEMICAL_SKIN_CONDUCTANCE" to SettingsLogSpec("µS", 0),
)

private val SETTINGS_LOG_BODY_SPECS: Map<String, SettingsLogSpec> =
    MEASUREMENT_TYPES.associate { it.type to SettingsLogSpec(it.unit, it.digits) }

private fun settingsLogValueSpec(type: String): SettingsLogSpec =
    SETTINGS_LOG_SPECS[type] ?: SETTINGS_LOG_BODY_SPECS[type] ?: SettingsLogSpec("", 1)

/** JS Math.round: halves go up. */
private fun settingsLogRound(value: Double): Int = floor(value + 0.5).toInt()

/** log-format.ts duration(): "45 min", "2 t", "7 t 12 min". */
private fun settingsLogDuration(minutes: Double, t: Translator): String {
    val total = settingsLogRound(minutes).coerceAtLeast(0)
    val h = total / 60
    val m = total % 60
    if (h == 0) return t.t("integrations.connected.minutes", "m" to m)
    return if (m == 0) t.t("integrations.connected.hours", "h" to h) else t.t("integrations.connected.hoursMinutes", "h" to h, "m" to m)
}

/** log-format.ts clock(): a time of day from minutes after midnight (sleep start/end), always "HH:MM". */
private fun settingsLogClock(minuteOfDay: Double): String {
    val total = ((settingsLogRound(minuteOfDay) % 1440) + 1440) % 1440
    return (total / 60).toString().padStart(2, '0') + ":" + (total % 60).toString().padStart(2, '0')
}

/** log-format.ts formatLogValue(): the value as text, e.g. "7 t 12 min", "62 bpm", "81,4 kg". */
internal fun settingsIntegrationLogValue(entry: SettingsIntegrationLogEntry, t: Translator): String {
    val locale = t.locale
    fun number(value: Double, digits: Int) = formatNumber(value, digits, locale, minDecimals = 0)

    if (entry.kind == "weight") return number(entry.value, 1) + " kg"
    if (entry.kind == "activity") {
        val time = settingsLogDuration(entry.value, t)
        val kcal = entry.kcal
        return if (kcal != null && kcal > 0) time + " · " + number(kcal, 0) + " kcal" else time
    }
    val spec = settingsLogValueSpec(entry.type)
    if (spec.style == "duration") return settingsLogDuration(entry.value, t)
    if (spec.style == "clock") return settingsLogClock(entry.value)
    val formatted = number(entry.value, spec.digits)
    return if (spec.unit.isNotEmpty()) formatted + " " + spec.unit else formatted
}

/**
 * ConnectedView.tsx entryLabel(): "Vægt" for a weigh-in, the sport's name for a
 * workout (getSportMeta(type).label), otherwise the i18n name of the metric type.
 */
internal fun settingsIntegrationLogLabel(entry: SettingsIntegrationLogEntry, t: Translator): String = when (entry.kind) {
    "weight" -> t.t("integrations.access.read.weight")
    "activity" -> sportMeta(entry.type).first
    else -> t.t("integrations.log.type.${entry.type}")
}

/** The clock time of a row in Danish time: Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }) → "14.05" in Danish, "14:05" otherwise. */
internal fun settingsIntegrationLogTime(iso: String, locale: Locale): String {
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return iso
    return CaptureDates.time(instant.toLocalDateTime(SETTINGS_LOG_ZONE), locale)
}

/** log-window.ts ymdCph(): the calendar day ("YYYY-MM-DD") of an instant in Danish time. */
private fun settingsLogDayOf(iso: String): String {
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return iso.take(10)
    return instant.toLocalDateTime(SETTINGS_LOG_ZONE).date.toString()
}

/** log-format.ts groupLogByDay(): rows per Danish calendar day, newest day first (order inside a day is kept). */
internal fun settingsIntegrationGroupByDay(entries: List<SettingsIntegrationLogEntry>): List<SettingsIntegrationLogDay> {
    val groups = LinkedHashMap<String, MutableList<SettingsIntegrationLogEntry>>()
    for (entry in entries) {
        // Day totals are stored as the date at 00:00 UTC — the date is the day's own.
        val day = if (entry.daySum) entry.at.take(10) else settingsLogDayOf(entry.at)
        groups.getOrPut(day) { mutableListOf() }.add(entry)
    }
    return groups.entries.sortedByDescending { it.key }.map { SettingsIntegrationLogDay(it.key, it.value) }
}

/**
 * Day heading: Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric",
 * month: "long" }) of the day itself — "mandag den 5. oktober" in Danish.
 */
internal fun settingsIntegrationLogDayTitle(day: String, locale: Locale): String {
    val date = runCatching { LocalDate.parse(day) }.getOrNull() ?: return day
    return FoodTime.longDate(date, locale, withYear = false)
}
