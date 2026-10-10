package dk.packroff.hellocal.screens.calendar

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import dk.packroff.hellocal.screens.food.PulseCalendar
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.app.BackHandler
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.food.AddMenuSheet
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.ui.HcAppBar
import kotlin.math.abs
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime

/** Settings → Visning → Kalendervisning (src/lib/calendar-view-pref.ts), same key as the web's localStorage. */
private const val CALENDAR_VIEW_STORAGE_KEY = "hellocal.kalender.defaultView"

private data class PeriodKey(val view: CalendarView, val date: LocalDate, val next: Boolean)

/** Native port of src/app/calendar/page.tsx. */
@Composable
fun CalendarScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val today = remember { nowLocal() }
    val todayDate = today.date

    // Initial view: a day left open recently (?date= or the in-memory open day)
    // reopens; "Dag" as default view (or ?view=day) opens today's day view over
    // the month; otherwise the preferred view.
    val defaultView = remember { NativeHooks.secureStorage.get(CALENDAR_VIEW_STORAGE_KEY) ?: "month" }
    val reopened = remember { parseDateKey(args.opt("date")) ?: CalendarOpenDay.read() }
    val forcedDay = args.opt("view") == "day"
    var visibleDate by remember { mutableStateOf(reopened ?: todayDate) }
    var selectedDate by remember { mutableStateOf(reopened ?: if (defaultView == "day" || forcedDay) todayDate else null) }
    var view by remember {
        mutableStateOf(
            if (reopened != null || defaultView == "day" || forcedDay) CalendarView.Month
            else CalendarView.entries.firstOrNull { it.value == defaultView } ?: CalendarView.Month,
        )
    }
    var monthMenuOpen by remember { mutableStateOf(false) }
    var viewMenuOpen by remember { mutableStateOf(false) }
    var slideNext by remember { mutableStateOf(true) }
    // "Tilføj" on an hour in the week timeline opens the add menu as a bottom sheet (AddMenuSheet).
    var addTarget by remember { mutableStateOf<Pair<LocalDate, String>?>(null) }

    // Mirror the open day so it survives leaving the page (src/lib/calendar-open-day.ts).
    val hadOpenDay = remember { mutableStateOf(false) }
    LaunchedEffect(selectedDate) {
        if (selectedDate == null && !hadOpenDay.value) return@LaunchedEffect
        hadOpenDay.value = selectedDate != null
        CalendarOpenDay.sync(selectedDate)
    }

    var registrations by remember { mutableStateOf<List<CalRegistration>>(emptyList()) }
    var registrationsLoading by remember { mutableStateOf(true) }
    var registrationsError by remember { mutableStateOf(false) }
    var activities by remember { mutableStateOf<List<CalActivity>>(emptyList()) }
    var waterEntries by remember { mutableStateOf<List<CalWater>>(emptyList()) }
    var weighIns by remember { mutableStateOf<List<CalWeighIn>>(emptyList()) }
    var metrics by remember { mutableStateOf<List<CalMetric>>(emptyList()) }
    var budgets by remember { mutableStateOf<List<CalBudget>>(emptyList()) }
    var goals by remember { mutableStateOf<List<CalGoal>>(emptyList()) }
    var sleepDefaults by remember { mutableStateOf<SleepDefaults?>(null) }
    var energyProfile by remember { mutableStateOf<EnergyProfile?>(null) }
    var weekdaySchedules by remember { mutableStateOf<Map<Int, SleepScheduleEntry>>(emptyMap()) }
    var workShifts by remember { mutableStateOf<Map<LocalDate, WorkShiftEntry>>(emptyMap()) }

    LaunchedEffect(Unit) {
        launch {
            try {
                registrations = parseRegistrations(Api.get("/api/registrations"))
            } catch (e: Exception) {
                registrationsError = true
            } finally {
                registrationsLoading = false
            }
        }
        launch {
            // The activity summary stores today's budget snapshot first; then all snapshots are read.
            runCatching { Api.get("/api/profile/activity?tz=${tzOffsetMinutesEast()}") }
            runCatching { budgets = parseBudgets(Api.get("/api/daily-budgets")) }
        }
        launch { runCatching { metrics = parseMetrics(Api.get("/api/health-metrics")) } }
        launch { activities = runCatching { parseActivities(Api.get("/api/activities")) }.getOrDefault(emptyList()) }
        launch { runCatching { waterEntries = parseWater(Api.get("/api/water-entries")) } }
        launch { runCatching { goals = parseGoals(Api.get("/api/goals")) } }
        launch { runCatching { weighIns = parseWeighIns(Api.get("/api/weight-entries")) } }
        launch {
            try {
                coroutineScope {
                    val profile = async { Api.get("/api/profile") }
                    val schedule = async { Api.get("/api/sleep-schedule") }
                    val shifts = async { Api.get("/api/work-shifts") }
                    val (defaults, energy) = parseProfile(profile.await(), todayDate)
                    val schedules = parseSchedules(schedule.await())
                    val shiftMap = parseShifts(shifts.await())
                    sleepDefaults = defaults
                    energyProfile = energy
                    weekdaySchedules = schedules
                    workShifts = shiftMap
                }
            } catch (e: Exception) {
                // Same as the web: the calendar works without sleep/energy data.
            }
        }
    }

    val totals = remember(registrations) { dailyTotalsOf(registrations) }
    val activityBonus = remember(activities) { activityKcalByDay(activities) }
    val goalLookup = remember(budgets, activityBonus) { GoalLookup(budgets, activityBonus) }
    val goalsByDate = remember(goals) { goals.filter { it.targetDate != null }.groupBy { it.targetDate!! } }
    val goalDates = goalsByDate.keys
    val weighInsByDate = remember(weighIns) { weighIns.sortedBy { it.epochMs }.groupBy { it.at.date } }
    val device = remember(metrics) { deviceDataByDay(metrics) }
    val minimumKcal = remember(energyProfile, weighIns) {
        minimumHealthyKcal(energyProfile?.let { it.copy(weightKg = weightAt(weighIns, today.epochMs(), it.weightKg)) })
    }
    val year = visibleDate.year
    val month = visibleDate.monthNumber
    val weekDays = remember(visibleDate) { List(7) { mondayOf(visibleDate).plusDays(it) } }
    val monthly = remember(totals, goalLookup, year, month) { monthlyStatus(year, month, todayDate, totals, goalLookup) }

    fun sleepWindowFor(date: LocalDate): SleepWindow = getSleepWindow(date, sleepDefaults, weekdaySchedules, workShifts)

    // A drag on the sleep handle applies straight to that date (the standard pattern is under Profil → Søvn).
    fun requestSleepAdjust(date: LocalDate, type: SleepAdjustType, minutes: Double) {
        val time = minutesToTime(minutes)
        val current = workShifts[date] ?: WorkShiftEntry(date, null, null)
        workShifts = workShifts + (date to if (type == SleepAdjustType.Bedtime) current.copy(bedtime = time) else current.copy(wakeTime = time))
        val body = if (type == SleepAdjustType.Bedtime) mapOf("bedtime" to time) else mapOf("wakeTime" to time)
        scope.launch { runCatching { Api.put("/api/work-shifts/$date", body) } }
    }

    fun handleEntryMoved(registrationId: String, newTime: LocalDateTime) {
        registrations = registrations.map { if (it.id == registrationId) it.copy(at = newTime) else it }
        scope.launch {
            runCatching {
                Api.patch("/api/registrations/$registrationId", mapOf("createdAt" to toIsoInstant(newTime)))
                NativeHooks.onRegistrationChanged()
            }
        }
    }

    fun movePeriod(direction: Int) {
        slideNext = direction == 1
        visibleDate = if (view == CalendarView.Month) LocalDate(year, month, 1).plusMonths(direction) else visibleDate.plusDays(direction * 7)
    }

    fun selectMonth(selected: Int) {
        slideNext = selected >= month
        visibleDate = LocalDate(year, selected, 1)
        monthMenuOpen = false
    }

    fun openDate(date: LocalDate) {
        selectedDate = date
        monthMenuOpen = false
        viewMenuOpen = false
    }

    fun periodLabel(viewFor: CalendarView, date: LocalDate): String {
        if (viewFor == CalendarView.Month) return monthYearLabel(date)
        val monday = mondayOf(date)
        val sunday = monday.plusDays(6)
        return "${dayMonthShort(monday)} – ${dayMonthShort(sunday)} ${sunday.year}"
    }

    // Escape on the web: close the menus and the day view.
    BackHandler(enabled = selectedDate != null) { selectedDate = null }

    BoxWithConstraints(Modifier.fillMaxSize().background(HcColors.Cream)) {
        val isLandscape = maxWidth > maxHeight
        val screenHeight = maxHeight
        // Rotating INTO landscape switches the month view to the week view, once per rotation.
        val wasLandscape = remember { mutableStateOf(false) }
        LaunchedEffect(isLandscape) {
            if (isLandscape && !wasLandscape.value && view == CalendarView.Month) view = CalendarView.Week
            wasLandscape.value = isLandscape
        }
        val showWeekTimeline = isLandscape && view == CalendarView.Week
        val label = periodLabel(view, visibleDate)

        // Footer roots (the calendar tab) show no back arrow.
        val goBack: (() -> Unit)? = if (nav.showBack) {
            { nav.back() }
        } else {
            null
        }
        Column(Modifier.fillMaxSize()) {
            HcAppBar(
                title = if (isLandscape) capitalizeWords(label) else t.t("nav.calendar"),
                back = goBack != null,
                onBack = goBack,
                icon = {
                    CalendarViewMenuButton(
                        active = view,
                        open = viewMenuOpen && selectedDate == null,
                        onToggle = {
                            viewMenuOpen = !viewMenuOpen
                            monthMenuOpen = false
                        },
                        onSelect = {
                            view = it
                            viewMenuOpen = false
                        },
                        onDismiss = { viewMenuOpen = false },
                    )
                },
            )
            Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp)) {
                if (!isLandscape) {
                    PeriodHeader(
                        view = view,
                        label = label,
                        weekNumber = if (view == CalendarView.Week) isoWeek(weekDays.first()) else null,
                        monthMenuOpen = monthMenuOpen,
                        year = year,
                        month = month,
                        onPrevious = { movePeriod(-1) },
                        onNext = { movePeriod(1) },
                        onToggleMonthMenu = {
                            monthMenuOpen = !monthMenuOpen
                            viewMenuOpen = false
                        },
                        onYearChange = { visibleDate = LocalDate(it, month, 1) },
                        onSelectMonth = ::selectMonth,
                        onDismissMonthMenu = { monthMenuOpen = false },
                    )
                }

                MonthlyStatus(monthly)

                val density = LocalDensity.current
                val move by rememberUpdatedState<(Int) -> Unit>(::movePeriod)
                Box(
                    Modifier.fillMaxWidth().let {
                        if (view == CalendarView.Listing) it
                        else it.pointerInput(view) {
                            val threshold = with(density) { 48.dp.toPx() }
                            var total = 0f
                            detectHorizontalDragGestures(
                                onDragStart = { total = 0f },
                                onDragEnd = { if (abs(total) > threshold) move(if (total < 0) 1 else -1) },
                                onHorizontalDrag = { _, amount -> total += amount },
                            )
                        }
                    },
                ) {
                    AnimatedContent(
                        targetState = PeriodKey(view, visibleDate, slideNext),
                        transitionSpec = {
                            if (targetState.view == CalendarView.Listing) {
                                EnterTransition.None togetherWith ExitTransition.None
                            } else if (targetState.next) {
                                (slideInHorizontally { it } + fadeIn()) togetherWith (slideOutHorizontally { -it } + fadeOut())
                            } else {
                                (slideInHorizontally { -it } + fadeIn()) togetherWith (slideOutHorizontally { it } + fadeOut())
                            }
                        },
                    ) { period ->
                        PeriodContent(
                            period = period,
                            today = today,
                            totals = totals,
                            goalLookup = goalLookup,
                            goalDates = goalDates,
                            weighInsByDate = weighInsByDate,
                            registrations = registrations,
                            minimumKcal = minimumKcal,
                            showWeekTimeline = showWeekTimeline,
                            screenHeight = screenHeight,
                            weighIns = weighIns,
                            activities = activities,
                            energyProfile = energyProfile,
                            device = device,
                            onOpenDate = ::openDate,
                            onMove = ::movePeriod,
                            sleepWindowFor = ::sleepWindowFor,
                            onSleepAdjust = ::requestSleepAdjust,
                            onAddAt = { date, time -> addTarget = date to time },
                        )
                    }
                }
                // "Månedens synder" (SINNERS_ENABLED) is switched off on the web too.
            }
        }

        selectedDate?.let { day ->
            key(day) {
                val dayRegistrations = remember(registrations, day) { registrations.filter { it.at.date == day } }
                val dayMeasurements = remember(weighIns, metrics, day) { measurementsForDay(weighIns, metrics, day) }
                val dayActivities = remember(activities, day) { activities.filter { it.at.date == day } }
                val dayWater = remember(waterEntries, day) { waterEntries.filter { it.at.date == day } }
                DayDetails(
                    date = day,
                    today = todayDate,
                    registrations = dayRegistrations,
                    activities = dayActivities,
                    waterEntries = dayWater,
                    measurements = dayMeasurements,
                    onDeleteMetrics = { ids ->
                        val before = metrics
                        metrics = metrics.filter { it.id == null || it.id !in ids }
                        scope.launch {
                            runCatching { Api.delete("/api/health-metrics", mapOf("ids" to ids)) }.onFailure { metrics = before }
                        }
                    },
                    goals = goalsByDate[day] ?: emptyList(),
                    weighIns = weighInsByDate[day] ?: emptyList(),
                    loading = registrationsLoading,
                    error = registrationsError,
                    sleepWindow = sleepWindowFor(day),
                    previousSleepWindow = sleepWindowFor(day.plusDays(-1)),
                    hasHistory = registrations.isNotEmpty(),
                    dayGoalKcal = goalLookup.base(day),
                    screenHeight = screenHeight,
                    activeView = view,
                    viewMenuOpen = viewMenuOpen,
                    onToggleViewMenu = { viewMenuOpen = !viewMenuOpen },
                    onCloseViewMenu = { viewMenuOpen = false },
                    onSelectView = {
                        view = it
                        viewMenuOpen = false
                        selectedDate = null
                    },
                    onSleepAdjust = { type, minutes -> requestSleepAdjust(day, type, minutes) },
                    onEntryMoved = ::handleEntryMoved,
                    onClose = { selectedDate = null },
                    onNavigate = { direction -> selectedDate = selectedDate?.plusDays(direction) },
                )
            }
        }
    }

    addTarget?.let { (date, time) ->
        AddMenuSheet(onClose = { addTarget = null }, date = date.toString(), time = time)
    }

    PulseCalendar.Host()
}

@Composable
private fun PeriodContent(
    period: PeriodKey,
    today: LocalDateTime,
    totals: Map<LocalDate, Double>,
    goalLookup: GoalLookup,
    goalDates: Set<LocalDate>,
    weighInsByDate: Map<LocalDate, List<CalWeighIn>>,
    registrations: List<CalRegistration>,
    minimumKcal: Int,
    showWeekTimeline: Boolean,
    screenHeight: Dp,
    weighIns: List<CalWeighIn>,
    activities: List<CalActivity>,
    energyProfile: EnergyProfile?,
    device: DeviceDayData,
    onOpenDate: (LocalDate) -> Unit,
    onMove: (Int) -> Unit,
    sleepWindowFor: (LocalDate) -> SleepWindow,
    onSleepAdjust: (LocalDate, SleepAdjustType, Double) -> Unit,
    onAddAt: (LocalDate, String) -> Unit,
) {
    val todayDate = today.date
    val days = remember(period.date) { List(7) { mondayOf(period.date).plusDays(it) } }
    val weightGrams = remember(days, totals, weighIns, activities, energyProfile, device) {
        estimateWeekWeightGrams(days, today, totals, weighIns, activities, energyProfile, device)
    }
    val hasLowIntakeDay = days.any { isIntakeTooLow(totals.kcalOn(it), minimumKcal, it < todayDate) }
    Column {
        when (period.view) {
            CalendarView.Month -> MonthView(
                cells = remember(period.date.year, period.date.monthNumber) { buildMonthGrid(period.date.year, period.date.monthNumber) },
                month = period.date.monthNumber,
                today = todayDate,
                totals = totals,
                goals = goalLookup,
                goalDates = goalDates,
                onOpenDate = onOpenDate,
            )
            CalendarView.Week -> if (showWeekTimeline) {
                WeekTimelineView(
                    days = days,
                    today = todayDate,
                    totals = totals,
                    goals = goalLookup,
                    registrations = registrations,
                    goalDates = goalDates,
                    weighInsByDate = weighInsByDate,
                    maxHeight = maxOf(200.dp, screenHeight - 260.dp),
                    onOpenDate = onOpenDate,
                    sleepWindowFor = sleepWindowFor,
                    onSleepAdjust = onSleepAdjust,
                    onAddAt = onAddAt,
                )
            } else {
                WeekView(days, todayDate, totals, goalLookup, minimumKcal, goalDates, weighInsByDate, onOpenDate)
            }
            CalendarView.Listing -> ListView(
                days = days,
                today = todayDate,
                totals = totals,
                goals = goalLookup,
                minimumKcal = minimumKcal,
                goalDates = goalDates,
                weighInsByDate = weighInsByDate,
                maxHeight = minOf(420.dp, screenHeight * 0.6f),
                onOpenDate = onOpenDate,
                onPrevWeek = { onMove(-1) },
                onNextWeek = { onMove(1) },
            )
        }
        val showSummary = ENABLE_WEEKLY_ENERGY_SUMMARY &&
            ((period.view == CalendarView.Week && !showWeekTimeline) || period.view == CalendarView.Listing)
        if (showSummary) WeeklyEnergySummaryRow(days, todayDate, totals, goalLookup, weightGrams)
        if (hasLowIntakeDay && (period.view == CalendarView.Listing || (period.view == CalendarView.Week && !showWeekTimeline))) {
            LowIntakeNotice(minimumKcal)
        }
    }
}
