package dk.packroff.hellocal.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.food.AddMenuSheet
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcAppBar
import dk.packroff.hellocal.ui.CalendarPartyPopperIcon
import dk.packroff.hellocal.ui.CalendarPartyPopperImage
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.localizedDecimals
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime

// DayDetails in src/app/calendar/page.tsx: the full-screen day view over the
// calendar — 00–24 timeline with the night's sleep, one row per hour (kcal,
// water, weigh-ins, exercise, målsætning), long-press "Tilføj", two-finger
// zoom with minute lines and draggable registrations.

private const val MIN_HOUR_HEIGHT = HOUR_HEIGHT
private const val MAX_HOUR_HEIGHT = HOUR_HEIGHT * 4
private const val ZOOM_SENSITIVITY = 220f
private const val HOUR_HEIGHT_STORAGE_KEY = "hellocal.kalender.hourHeight"
private const val VISIT_KEY = "hc_cal_visit"
private const val DAY_TIME_GUTTER = 32
private const val MOVE_ENTRY_HOLD_MS = 500L
private const val MOVE_ENTRY_MOVE_TOLERANCE_DP = 10f

private fun loadStoredHourHeight(): Float {
    val parsed = NativeHooks.secureStorage.get(HOUR_HEIGHT_STORAGE_KEY)?.toFloatOrNull() ?: return HOUR_HEIGHT
    return min(MAX_HOUR_HEIGHT, max(MIN_HOUR_HEIGHT, parsed))
}

private class HourData(
    val registrations: List<CalRegistration>,
    val kcalTotal: Double,
    val activities: List<CalActivity>,
    val waterMl: Double,
    val weighIns: List<CalWeighIn>,
    val weightKg: Double?,
    val hasMeasurement: Boolean,
    val hasEntries: Boolean,
    val hasFood: Boolean,
)

@Composable
internal fun DayDetails(
    date: LocalDate,
    today: LocalDate,
    registrations: List<CalRegistration>,
    activities: List<CalActivity>,
    waterEntries: List<CalWater>,
    measurements: List<CalendarMeasurement>,
    goals: List<CalGoal>,
    weighIns: List<CalWeighIn>,
    loading: Boolean,
    error: Boolean,
    sleepWindow: SleepWindow,
    previousSleepWindow: SleepWindow,
    hasHistory: Boolean,
    dayGoalKcal: Double,
    screenHeight: Dp,
    activeView: CalendarView,
    viewMenuOpen: Boolean,
    onToggleViewMenu: () -> Unit,
    onCloseViewMenu: () -> Unit,
    onSelectView: (CalendarView) -> Unit,
    onSleepAdjust: (SleepAdjustType, Double) -> Unit,
    onEntryMoved: (String, LocalDateTime) -> Unit,
    onClose: () -> Unit,
    onNavigate: (Int) -> Unit,
) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val density = LocalDensity.current
    var addBarHour by remember { mutableStateOf<Int?>(null) }
    var addTarget by remember { mutableStateOf<String?>(null) }
    var openHour by remember { mutableStateOf<Int?>(null) }
    // The target circle shows every time a day with a målsætning is opened (keyed by date).
    var goalPopupDismissed by remember { mutableStateOf(false) }
    var hourHeight by remember { mutableStateOf(loadStoredHourHeight()) }
    var sleepDrag by remember { mutableStateOf<Pair<SleepAdjustType, Double>?>(null) }
    var sleepRating by remember { mutableStateOf<Int?>(null) }
    val timelineScroll = rememberScrollState()
    var viewport by remember { mutableStateOf<Pair<Float, Float>?>(null) }
    var visitedToday by remember { mutableStateOf<Boolean?>(null) }
    val latestWeighIn = weighIns.maxByOrNull { it.epochMs }

    // Oplevelse af søvn: the day's 1–5 rating as a black bar at the top.
    LaunchedEffect(date) {
        val key = date.toString()
        sleepRating = runCatching { Api.get("/api/sleep-quality?from=$key&to=$key") }.getOrNull()
            ?.asObj()?.objects("entries")?.firstOrNull()?.dbl("rating")?.toInt()
    }

    // Screeninger med "Vis i kalenderen": the day's measurements as black bars.
    var screeningBars by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }
    LaunchedEffect(date) {
        val key = date.toString()
        screeningBars = runCatching {
            val names = dk.packroff.hellocal.screens.profile.ScreeningApi.load(t).associateBy { it.id }
            val onCalendar = names.values.filter { it.showInCalendar && it.active }.map { it.id }.toSet()
            dk.packroff.hellocal.screens.profile.ScreeningApi.entriesInRange(key, key)
                .filter { it.screeningId in onCalendar }
                .mapNotNull { entry ->
                    val screening = names[entry.screeningId] ?: return@mapNotNull null
                    entry.id to "${screening.name}: ${dk.packroff.hellocal.screens.profile.formatScreeningValue(entry.value, screening.scale)}"
                }
        }.getOrDefault(emptyList())
    }

    val liveWindow = when (val drag = sleepDrag) {
        null -> sleepWindow
        else -> if (drag.first == SleepAdjustType.Wake) sleepWindow.copy(wakeTime = drag.second) else sleepWindow.copy(bedtime = drag.second)
    }
    // Last night = yesterday's bedtime → today's wake time (daytime sleep counts the day's own band).
    val nightStart = if (isDaytimeSleep(liveWindow) || isDaytimeSleep(previousSleepWindow)) liveWindow.bedtime else previousSleepWindow.bedtime
    val nightSleepMinutes = (liveWindow.wakeTime - nightStart + 1440) % 1440

    // Opening a day: the first visit today shows the morning with the night's sleep;
    // later visits to today show now ±2 hours.
    LaunchedEffect(loading, date) {
        if (loading) return@LaunchedEffect
        val wakeHour = sleepWindow.wakeTime / 60
        val now = nowLocal()
        val todayKey = now.date.toString()
        if (visitedToday == null) {
            visitedToday = NativeHooks.secureStorage.get(VISIT_KEY) == todayKey
            NativeHooks.secureStorage.set(VISIT_KEY, todayKey)
        }
        timelineScroll.scrollWhenReady(0)
        val hourPx = hourHeight * density.density
        val startHour = if (visitedToday == true && hasHistory && date == now.date) {
            val nowHour = now.hour + now.minute / 60.0
            val visibleHours = (viewport?.let { it.second - it.first } ?: 0f) / hourPx
            if (nowHour + 1 - (wakeHour - 1) <= visibleHours) wakeHour - 1 else nowHour - 2
        } else {
            wakeHour - 1
        }
        timelineScroll.scrollTo(max(0, (startHour * hourPx).roundToInt()).coerceAtMost(timelineScroll.maxValue))
    }
    LaunchedEffect(Unit) {
        snapshotFlow { timelineScroll.isScrollInProgress }.collect { if (it) addBarHour = null }
    }

    val dayKcal = registrations.sumOf { it.kcal }
    val dayBonusKcal = activities.sumOf { it.caloriesBurned }
    val hasEntries = registrations.isNotEmpty()
    val met = hasEntries && dayKcal <= dayGoalKcal + dayBonusKcal
    val isFutureDay = date > today

    val hours = remember(registrations, activities, waterEntries, measurements, latestWeighIn) {
        List(24) { hour ->
            val hourRegistrations = registrations.filter { it.at.hour == hour }
            val waterRegistrations = hourRegistrations.filter(::isWaterRegistration)
            val hourWater = waterEntries.filter { it.at.hour == hour }
            // Only the day's latest weigh-in shows in the hour row; all of them in the hour's details.
            val hourWeighIns = if (latestWeighIn != null && latestWeighIn.at.hour == hour) listOf(latestWeighIn) else emptyList()
            val hourMeasurements = measurements.filter { item ->
                item.time.hour == hour && (item.weightKg == null || (latestWeighIn != null && item.id == "weight-${latestWeighIn.id}"))
            }
            HourData(
                registrations = hourRegistrations,
                kcalTotal = hourRegistrations.sumOf { it.kcal },
                activities = activities.filter { it.at.hour == hour },
                waterMl = hourWater.sumOf { it.amountMl } + waterRegistrations.sumOf { waterRegistrationMl(it) },
                weighIns = hourWeighIns,
                weightKg = hourMeasurements.lastOrNull { it.weightKg != null }?.weightKg,
                hasMeasurement = hourMeasurements.isNotEmpty(),
                hasEntries = hourRegistrations.isNotEmpty() || hourWater.isNotEmpty() || hourMeasurements.isNotEmpty(),
                hasFood = hourRegistrations.size > waterRegistrations.size,
            )
        }
    }

    fun goToAddFlow(hour: Double) {
        // The "everything you can add" menu at the tapped hour — opened in the
        // bottom sheet (AddMenuSheet) like the web, not the /add/menu page.
        addTarget = "${pad2(floorInt(hour))}:${if (hour % 1 != 0.0) "30" else "00"}"
    }

    addTarget?.let { time ->
        AddMenuSheet(onClose = { addTarget = null }, date = date.toString(), time = time)
    }

    Box(Modifier.fillMaxSize().blockTouchesBelow().background(HcColors.Cream)) {
        Column(Modifier.fillMaxSize()) {
            HcAppBar(
                title = capitalizeFirst(t.t("nav.calendar")),
                onBack = onClose,
                icon = { CalendarViewMenuButton(activeView, viewMenuOpen, onToggleViewMenu, onSelectView, onCloseViewMenu) },
            )
            // Same date navigation as the week/month views.
            Row(
                Modifier.fillMaxWidth().background(HcColors.Cream).padding(horizontal = 16.dp).padding(top = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CalendarIconButton("ChevronLeft", t.t("calendar.previousDayAriaLabel"), { onNavigate(-1) })
                Box(Modifier.weight(1f, fill = false).heightIn(min = 44.dp).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                    HcText(capitalizeFirst(dayTitle(date)), HcTypeRoles.Body, bold = true, color = HcColors.Black, maxLines = 1)
                }
                CalendarIconButton("ChevronRight", t.t("calendar.nextDayAriaLabel"), { onNavigate(1) })
            }
            sleepRating?.let { rating ->
                Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 16.dp)) {
                    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(HcColors.Black).padding(horizontal = 16.dp, vertical = 8.dp)) {
                        HcText(t.t("sleepQuality.calendarBar", "rating" to rating), HcTypeRoles.Body, Modifier.fillMaxWidth(), bold = true, color = HcColors.White, align = TextAlign.Center)
                        HcText(
                            t.t("sleepStats.calendarLink"),
                            HcTypeRoles.Small,
                            Modifier.align(Alignment.CenterEnd).clickable { nav.push("/statistics/sleep") },
                            color = HcColors.White,
                        )
                    }
                }
            }
            if (screeningBars.isNotEmpty()) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    screeningBars.forEach { (id, text) ->
                        Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(HcColors.Black).clickable { nav.push("/profile/screenings/reports") }.padding(horizontal = 16.dp, vertical = 8.dp)) {
                            HcText(text, HcTypeRoles.Body, Modifier.fillMaxWidth(), bold = true, color = HcColors.White, align = TextAlign.Center)
                        }
                    }
                }
            }
            val swipe = with(density) { 48.dp.toPx() }
            Column(
                Modifier.weight(1f).fillMaxWidth()
                    .pointerInput(Unit) {
                        var total = 0f
                        detectHorizontalDragGestures(
                            onDragStart = { total = 0f },
                            onDragEnd = { if (abs(total) > swipe) onNavigate(if (total < 0) 1 else -1) },
                            onHorizontalDrag = { _, amount -> total += amount },
                        )
                    }
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            ) {
                when {
                    loading -> HcLoader()
                    error -> Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.White).padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        HcText(t.t("calendar.registrationsLoadError"), HcTypeRoles.Body, bold = true, color = HcColors.Black, align = TextAlign.Center)
                        HcText(t.t("calendar.registrationsLoadErrorHint"), HcTypeRoles.Body, Modifier.padding(top = 4.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                    }
                    else -> {
                        HcText(
                            t.t("calendar.hourColumnLabel"),
                            HcTypeRoles.Micro,
                            Modifier.padding(start = 1.dp, bottom = 4.dp).width(DAY_TIME_GUTTER.dp),
                            bold = true,
                            color = HcColors.TextSecondary,
                            align = TextAlign.Center,
                        )
                        Box(
                            Modifier.fillMaxWidth()
                                .heightIn(max = max(240f, screenHeight.value - 340f).dp)
                                .clip(RoundedCornerShape(16.dp))
                                .border(1.dp, HcColors.Tan, RoundedCornerShape(16.dp))
                                .background(HcColors.White)
                                .onGloballyPositioned {
                                    val top = it.positionInWindow().y
                                    viewport = top to top + it.size.height
                                }
                                .pointerInput(Unit) {
                                    // Two fingers moved up/down change the hour height (zoom).
                                    awaitEachGesture {
                                        awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Initial)
                                        var startAvg: Float? = null
                                        var startHeight = hourHeight
                                        var zoomed = false
                                        while (true) {
                                            val event = awaitPointerEvent(PointerEventPass.Initial)
                                            val pressed = event.changes.filter { it.pressed }
                                            if (pressed.isEmpty()) break
                                            if (pressed.size >= 2) {
                                                val avg = (pressed[0].position.y + pressed[1].position.y) / 2
                                                val start = startAvg
                                                if (start == null) {
                                                    startAvg = avg
                                                    startHeight = hourHeight
                                                } else {
                                                    val deltaDp = (avg - start) / density.density
                                                    val next = (startHeight + deltaDp * (HOUR_HEIGHT / ZOOM_SENSITIVITY) * 4).roundToInt().toFloat()
                                                    hourHeight = min(MAX_HOUR_HEIGHT, max(MIN_HOUR_HEIGHT, next))
                                                    zoomed = true
                                                }
                                                event.changes.forEach { it.consume() }
                                            } else {
                                                startAvg = null
                                            }
                                        }
                                        if (zoomed) NativeHooks.secureStorage.set(HOUR_HEIGHT_STORAGE_KEY, hourHeight.roundToInt().toString())
                                    }
                                }
                                .verticalScroll(timelineScroll),
                        ) {
                            DayTimeline(
                                hourHeight = hourHeight,
                                hours = hours,
                                registrations = registrations,
                                goalsToday = goals.isNotEmpty(),
                                liveWindow = liveWindow,
                                sleepWindow = sleepWindow,
                                nightSleepMinutes = nightSleepMinutes,
                                wakeDragging = sleepDrag?.first == SleepAdjustType.Wake,
                                addBarHour = addBarHour,
                                scroll = timelineScroll,
                                viewport = { viewport },
                                onSleepAdjust = onSleepAdjust,
                                onSleepDrag = { type, minutes -> sleepDrag = minutes?.let { type to it } },
                                onCloseAddBar = { addBarHour = null },
                                onLongPress = { addBarHour = it },
                                onOpenDetails = { openHour = it },
                                onTapAddBar = { hour ->
                                    addBarHour = null
                                    goToAddFlow(hour)
                                },
                                onOpenRegistration = { nav.push("/registration/$it") },
                                onEntryMoved = onEntryMoved,
                            )
                        }
                    }
                }

                GoalStatusSummary(
                    status = if (isFutureDay) null else if (hasEntries) (if (met) GoalStatusKind.Met else GoalStatusKind.Missed) else GoalStatusKind.None,
                    goalKcal = dayGoalKcal,
                    intakeKcal = dayKcal,
                    bonusKcal = dayBonusKcal,
                    modifier = Modifier.padding(top = 8.dp, end = 4.dp),
                )
            }
        }

        if (!goalPopupDismissed && goals.isNotEmpty()) {
            GoalPopup(goals.first(), onOpen = { nav.push("/profile/goals") }, onClose = { goalPopupDismissed = true })
        }

        openHour?.let { hour ->
            HourEntriesOverlay(
                hour = hour,
                registrations = registrations.filter { it.at.hour == hour },
                waterEntries = waterEntries.filter { it.at.hour == hour },
                measurements = measurements.filter { it.time.hour == hour },
                goals = if (hour == GOAL_HOUR) goals else emptyList(),
                onClose = { openHour = null },
            )
        }
    }
}

private fun floorInt(value: Double): Int = kotlin.math.floor(value).toInt()

@Composable
private fun DayTimeline(
    hourHeight: Float,
    hours: List<HourData>,
    registrations: List<CalRegistration>,
    goalsToday: Boolean,
    liveWindow: SleepWindow,
    sleepWindow: SleepWindow,
    nightSleepMinutes: Double,
    wakeDragging: Boolean,
    addBarHour: Int?,
    scroll: androidx.compose.foundation.ScrollState,
    viewport: () -> Pair<Float, Float>?,
    onSleepAdjust: (SleepAdjustType, Double) -> Unit,
    onSleepDrag: (SleepAdjustType, Double?) -> Unit,
    onCloseAddBar: () -> Unit,
    onLongPress: (Int) -> Unit,
    onOpenDetails: (Int) -> Unit,
    onTapAddBar: (Double) -> Unit,
    onOpenRegistration: (String) -> Unit,
    onEntryMoved: (String, LocalDateTime) -> Unit,
) {
    val showMinuteLines = hourHeight >= HOUR_HEIGHT * 2
    val minuteStep = if (hourHeight >= HOUR_HEIGHT * 3) 5 else 15
    val hourLine = HcColors.Tan.copy(alpha = 0.6f)
    val minuteLine = HcColors.Tan.copy(alpha = 0.3f)
    Box(Modifier.fillMaxWidth().height((hourHeight * 24).dp)) {
        // Hour labels in the narrow time column (numbers centred).
        for (mark in 0..24) {
            HcText(
                pad2(mark % 24),
                HcTypeRoles.Micro,
                Modifier.offset(y = (mark * hourHeight).dp - 7.dp).width(DAY_TIME_GUTTER.dp),
                bold = true,
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
        }
        Box(
            Modifier.padding(start = DAY_TIME_GUTTER.dp).fillMaxSize().drawBehind {
                val stroke = 1.dp.toPx()
                val hourPx = hourHeight.dp.toPx()
                for (mark in 0..24) drawRect(hourLine, Offset(0f, mark * hourPx), Size(size.width, stroke))
                if (showMinuteLines) {
                    for (mark in 0 until 24) {
                        var minute = minuteStep
                        while (minute < 60) {
                            drawRect(minuteLine, Offset(0f, mark * hourPx + minute / 60f * hourPx), Size(size.width, stroke))
                            minute += minuteStep
                        }
                    }
                }
            },
        ) {
            SleepBands(liveWindow, hourHeight)
            SleepDurationLabel(liveWindow.wakeTime, nightSleepMinutes, hourHeight, belowLine = wakeDragging)
            SleepBoundaryHandle(sleepWindow.wakeTime, SleepAdjustType.Wake, hourHeight, onSleepAdjust, onSleepDrag, scroll, viewport)
            SleepBoundaryHandle(bedtimeDisplayMinutes(sleepWindow), SleepAdjustType.Bedtime, hourHeight, onSleepAdjust, onSleepDrag, scroll, viewport)
            if (addBarHour != null) {
                Box(
                    Modifier.fillMaxSize().zIndex(10f).clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onCloseAddBar,
                    ),
                )
            }
            hours.forEachIndexed { hour, data ->
                HourRow(
                    hour = hour,
                    hourHeight = hourHeight,
                    data = data,
                    hasGoal = hour == GOAL_HOUR && goalsToday,
                    showAddBar = addBarHour == hour,
                    onOpenDetails = onOpenDetails,
                    onLongPress = onLongPress,
                    onTapAddBar = onTapAddBar,
                )
            }
            // Single registrations only once zoom shows minute lines (else the compact view floods).
            if (showMinuteLines) {
                for (registration in registrations) {
                    DraggableEntryMarker(registration, hourHeight, { onOpenRegistration(registration.id) }) { onEntryMoved(registration.id, it) }
                }
            }
        }
    }
}

@Composable
private fun HourRow(
    hour: Int,
    hourHeight: Float,
    data: HourData,
    hasGoal: Boolean,
    showAddBar: Boolean,
    onOpenDetails: (Int) -> Unit,
    onLongPress: (Int) -> Unit,
    onTapAddBar: (Double) -> Unit,
) {
    val t = LocalTranslator.current
    val open by rememberUpdatedState(onOpenDetails)
    val longPress by rememberUpdatedState(onLongPress)
    val addAt by rememberUpdatedState(onTapAddBar)
    val tappable = hasGoal || data.weighIns.isNotEmpty()
    Box(
        Modifier.offset(y = (hour * hourHeight).dp).fillMaxWidth().height(hourHeight.dp)
            .zIndex(if (showAddBar) 20f else 0f)
            .pointerInput(hour, tappable) {
                detectTapGestures(
                    // Double tap opens the add menu at the hour (or half hour).
                    onDoubleTap = { offset -> addAt(hour + if (offset.y >= size.height / 2f) 0.5 else 0.0) },
                    onLongPress = { longPress(hour) },
                    onTap = { if (tappable) open(hour) },
                )
            },
    ) {
        if (data.activities.isNotEmpty() || hasGoal || data.weighIns.isNotEmpty()) {
            Row(
                Modifier.align(Alignment.CenterStart).padding(start = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (hasGoal) CalendarPartyPopperIcon(16.dp, HcColors.Black)
                for (entry in data.weighIns) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        HcIcon("Scale", size = 16.dp, color = HcColors.Black)
                        HcText("${formatKg(entry.weightKg)} kg", HcTypeRoles.Small, bold = true, color = HcColors.Black, maxLines = 1)
                    }
                }
                for (activity in data.activities) {
                    HcIcon(sportIcon(activity.sportType), Modifier.alpha(0.7f), size = 16.dp, color = HcColors.Black, contentDescription = activity.sportType)
                }
                if (data.activities.isNotEmpty()) {
                    EnergyChip(EnergyChipKind.Burned, data.activities.sumOf { it.caloriesBurned }, color = HcColors.Green)
                }
            }
        }
        if (data.hasEntries) {
            Row(
                Modifier.align(Alignment.CenterEnd).fillMaxHeight().clickable { open(hour) }.padding(start = 8.dp, end = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (data.hasFood) EnergyChip(EnergyChipKind.Intake, data.kcalTotal)
                if (data.waterMl > 0) EnergyChip(EnergyChipKind.Water, data.waterMl)
                if (data.hasMeasurement && data.weighIns.isEmpty()) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        HcIcon("Scale", size = 16.dp, color = HcColors.Black)
                        data.weightKg?.let { HcText(formatWeightKg(it), HcTypeRoles.Small, bold = true, color = HcColors.Black, maxLines = 1) }
                    }
                }
                HcIcon("ChevronRight", Modifier.offset(x = (-4).dp).alpha(0.5f), size = 16.dp, color = HcColors.Black)
            }
        }
        if (showAddBar) {
            Box(
                Modifier.fillMaxSize().padding(horizontal = 4.dp, vertical = 2.dp).clip(RoundedCornerShape(6.dp))
                    .background(HcColors.Black).clickable { addAt(hour.toDouble()) },
                contentAlignment = Alignment.Center,
            ) {
                HcText(t.t("nav.add"), HcTypeRoles.Small, bold = true, color = HcColors.White)
            }
        }
    }
}

/**
 * One registration on the timeline (only with minute lines). Tap opens it; a
 * ½ s hold arms "move" (shows time + name), a vertical drag moves it in
 * 5-minute steps and release saves it (PATCH /api/registrations/[id]).
 */
@Composable
private fun DraggableEntryMarker(registration: CalRegistration, hourHeight: Float, onOpen: () -> Unit, onMoved: (LocalDateTime) -> Unit) {
    val density = LocalDensity.current
    val original = minutesFromMidnight(registration.at)
    var dragMinutes by remember(registration.id) { mutableStateOf<Int?>(null) }
    val open by rememberUpdatedState(onOpen)
    val moved by rememberUpdatedState(onMoved)
    val currentHourHeight by rememberUpdatedState(hourHeight)
    val display = dragMinutes ?: original
    Box(
        Modifier.offset(y = (display / 60f * hourHeight).dp).padding(start = 4.dp, end = 56.dp).fillMaxWidth().height(16.dp)
            .zIndex(6f).clip(RoundedCornerShape(6.dp)).background(if (dragMinutes != null) HcColors.Black else HcColors.Green)
            .pointerInput(registration.id, original) {
                val tolerance = MOVE_ENTRY_MOVE_TOLERANCE_DP * density.density
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val startY = down.position.y
                    // "up" = a tap, "moved" = an ordinary scroll, null = held ½ s → move mode.
                    val early = withTimeoutOrNull(MOVE_ENTRY_HOLD_MS) {
                        var result = "up"
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            if (!change.pressed) break
                            if (abs(change.position.y - startY) > tolerance) {
                                result = "moved"
                                break
                            }
                        }
                        result
                    }
                    when (early) {
                        "up" -> open()
                        "moved" -> Unit
                        else -> {
                            dragMinutes = original
                            while (true) {
                                val event = awaitPointerEvent()
                                val change = event.changes.firstOrNull { it.id == down.id } ?: break
                                if (!change.pressed) break
                                change.consume()
                                val deltaMinutes = (change.position.y - startY) / density.density / currentHourHeight * 60
                                val snapped = (jsRound(deltaMinutes / 5.0) * 5).toInt()
                                dragMinutes = min(24 * 60 - 1, max(0, original + snapped))
                            }
                            val final = dragMinutes
                            if (final != null && final != original) moved(registration.at.date.at(final / 60, final % 60))
                            dragMinutes = null
                        }
                    }
                }
            }
            .padding(horizontal = 6.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        HcText(
            localizedDecimals(if (dragMinutes != null) "${minutesToTime(display.toDouble())} · ${registration.title}" else registration.title),
            HcTypeRoles.Micro,
            bold = true,
            color = HcColors.White,
            maxLines = 1,
        )
    }
}

/**
 * The målsætning circle in the middle of the day view (190 px, tan, coloured
 * konfettikanon and the target). Tap opens the goal; tap outside closes it.
 */
@Composable
private fun GoalPopup(goal: CalGoal, onOpen: () -> Unit, onClose: () -> Unit) {
    val t = LocalTranslator.current
    val target = primaryGoalTarget(goal)
    Box(Modifier.fillMaxSize().zIndex(55f), contentAlignment = Alignment.Center) {
        Box(
            Modifier.fillMaxSize().clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClickLabel = t.t("calendar.closeTargetDateAriaLabel"),
                onClick = onClose,
            ),
        )
        Column(
            Modifier.size(190.dp).shadow(16.dp, CircleShape).clip(CircleShape).background(HcColors.Tan)
                .clickable(onClickLabel = t.t("calendar.openTargetDateAriaLabel"), onClick = onOpen),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        ) {
            CalendarPartyPopperImage(72.dp)
            if (target != null) GoalTargetValue(target, HcTypeRoles.BodyLg, bold = true)
        }
    }
}

/** The target value: green when reached, otherwise gray. */
@Composable
internal fun GoalTargetValue(target: CalGoalTarget, role: dk.packroff.hellocal.theme.HcTypeRole = HcTypeRoles.Body, bold: Boolean = false) {
    HcText("${formatGoalValue(target.value)} ${target.unit}", role, bold = bold, color = if (target.completed) HcColors.Green else HcColors.Inactive, maxLines = 1)
}
