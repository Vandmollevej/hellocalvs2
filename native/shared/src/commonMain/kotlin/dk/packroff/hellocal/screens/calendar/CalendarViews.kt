package dk.packroff.hellocal.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CalendarBathScaleIcon
import dk.packroff.hellocal.ui.CalendarPartyPopperIcon
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.formatNumber
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.datetime.LocalDate

// Month, week and list views of src/app/calendar/page.tsx plus the period
// header, month picker and the monthly status block above them.

private val WEEKDAY_KEYS = listOf(
    "calendar.weekdayMon", "calendar.weekdayTue", "calendar.weekdayWed", "calendar.weekdayThu",
    "calendar.weekdayFri", "calendar.weekdaySat", "calendar.weekdaySun",
)

/** ‹ period label › with the month picker under the label; "uge N" under week view. */
@Composable
internal fun PeriodHeader(
    view: CalendarView,
    label: String,
    weekNumber: Int?,
    monthMenuOpen: Boolean,
    year: Int,
    month: Int,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onToggleMonthMenu: () -> Unit,
    onYearChange: (Int) -> Unit,
    onSelectMonth: (Int) -> Unit,
    onDismissMonthMenu: () -> Unit,
) {
    val t = LocalTranslator.current
    val period = if (view == CalendarView.Month) t.t("calendar.periodMonth") else t.t("calendar.periodWeek")
    Box(Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
            CalendarIconButton("ChevronLeft", t.t("calendar.periodNavAriaLabel", "direction" to t.t("calendar.previous"), "period" to period), onPrevious)
            Box {
                Box(
                    Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(50)).clickable(onClick = onToggleMonthMenu).padding(horizontal = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    HcText(capitalizeWords(label), HcTypeRoles.Body, bold = true, color = HcColors.Black, maxLines = 1)
                }
                if (monthMenuOpen) MonthPicker(year, month, onYearChange, onSelectMonth, onDismissMonthMenu)
            }
            CalendarIconButton("ChevronRight", t.t("calendar.periodNavAriaLabel", "direction" to t.t("calendar.next"), "period" to period), onNext)
        }
        if (weekNumber != null) {
            HcText(
                t.t("calendar.weekNumberLabel", "number" to weekNumber).lowercase(),
                HcTypeRoles.Small,
                // Centred 2 px below the header, in the gap above the status line.
                Modifier.fillMaxWidth().align(Alignment.BottomCenter).offset(y = 11.dp),
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
        }
    }
}

/** MonthPicker: year with ‹ ›, then the 12 months in a 3-column grid. */
@Composable
private fun MonthPicker(year: Int, month: Int, onYearChange: (Int) -> Unit, onSelect: (Int) -> Unit, onDismiss: () -> Unit) {
    val t = LocalTranslator.current
    val density = LocalDensity.current
    Popup(
        alignment = Alignment.TopCenter,
        offset = IntOffset(0, with(density) { 48.dp.roundToPx() }),
        onDismissRequest = onDismiss,
        properties = PopupProperties(focusable = true),
    ) {
        Column(
            Modifier.width(310.dp).shadow(12.dp, RoundedCornerShape(HcDimens.RadiusSheet)).clip(RoundedCornerShape(HcDimens.RadiusSheet))
                .background(HcColors.White).border(1.dp, HcColors.TanDark, RoundedCornerShape(HcDimens.RadiusSheet)).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                CalendarIconButton("ChevronLeft", t.t("calendar.previousYearAriaLabel"), { onYearChange(year - 1) }, size = 20.dp)
                HcText(year.toString(), HcTypeRoles.Title, Modifier.weight(1f), align = TextAlign.Center, color = HcColors.Black)
                CalendarIconButton("ChevronRight", t.t("calendar.nextYearAriaLabel"), { onYearChange(year + 1) }, size = 20.dp)
            }
            for (row in DA_MONTHS.indices.chunked(3)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (index in row) {
                        val selected = index + 1 == month
                        val shape = RoundedCornerShape(HcDimens.RadiusCard)
                        Box(
                            Modifier.weight(1f).heightIn(min = 44.dp).clip(shape)
                                .background(if (selected) HcColors.SelectedBg else HcColors.Card)
                                .let { if (selected) it.border(2.dp, HcColors.SelectedBorder, shape) else it }
                                .clickable { onSelect(index + 1) }.padding(horizontal = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            HcText(capitalizeFirst(DA_MONTHS[index]), HcTypeRoles.Body, color = if (selected) HcColors.SelectedText else HcColors.Black, maxLines = 1)
                        }
                    }
                }
            }
        }
    }
}

/** MonthlyStatus: the ≥5-day streak star and the month's goal summary. */
@Composable
internal fun MonthlyStatus(status: MonthlyStatusData) {
    val t = LocalTranslator.current
    Column(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (status.streak >= 5) {
            Column(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
                    HcIcon("StarFilled", size = 36.dp, color = HcColors.Green, contentDescription = t.t("calendar.streakAriaLabel", "streak" to status.streak))
                    HcText(status.streak.toString(), HcTypeRoles.Small, bold = true, color = HcColors.White)
                }
                HcText(t.t("calendar.streakMessage", "streak" to status.streak), HcTypeRoles.Body, bold = true, color = HcColors.Black, align = TextAlign.Center)
            }
        }
        GoalStatusSummary(
            status = if (status.remaining >= 0) GoalStatusKind.Met else GoalStatusKind.Missed,
            goalKcal = status.goalSum,
            intakeKcal = status.consumed,
            bonusKcal = status.bonusKcal,
            month = true,
        )
    }
}

@Composable
internal fun MonthView(
    cells: List<LocalDate?>,
    month: Int,
    today: LocalDate,
    totals: Map<LocalDate, Double>,
    goals: GoalLookup,
    goalDates: Set<LocalDate>,
    onOpenDate: (LocalDate) -> Unit,
) {
    val t = LocalTranslator.current
    Column {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Spacer(Modifier.width(14.dp))
            Row(Modifier.weight(1f)) {
                for (key in WEEKDAY_KEYS) {
                    HcText(t.t(key), HcTypeRoles.Small, Modifier.weight(1f), bold = true, color = HcColors.TextSecondary, align = TextAlign.Center)
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for (week in cells.chunked(7)) {
                val anchor = week.firstOrNull { it != null }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // The week number column sits partly in the page margin (-ml-2.5 on the web).
                    Box(Modifier.width(4.dp)) {
                        HcText(
                            anchor?.let { isoWeek(it).toString() } ?: "",
                            HcTypeRoles.Micro,
                            Modifier.requiredWidth(14.dp).offset(x = (-5).dp),
                            bold = true,
                            color = HcColors.Inactive,
                            align = TextAlign.End,
                        )
                    }
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        for (date in week) {
                            Box(Modifier.weight(1f).aspectRatio(1f)) {
                                if (date != null) {
                                    MonthDayCell(date, month, today, totals, goals.effective(date), date in goalDates) { onOpenDate(date) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MonthDayCell(
    date: LocalDate,
    month: Int,
    today: LocalDate,
    totals: Map<LocalDate, Double>,
    goalKcal: Double,
    hasGoal: Boolean,
    onClick: () -> Unit,
) {
    val t = LocalTranslator.current
    val met = dailyGoalMet(totals, date, goalKcal)
    val logged = totals.kcalOn(date) > 0
    val current = date == today
    // Finished days without entries count as missed (÷); today/future are blank.
    val isPast = date < today
    val pastEmpty = !current && !logged && isPast
    val marked = logged || pastEmpty
    val otherMonth = date.monthNumber != month
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    val (background, textColor) = when {
        current -> HcColors.White to HcColors.Black
        otherMonth -> Color.Transparent to HcColors.Inactive
        isPast -> HcColors.Tan to HcColors.Inactive
        else -> HcColors.Tan to HcColors.Black
    }
    val description = longDate(date) +
        (if (current) t.t("calendar.todaySuffix") else "") +
        (if (!marked) "" else if (met) t.t("calendar.goalMetSuffix") else t.t("calendar.goalMissedSuffix")) +
        (if (hasGoal) t.t("calendar.targetDateSuffix") else "")
    Box(
        Modifier.fillMaxSize().clip(shape).background(background)
            .let {
                when {
                    current -> it.border(2.dp, HcColors.Brand, shape)
                    otherMonth -> it.border(1.dp, HcColors.GrayBorder, shape)
                    else -> it
                }
            }
            .clickable(onClickLabel = description, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        HcText(date.dayOfMonth.toString(), HcTypeRoles.Body, bold = !isPast, color = textColor)
        if (hasGoal) {
            CalendarPartyPopperIcon(12.dp, HcColors.Black, Modifier.align(Alignment.TopStart).padding(2.dp))
        }
        if (!current && marked) {
            if (met) {
                HcIcon("Check", Modifier.align(Alignment.TopEnd).padding(2.dp), size = 15.dp, stroke = 3f, color = HcColors.Green)
            } else {
                HcText("÷", HcTypeRoles.Body, Modifier.align(Alignment.TopEnd).padding(end = 4.dp, top = 0.dp), bold = true, color = HcColors.RedMuted)
            }
        }
    }
}

/** One day in the week and list views (the two render identical rows). */
@Composable
internal fun DayRow(
    date: LocalDate,
    today: LocalDate,
    totals: Map<LocalDate, Double>,
    goalKcal: Double,
    minimumKcal: Int,
    hasGoal: Boolean,
    weighIns: List<CalWeighIn>,
    onOpenDate: (LocalDate) -> Unit,
) {
    val t = LocalTranslator.current
    val kcal = totals.kcalOn(date)
    val met = dailyGoalMet(totals, date, goalKcal)
    // An unlogged day is not a missed goal: "Ingen indtastninger" in gray.
    val logged = kcal > 0
    val over = kcal > goalKcal
    val diff = jsRound(kotlin.math.abs(goalKcal - kcal))
    val current = date == today
    val future = date > today
    val tooLow = isIntakeTooLow(kcal, minimumKcal, date < today)
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 66.dp).clip(shape).background(HcColors.Tan).border(1.dp, HcColors.TanDark, shape)
            .clickable { onOpenDate(date) }.padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        HcText(weekdayShort(date).uppercase(), HcTypeRoles.Small, Modifier.width(40.dp), bold = true, color = HcColors.TextSecondary, maxLines = 1)
        val boxShape = RoundedCornerShape(HcDimens.RadiusCard)
        Box(
            Modifier.size(36.dp).clip(boxShape)
                .background(HcColors.White)
                .border(if (current) 2.dp else 1.dp, if (current) HcColors.Brand else HcColors.Gray, boxShape),
            contentAlignment = Alignment.Center,
        ) {
            HcText(
                date.dayOfMonth.toString(),
                HcTypeRoles.Body,
                bold = current || future,
                color = if (current) HcColors.Black else if (future) HcColors.Black else HcColors.Inactive,
            )
        }
        if (future) {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (hasGoal) CalendarPartyPopperIcon(18.dp, HcColors.Black)
                WeighInMark(weighIns)
            }
            HcIcon("ChevronRight", size = 19.dp, color = HcColors.Black)
        } else {
            if (met && !tooLow) HcIcon("Check", size = 16.dp, stroke = 3f, color = HcColors.Green)
            Row(Modifier.weight(1f, fill = false), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                HcText(
                    when {
                        !logged -> t.t("calendar.noEntries")
                        tooLow -> t.t("calendar.intakeTooLow")
                        met -> t.t("calendar.goalMet")
                        else -> t.t("calendar.goalMissed")
                    },
                    HcTypeRoles.Body,
                    bold = tooLow,
                    color = if (tooLow) HcColors.Warning else if (logged) HcColors.Black else HcColors.Inactive,
                )
                if (hasGoal) CalendarPartyPopperIcon(18.dp, HcColors.Black)
                WeighInMark(weighIns)
            }
            Spacer(Modifier.weight(1f))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText(
                    "${if (over) "÷" else "+"}$diff kcal",
                    HcTypeRoles.Body,
                    bold = true,
                    color = when {
                        !logged -> HcColors.Inactive
                        tooLow -> HcColors.Warning
                        over -> HcColors.RedDark
                        else -> HcColors.Green
                    },
                    maxLines = 1,
                )
                HcIcon("ChevronRight", size = 19.dp, color = HcColors.Black)
            }
        }
    }
}

/** The weigh-in mark in week/list rows: only the bathroom-scale icon. */
@Composable
private fun WeighInMark(entries: List<CalWeighIn>) {
    val t = LocalTranslator.current
    val latest = entries.lastOrNull() ?: return
    // The weight itself is only read out (sr-only on the web) and shown in the day view.
    Box(Modifier.semantics { contentDescription = t.t("calendar.weighInSrLabel", "value" to formatKg(latest.weightKg)) }) {
        CalendarBathScaleIcon(18.dp, HcColors.Black)
    }
}

@Composable
internal fun WeekView(
    days: List<LocalDate>,
    today: LocalDate,
    totals: Map<LocalDate, Double>,
    goals: GoalLookup,
    minimumKcal: Int,
    goalDates: Set<LocalDate>,
    weighInsByDate: Map<LocalDate, List<CalWeighIn>>,
    onOpenDate: (LocalDate) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (date in days) {
            DayRow(date, today, totals, goals.effective(date), minimumKcal, date in goalDates, weighInsByDate[date] ?: emptyList(), onOpenDate)
        }
    }
}

/**
 * ListView: the same rows in their own scroll box (max min(60vh, 420px)). A
 * fresh drag that starts AND ends at the bottom/top edge changes week.
 */
@Composable
internal fun ListView(
    days: List<LocalDate>,
    today: LocalDate,
    totals: Map<LocalDate, Double>,
    goals: GoalLookup,
    minimumKcal: Int,
    goalDates: Set<LocalDate>,
    weighInsByDate: Map<LocalDate, List<CalWeighIn>>,
    maxHeight: Dp,
    onOpenDate: (LocalDate) -> Unit,
    onPrevWeek: () -> Unit,
    onNextWeek: () -> Unit,
) {
    val scroll = rememberScrollState()
    val density = LocalDensity.current
    val prev by rememberUpdatedState(onPrevWeek)
    val next by rememberUpdatedState(onNextWeek)
    LaunchedEffect(days.first()) { scroll.scrollTo(0) }
    Column(
        Modifier.fillMaxWidth().heightIn(max = maxHeight)
            .pointerInput(Unit) {
                val threshold = with(density) { 60.dp.toPx() }
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                    val startAtTop = scroll.value <= 0
                    val startAtBottom = scroll.value >= scroll.maxValue
                    var lastY = down.position.y
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        lastY = change.position.y
                        if (!change.pressed) break
                    }
                    val deltaY = down.position.y - lastY
                    val atTop = scroll.value <= 0
                    val atBottom = scroll.value >= scroll.maxValue
                    if (startAtBottom && atBottom && deltaY > threshold) next()
                    else if (startAtTop && atTop && deltaY < -threshold) prev()
                }
            }
            .verticalScroll(scroll),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        for (date in days) {
            DayRow(date, today, totals, goals.effective(date), minimumKcal, date in goalDates, weighInsByDate[date] ?: emptyList(), onOpenDate)
        }
    }
}

/** The week's calorie balance under the rows, with the estimated weight change. */
@Composable
internal fun WeeklyEnergySummaryRow(days: List<LocalDate>, today: LocalDate, totals: Map<LocalDate, Double>, goals: GoalLookup, weightGrams: Double?) {
    val t = LocalTranslator.current
    val summary = computeWeeklyEnergySummary(days, today, totals) { goals.effective(it) } ?: return
    // Same sign as the rows above ("+" = under the goal).
    val goalBalance = -summary.balanceKcal
    val withinGoal = goalBalance >= 0
    Row(Modifier.fillMaxWidth().padding(top = 8.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (weightGrams != null) {
                HcText("∼", HcTypeRoles.Body, color = HcColors.Green)
                HcText(t.t("calendar.weeklyEstimatedWeight", "value" to formatEstimatedWeight(weightGrams)), HcTypeRoles.Body, Modifier.alpha(0.6f), color = HcColors.Black)
            }
        }
        HcText(formatSignedKcal(goalBalance), HcTypeRoles.Body, bold = true, color = if (withinGoal) HcColors.Green else HcColors.RedDark, maxLines = 1)
        Spacer(Modifier.width(19.dp))
    }
}

@Composable
internal fun LowIntakeNotice(minimumKcal: Int) {
    val t = LocalTranslator.current
    Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.padding(top = 4.dp).size(16.dp).clip(RoundedCornerShape(2.dp)).background(HcColors.WarningFill))
        HcText(t.t("calendar.lowIntakeNotice", "minimum" to formatNumber(minimumKcal)), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
    }
}

