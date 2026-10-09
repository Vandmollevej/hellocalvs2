package dk.packroff.hellocal.screens.calendar

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CalendarBathScaleIcon
import dk.packroff.hellocal.ui.CalendarPartyPopperIcon
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.formatNumber
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.datetime.LocalDate

// Timeline pieces shared by the day view and the landscape week timeline:
// gray sleep bands, the draggable bed/wake handles, hour labels and lines.

internal const val HOUR_HEIGHT = 40f
private const val SLEEP_DRAG_EDGE_DP = 48f
private const val SLEEP_DRAG_MAX_SCROLL_DP = 5f

/** A 1 px line at [top] across the timeline. */
@Composable
internal fun TimelineLine(top: Dp, color: Color) {
    Box(Modifier.offset(y = top).fillMaxWidth().height(1.dp).background(color))
}

/** Gray band(s) for the night (or one band for daytime sleep after a night shift). */
@Composable
internal fun SleepBands(window: SleepWindow, hourHeight: Float) {
    if (isDaytimeSleep(window)) {
        SleepBand((window.bedtime / 60 * hourHeight).toFloat(), ((window.wakeTime - window.bedtime) / 60 * hourHeight).toFloat(), topLine = true, bottomLine = true)
        return
    }
    SleepBand(0f, (window.wakeTime / 60 * hourHeight).toFloat(), topLine = false, bottomLine = true)
    val bedTop = (bedtimeDisplayMinutes(window) / 60 * hourHeight).toFloat()
    SleepBand(bedTop, 24 * hourHeight - bedTop, topLine = true, bottomLine = false)
}

@Composable
private fun SleepBand(top: Float, height: Float, topLine: Boolean, bottomLine: Boolean) {
    val line = HcColors.GrayBorder.copy(alpha = 0.6f)
    Box(
        Modifier.offset(y = top.dp).fillMaxWidth().height(max(0f, height).dp).background(HcColors.Gray.copy(alpha = 0.15f)).drawBehind {
            val stroke = 1.dp.toPx()
            if (topLine) drawRect(line, Offset.Zero, androidx.compose.ui.geometry.Size(size.width, stroke))
            if (bottomLine) drawRect(line, Offset(0f, size.height - stroke), androidx.compose.ui.geometry.Size(size.width, stroke))
        },
    )
}

private class HandleDrag {
    var startFinger = 0f
    var lastFinger = 0f
    var startMinutes = 0.0
    var startScroll = 0
}

/**
 * SleepBoundaryHandle: drag the bed/wake line. Live minutes go to [onDrag]
 * (so the band follows); release commits when it moved at least 15 min.
 * Dragging near the edge of the timeline's viewport scrolls it along.
 */
@Composable
internal fun SleepBoundaryHandle(
    minutes: Double,
    type: SleepAdjustType,
    hourHeight: Float,
    onCommit: (SleepAdjustType, Double) -> Unit,
    onDrag: ((SleepAdjustType, Double?) -> Unit)? = null,
    scroll: ScrollState? = null,
    viewport: (() -> Pair<Float, Float>?)? = null,
) {
    val t = LocalTranslator.current
    val density = LocalDensity.current
    var dragMinutes by remember { mutableStateOf<Double?>(null) }
    val drag = remember { HandleDrag() }
    var coords by remember { mutableStateOf<LayoutCoordinates?>(null) }
    val currentMinutes by rememberUpdatedState(minutes)
    val currentHourHeight by rememberUpdatedState(hourHeight)
    val commit by rememberUpdatedState(onCommit)
    val live by rememberUpdatedState(onDrag)

    fun update() {
        val scrollDelta = (scroll?.value ?: 0) - drag.startScroll
        val deltaDp = (drag.lastFinger - drag.startFinger + scrollDelta) / density.density
        val deltaMinutes = deltaDp / currentHourHeight * 60
        // Bedtime can go down to 24:00 (saved as 00:00) but not up into the night hours.
        val lower = if (type == SleepAdjustType.Bedtime) LATE_BEDTIME_CUTOFF_MINUTES else 0.0
        val upper = if (type == SleepAdjustType.Bedtime) 24.0 * 60 else 24.0 * 60 - 1
        val next = min(upper, max(lower, drag.startMinutes + deltaMinutes))
        dragMinutes = next
        live?.invoke(type, next)
    }

    LaunchedEffect(dragMinutes != null) {
        if (dragMinutes == null || scroll == null || viewport == null) return@LaunchedEffect
        val edge = SLEEP_DRAG_EDGE_DP * density.density
        val maxSpeed = SLEEP_DRAG_MAX_SCROLL_DP * density.density
        while (true) {
            withFrameNanos { }
            val (top, bottom) = viewport() ?: continue
            val y = drag.lastFinger
            val speed = when {
                y < top + edge -> -min(1f, (top + edge - y) / edge) * maxSpeed
                y > bottom - edge -> min(1f, (y - (bottom - edge)) / edge) * maxSpeed
                else -> 0f
            }
            if (speed == 0f) continue
            val before = scroll.value
            scroll.scrollBy(speed)
            if (scroll.value != before) update()
        }
    }

    val display = dragMinutes ?: minutes
    val label = t.t(if (type == SleepAdjustType.Bedtime) "calendar.adjustBedtimeAriaLabel" else "calendar.adjustWakeTimeAriaLabel")
    Box(
        Modifier
            .offset(y = (display / 60 * hourHeight).toFloat().dp - 14.dp)
            .fillMaxWidth()
            .height(28.dp)
            .zIndex(10f)
            .semantics { contentDescription = label }
            .onGloballyPositioned { coords = it }
            .pointerInput(type) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    down.consume()
                    val origin = coords?.positionInWindow()?.y ?: 0f
                    drag.startFinger = origin + down.position.y
                    drag.lastFinger = drag.startFinger
                    drag.startMinutes = currentMinutes
                    drag.startScroll = scroll?.value ?: 0
                    dragMinutes = currentMinutes
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        drag.lastFinger = (coords?.positionInWindow()?.y ?: 0f) + change.position.y
                        change.consume()
                        update()
                    }
                    val final = dragMinutes
                    // A tap without real movement changes nothing.
                    if (final != null && jsRound(final / 15) != jsRound(drag.startMinutes / 15)) commit(type, final)
                    dragMinutes = null
                    live?.invoke(type, null)
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.size(40.dp, 4.dp).shadow(1.dp, CircleShape).clip(CircleShape)
                .background(if (dragMinutes != null) HcColors.Black else HcColors.Gray),
        )
    }
}

/** Moon + "Søvn: 7,50 timer" at the bottom of the gray band that ends at the wake time. */
@Composable
internal fun SleepDurationLabel(wakeTime: Double, durationMinutes: Double, hourHeight: Float, belowLine: Boolean) {
    val t = LocalTranslator.current
    val hours = formatNumber(durationMinutes / 60, 2, t.locale, minDecimals = 2)
    Row(
        Modifier.offset(x = 8.dp, y = (wakeTime / 60 * hourHeight).toFloat().dp + (if (belowLine) 12.dp else (-22).dp)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        HcIcon("Moon", size = 14.dp, stroke = 1.8f, color = HcColors.TextSecondary)
        HcText(t.t("calendar.nightSleepDuration", "hours" to hours), HcTypeRoles.Caption, maxLines = 1)
    }
}

/** Waits until the scroll content is laid out, then scrolls to [px]. */
internal suspend fun ScrollState.scrollWhenReady(px: Int) {
    withTimeoutOrNull(1500) { snapshotFlow { maxValue }.first { it > 0 } }
    scrollTo(px.coerceIn(0, maxValue))
}

/**
 * WeekTimelineView — landscape week view: one column per day with the sleep
 * bands, handles, registrations and weigh-ins on a 00–24 timeline. A double
 * tap on a column opens the add menu at that half hour.
 */
@Composable
internal fun WeekTimelineView(
    days: List<LocalDate>,
    today: LocalDate,
    totals: Map<LocalDate, Double>,
    goals: GoalLookup,
    registrations: List<CalRegistration>,
    goalDates: Set<LocalDate>,
    weighInsByDate: Map<LocalDate, List<CalWeighIn>>,
    maxHeight: Dp,
    onOpenDate: (LocalDate) -> Unit,
    sleepWindowFor: (LocalDate) -> SleepWindow,
    onSleepAdjust: (LocalDate, SleepAdjustType, Double) -> Unit,
    onAddAt: (LocalDate, String) -> Unit,
) {
    val density = LocalDensity.current
    val tan = HcColors.Tan
    val vertical = rememberScrollState()
    LaunchedEffect(days.first()) {
        val anchorHour = floor(sleepWindowFor(days.first()).wakeTime / 60)
        vertical.scrollWhenReady(with(density) { max(0.0, anchorHour * HOUR_HEIGHT - HOUR_HEIGHT).toFloat().dp.roundToPx() })
    }
    val byDay = remember(registrations) { registrations.groupBy { it.at.date } }
    BoxWithConstraints(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).border(1.dp, tan, RoundedCornerShape(16.dp)).background(HcColors.White),
    ) {
        val columnWidth = max(92f, (maxWidth.value - 48f) / 7f).dp
        Column(Modifier.horizontalScroll(rememberScrollState())) {
            Row {
                Box(Modifier.size(48.dp).cellLines(tan, right = true, bottom = true))
                days.forEachIndexed { index, date ->
                    val current = date == today
                    val met = dailyGoalMet(totals, date, goals.effective(date))
                    Column(
                        Modifier.width(columnWidth).height(48.dp)
                            .background(if (current) HcColors.White else Color.Transparent)
                            .let { if (current) it.border(2.dp, HcColors.Brand) else it }
                            .cellLines(tan, right = index < days.lastIndex, bottom = true)
                            .clickable { onOpenDate(date) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        HcText(weekdayShort(date).uppercase(), HcTypeRoles.Micro, bold = true, color = HcColors.TextSecondary, maxLines = 1)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            HcText(date.dayOfMonth.toString(), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                            if (met) HcIcon("Check", size = 15.dp, stroke = 3.5f, color = HcColors.Green)
                            if (date in goalDates) CalendarPartyPopperIcon(15.dp, HcColors.Black)
                            if (!weighInsByDate[date].isNullOrEmpty()) CalendarBathScaleIcon(15.dp, HcColors.Black)
                        }
                    }
                }
            }
            Box(Modifier.heightIn(max = maxHeight).verticalScroll(vertical)) {
                Row(Modifier.height((HOUR_HEIGHT * 24).dp)) {
                    Box(Modifier.width(48.dp).fillMaxHeight().cellLines(tan, right = true, bottom = false)) {
                        for (hour in 0..24) {
                            HcText(
                                pad2(hour),
                                HcTypeRoles.Micro,
                                Modifier.offset(y = (hour * HOUR_HEIGHT).dp - 7.dp).fillMaxWidth().padding(end = 6.dp),
                                bold = true,
                                color = HcColors.TextSecondary,
                                align = TextAlign.End,
                            )
                        }
                    }
                    days.forEachIndexed { index, date ->
                        val window = sleepWindowFor(date)
                        Box(Modifier.width(columnWidth).fillMaxHeight().cellLines(tan, right = index < days.lastIndex, bottom = false)) {
                            SleepBands(window, HOUR_HEIGHT)
                            Box(
                                Modifier.fillMaxSize().pointerInput(date) {
                                    detectTapGestures(onDoubleTap = { offset ->
                                        val minutes = floor(offset.y / density.density / HOUR_HEIGHT * 2).toInt() * 30
                                        onAddAt(date, minutesToTime(min(minutes, 23 * 60 + 30).toDouble()))
                                    })
                                },
                            )
                            for (hour in 0..24) TimelineLine((hour * HOUR_HEIGHT).dp, tan.copy(alpha = 0.6f))
                            SleepBoundaryHandle(window.wakeTime, SleepAdjustType.Wake, HOUR_HEIGHT, { type, minutes -> onSleepAdjust(date, type, minutes) })
                            SleepBoundaryHandle(bedtimeDisplayMinutes(window), SleepAdjustType.Bedtime, HOUR_HEIGHT, { type, minutes -> onSleepAdjust(date, type, minutes) })
                            for (registration in byDay[date] ?: emptyList()) {
                                val water = isWaterRegistration(registration)
                                val text = if (water) formatCl(waterRegistrationMl(registration)) else "${jsRound(registration.kcal)} kcal"
                                Box(
                                    Modifier.offset(y = (minutesFromMidnight(registration.at) / 60f * HOUR_HEIGHT).dp)
                                        .padding(horizontal = 2.dp).fillMaxWidth().heightIn(min = 18.dp)
                                        .clip(RoundedCornerShape(6.dp)).background(HcColors.Green).padding(horizontal = 4.dp)
                                        .semantics { contentDescription = "${registration.title} · $text" },
                                    contentAlignment = Alignment.CenterStart,
                                ) {
                                    HcText(text, HcTypeRoles.Micro, bold = true, color = HcColors.White, maxLines = 1)
                                }
                            }
                            for (entry in weighInsByDate[date] ?: emptyList()) {
                                Row(
                                    Modifier.offset(y = (minutesFromMidnight(entry.at) / 60f * HOUR_HEIGHT).dp)
                                        .padding(horizontal = 2.dp).fillMaxWidth().heightIn(min = 18.dp)
                                        .clip(RoundedCornerShape(6.dp)).background(HcColors.Tan)
                                        .border(1.dp, HcColors.TanDark, RoundedCornerShape(6.dp)).padding(horizontal = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    CalendarBathScaleIcon(12.dp, HcColors.Black)
                                    HcText("${formatKg(entry.weightKg)} kg", HcTypeRoles.Micro, bold = true, color = HcColors.Black, maxLines = 1)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** 1 px right/bottom cell borders (border-r / border-b on the web). */
internal fun Modifier.cellLines(color: Color, right: Boolean, bottom: Boolean): Modifier = drawBehind {
    val stroke = 1.dp.toPx()
    if (right) drawRect(color, Offset(size.width - stroke, 0f), androidx.compose.ui.geometry.Size(stroke, size.height))
    if (bottom) drawRect(color, Offset(0f, size.height - stroke), androidx.compose.ui.geometry.Size(size.width, stroke))
}
