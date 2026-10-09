package dk.packroff.hellocal.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.Locale
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import kotlinx.datetime.todayIn

/**
 * Date/time text like the web's Intl.DateTimeFormat for the app locales, plus
 * native date/time pickers for the web's <input type="date|time|datetime-local">.
 */
object CaptureDates {
    val zone: TimeZone get() = TimeZone.currentSystemDefault()

    fun now(): Instant = Clock.System.now()
    fun today(): LocalDate = Clock.System.todayIn(zone)
    fun nowLocal(): LocalDateTime = now().toLocalDateTime(zone)

    fun parseInstant(iso: String?): Instant? = iso?.let { runCatching { Instant.parse(it) }.getOrNull() }
    fun local(iso: String?): LocalDateTime? = parseInstant(iso)?.toLocalDateTime(zone)
    fun toInstant(local: LocalDateTime): Instant = local.toInstant(zone)
    fun parseDate(value: String?): LocalDate? = value?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }

    private val longMonths = mapOf(
        Locale.Da to listOf("januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"),
        Locale.No to listOf("januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"),
        Locale.Sv to listOf("januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"),
        Locale.De to listOf("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"),
        Locale.Nl to listOf("januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"),
        Locale.Fr to listOf("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"),
        Locale.En to listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"),
    )

    private val shortDa = listOf("jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec.")

    fun monthLong(month: Int, locale: Locale = Locale.Da): String = (longMonths[locale] ?: longMonths.getValue(Locale.Da))[month - 1]

    fun monthShort(month: Int, locale: Locale = Locale.Da): String = when (locale) {
        Locale.Da -> shortDa[month - 1]
        Locale.En -> monthLong(month, locale).take(3)
        else -> monthLong(month, locale).let { if (it.length <= 4) it else it.take(3) + "." }
    }

    private fun pad(n: Int) = n.toString().padStart(2, '0')

    /** "14.05" (da-DK hour/minute 2-digit uses a dot), "14:05" for en. */
    fun time(local: LocalDateTime, locale: Locale = Locale.Da): String =
        pad(local.hour) + (if (locale == Locale.Da) "." else ":") + pad(local.minute)

    /** "5. okt." (+ year when not this year, like the web). */
    fun dayMonthShort(date: LocalDate, withYear: Boolean = date.year != today().year, locale: Locale = Locale.Da): String =
        if (locale == Locale.En) "${date.dayOfMonth} ${monthShort(date.monthNumber, locale)}" + (if (withYear) " ${date.year}" else "")
        else "${date.dayOfMonth}. ${monthShort(date.monthNumber, locale)}" + (if (withYear) " ${date.year}" else "")

    /** "5. oktober" */
    fun dayMonthLong(date: LocalDate, locale: Locale = Locale.Da): String =
        if (locale == Locale.En) "${date.dayOfMonth} ${monthLong(date.monthNumber, locale)}" else "${date.dayOfMonth}. ${monthLong(date.monthNumber, locale)}"

    /** "5. okt. 14.05" */
    fun dayMonthShortTime(local: LocalDateTime, locale: Locale = Locale.Da): String =
        "${dayMonthShort(local.date, withYear = false, locale = locale)} ${time(local, locale)}"

    /** "5. oktober kl. 14.05" */
    fun dayMonthLongTime(local: LocalDateTime, locale: Locale = Locale.Da): String =
        if (locale == Locale.Da) "${dayMonthLong(local.date, locale)} kl. ${time(local, locale)}"
        else "${dayMonthLong(local.date, locale)} ${time(local, locale)}"

    /** "2026-10-08" */
    fun isoDate(date: LocalDate): String = "${date.year}-${pad(date.monthNumber)}-${pad(date.dayOfMonth)}"

    /** "14:05" — the value of an <input type="time">. */
    fun clock(local: LocalDateTime): String = "${pad(local.hour)}:${pad(local.minute)}"
}

/** <input type="date"> as a bottom sheet with the Material date picker. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CaptureDatePickerSheet(
    initial: LocalDate,
    onPick: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
    max: LocalDate? = null,
    title: String? = null,
    confirmLabel: String = "OK",
) {
    val maxMillis = max?.atStartOfDayIn(TimeZone.UTC)?.toEpochMilliseconds()
    val state = rememberDatePickerState(
        initialSelectedDateMillis = initial.atStartOfDayIn(TimeZone.UTC).toEpochMilliseconds(),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean = maxMillis == null || utcTimeMillis <= maxMillis
        },
    )
    HcBottomSheet(onDismiss = onDismiss, title = title) {
        DatePicker(state = state, modifier = Modifier.fillMaxWidth(), title = null, headline = null, showModeToggle = false, colors = DatePickerDefaults.colors())
        VSpace(8.dp)
        HcButton(confirmLabel, onClick = {
            val millis = state.selectedDateMillis
            if (millis != null) onPick(Instant.fromEpochMilliseconds(millis).toLocalDateTime(TimeZone.UTC).date)
            onDismiss()
        })
    }
}

/** <input type="time"> as a bottom sheet with the Material 24-hour time picker. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CaptureTimePickerSheet(
    hour: Int,
    minute: Int,
    onPick: (hour: Int, minute: Int) -> Unit,
    onDismiss: () -> Unit,
    title: String? = null,
    confirmLabel: String = "OK",
) {
    val state = rememberTimePickerState(initialHour = hour, initialMinute = minute, is24Hour = true)
    HcBottomSheet(onDismiss = onDismiss, title = title) {
        TimePicker(state = state, modifier = Modifier.fillMaxWidth())
        VSpace(8.dp)
        HcButton(confirmLabel, onClick = {
            onPick(state.hour, state.minute)
            onDismiss()
        })
    }
}
