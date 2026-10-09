package dk.packroff.hellocal.screens.statistics

import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.ui.formatNumber
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.isoDayNumber

// src/lib/stat-periods.ts, src/lib/sleep-stats.ts (periods) and the Danish
// date/number formatting the web gets from Intl ("da-DK").

/** Intl.NumberFormat("da-DK", { maximumFractionDigits }) — "1.234,6". */
internal fun daNumber(value: Double, maximumFractionDigits: Int = 0): String =
    formatNumber(value, maximumFractionDigits, Locale.Da, minDecimals = 0)

private val SHORT_MONTHS = listOf("jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec.")
private val LONG_MONTHS = listOf("januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december")

/** { day: "numeric", month: "short" } → "8. okt." */
internal fun daShortDate(date: LocalDate): String = "${date.dayOfMonth}. ${SHORT_MONTHS[date.monthNumber - 1]}"

/** { day, month: "short", year: "2-digit" } → "8. okt. 26" */
internal fun daShortDateYear2(date: LocalDate): String = "${daShortDate(date)} ${(date.year % 100).toString().padStart(2, '0')}"

/** { day, month: "short", year: "numeric" } → "8. okt. 2026" */
internal fun daShortDateYear(date: LocalDate): String = "${daShortDate(date)} ${date.year}"

/** { day, month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } → "8. okt. 2026, 14.05" */
internal fun daDateTime(value: LocalDateTime): String =
    "${daShortDateYear(value.date)}, ${value.hour.toString().padStart(2, '0')}.${value.minute.toString().padStart(2, '0')}"

/** { month: "long", year: "numeric" } → "oktober 2026" */
internal fun daMonthYear(date: LocalDate): String = "${LONG_MONTHS[date.monthNumber - 1]} ${date.year}"

/** "21:45" — also past midnight (1470 → "00:30"); src/lib/sleep-stats.ts formatMinutesOfDay. */
internal fun formatMinutesOfDay(minutes: Double): String {
    val wrapped = ((kotlin.math.round(minutes).toInt() % 1440) + 1440) % 1440
    return "${(wrapped / 60).toString().padStart(2, '0')}:${(wrapped % 60).toString().padStart(2, '0')}"
}

/** JavaScript's String(number) for one-decimal values ("0.5", "12", "-3.2"). */
internal fun jsNumber(value: Double): String =
    if (value == kotlin.math.floor(value) && kotlin.math.abs(value) < 1e15) value.toLong().toString() else value.toString()

// ---------- Global period picker (src/lib/stat-periods.ts) ----------

internal enum class StatPeriodKey(val label: String) {
    Today("I dag"),
    Last7("Seneste 7 dage"),
    LastWeek("Sidste uge"),
    ThisWeek("Denne uge"),
    ThisMonth("Denne måned"),
    LastMonth("Sidste måned"),
    ThisYear("I år"),
    LastYear("Sidste år"),
}

internal sealed interface StatPeriodSelection {
    data class Preset(val key: StatPeriodKey) : StatPeriodSelection
    /** [start, end) — end is exclusive like the web's custom range. */
    data class Custom(val start: LocalDate, val end: LocalDate) : StatPeriodSelection
}

internal val DEFAULT_STAT_SELECTION: StatPeriodSelection = StatPeriodSelection.Preset(StatPeriodKey.Today)

private fun startOfWeek(day: LocalDate): LocalDate = day.plusDays(-(day.dayOfWeek.isoDayNumber - 1))

internal fun periodRange(key: StatPeriodKey, today: LocalDate = todayLocal()): DayRange = when (key) {
    StatPeriodKey.Today -> DayRange(today, today.plusDays(1))
    StatPeriodKey.Last7 -> DayRange(today.plusDays(-6), today.plusDays(1))
    StatPeriodKey.ThisWeek -> startOfWeek(today).let { DayRange(it, it.plusDays(7)) }
    StatPeriodKey.LastWeek -> startOfWeek(today).let { DayRange(it.plusDays(-7), it) }
    StatPeriodKey.ThisMonth -> LocalDate(today.year, today.monthNumber, 1).let { DayRange(it, it.plusMonths(1)) }
    StatPeriodKey.LastMonth -> LocalDate(today.year, today.monthNumber, 1).let { DayRange(it.plusMonths(-1), it) }
    StatPeriodKey.ThisYear -> DayRange(LocalDate(today.year, 1, 1), LocalDate(today.year + 1, 1, 1))
    StatPeriodKey.LastYear -> DayRange(LocalDate(today.year - 1, 1, 1), LocalDate(today.year, 1, 1))
}

internal fun selectionRange(selection: StatPeriodSelection): DayRange = when (selection) {
    is StatPeriodSelection.Preset -> periodRange(selection.key)
    is StatPeriodSelection.Custom -> DayRange(selection.start, selection.end)
}

internal fun selectionLabel(selection: StatPeriodSelection): String = when (selection) {
    is StatPeriodSelection.Preset -> selection.key.label
    is StatPeriodSelection.Custom -> "${daShortDate(selection.start)} – ${daShortDate(selection.end.plusDays(-1))}"
}

// ---------- Sleep / water statistics periods (src/lib/sleep-stats.ts) ----------

internal enum class SleepStatPeriodKey(val key: String) {
    Last7("last7"),
    Last30("last30"),
    LastMonth("lastMonth"),
    Last3Months("last3Months"),
    ThisYear("thisYear"),
}

/** The mornings in the period (the date one woke up and rated the night). */
internal fun sleepPeriodDays(key: SleepStatPeriodKey, today: LocalDate = todayLocal()): List<LocalDate> {
    var end = today
    val start: LocalDate = when (key) {
        SleepStatPeriodKey.Last7 -> today.plusDays(-6)
        SleepStatPeriodKey.Last30 -> today.plusDays(-29)
        SleepStatPeriodKey.LastMonth -> {
            val firstThisMonth = LocalDate(today.year, today.monthNumber, 1)
            end = firstThisMonth.plusDays(-1)
            firstThisMonth.plusMonths(-1)
        }
        // new Date(y, m - 3, d + 1): three months back, then one day forward.
        SleepStatPeriodKey.Last3Months -> today.plusMonths(-3).plusDays(1)
        SleepStatPeriodKey.ThisYear -> LocalDate(today.year, 1, 1)
    }
    val days = mutableListOf<LocalDate>()
    var day = start
    while (day <= end) {
        days += day
        day = day.plusDays(1)
    }
    return days
}
