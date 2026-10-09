package dk.packroff.hellocal.screens.calendar

import dk.packroff.hellocal.ui.formatNumber
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.isoDayNumber
import kotlinx.datetime.toLocalDateTime

// Pure calendar logic ported 1:1 from src/app/calendar/page.tsx and the libs it
// imports (daily-budget, healthy-intake, weekly-energy-summary, pal-model,
// water-display, calendar-measurements). No Compose here.

/** src/lib/goals.ts DAILY_KCAL_GOAL — fallback before the first budget snapshot. */
internal const val DAILY_KCAL_GOAL = 3299.0

internal enum class CalendarView(val value: String, val labelKey: String, val icon: String) {
    Month("month", "calendar.viewMonth", "CalendarMonth"),
    Week("week", "calendar.viewWeek", "CalendarWeek"),
    Listing("list", "calendar.viewList", "LayoutList"),
}

internal enum class SleepAdjustType { Bedtime, Wake }

// ---------- Date grid ----------

internal fun mondayOf(date: LocalDate): LocalDate = date.plusDays(-(date.dayOfWeek.isoDayNumber - 1))

/** ISO-8601 week number (weeks start Monday, week 1 holds the year's first Thursday). */
internal fun isoWeek(date: LocalDate): Int {
    val thursday = date.plusDays(4 - date.dayOfWeek.isoDayNumber)
    return (thursday.dayOfYear - 1) / 7 + 1
}

internal fun daysInMonth(year: Int, month: Int): Int = LocalDate(year, month, 1).plusMonths(1).plusDays(-1).dayOfMonth

/** 42 cells: leading days of the previous month, the month, then empty cells. */
internal fun buildMonthGrid(year: Int, month: Int): List<LocalDate?> {
    val first = LocalDate(year, month, 1)
    val offset = first.dayOfWeek.isoDayNumber - 1
    val cells = mutableListOf<LocalDate?>()
    for (day in offset downTo 1) cells += first.plusDays(-day)
    for (day in 1..daysInMonth(year, month)) cells += LocalDate(year, month, day)
    while (cells.size < 42) cells += null
    return cells
}

// ---------- Daily totals and goals ----------

internal fun dailyTotalsOf(registrations: List<CalRegistration>): Map<LocalDate, Double> {
    val map = mutableMapOf<LocalDate, Double>()
    for (registration in registrations) map[registration.at.date] = (map[registration.at.date] ?: 0.0) + registration.kcal
    return map
}

internal fun Map<LocalDate, Double>.kcalOn(date: LocalDate): Double = this[date] ?: 0.0

/**
 * Daily calorie goal per date (src/lib/daily-budget.ts makeBudgetLookup):
 * own snapshot → latest earlier snapshot → fixed fallback. `effective` adds the
 * day's logged exercise (DECISIONS 2026-10-02) and decides met/not met;
 * `base` is shown as "Mål: X kcal".
 */
internal class GoalLookup(snapshots: List<CalBudget>, private val activityBonus: Map<LocalDate, Double>) {
    private val sorted = snapshots.sortedBy { it.date }

    fun base(date: LocalDate): Double {
        var best: CalBudget? = null
        for (snapshot in sorted) {
            if (snapshot.date > date) break
            best = snapshot
        }
        return best?.budgetKcal ?: DAILY_KCAL_GOAL
    }

    fun bonus(date: LocalDate): Double = activityBonus[date] ?: 0.0

    fun effective(date: LocalDate): Double = base(date) + bonus(date)
}

internal fun activityKcalByDay(activities: List<CalActivity>): Map<LocalDate, Double> {
    val map = mutableMapOf<LocalDate, Double>()
    for (activity in activities) map[activity.at.date] = (map[activity.at.date] ?: 0.0) + activity.caloriesBurned
    return map
}

internal fun dailyGoalMet(totals: Map<LocalDate, Double>, date: LocalDate, goalKcal: Double): Boolean {
    val total = totals.kcalOn(date)
    return total > 0 && total <= goalKcal
}

internal data class MonthlyStatusData(
    val isCurrentMonth: Boolean,
    val consideredDays: Int,
    val metCount: Int,
    val remaining: Double,
    val sevenDayRemaining: Double,
    val streak: Int,
    val goalSum: Double,
    val consumed: Double,
    val bonusKcal: Double,
)

internal fun monthlyStatus(year: Int, month: Int, today: LocalDate, totals: Map<LocalDate, Double>, goals: GoalLookup): MonthlyStatusData {
    val isCurrentMonth = year == today.year && month == today.monthNumber
    val consideredDays = if (isCurrentMonth) today.dayOfMonth else daysInMonth(year, month)
    var consumed = 0.0
    var metCount = 0
    var goalSum = 0.0
    var bonusKcal = 0.0
    for (day in 1..consideredDays) {
        val date = LocalDate(year, month, day)
        val total = totals.kcalOn(date)
        consumed += total
        goalSum += goals.base(date)
        bonusKcal += goals.bonus(date)
        if (total > 0 && total <= goals.effective(date)) metCount += 1
    }
    val remaining = goalSum + bonusKcal - consumed
    var sevenDayConsumed = 0.0
    var sevenDayGoal = 0.0
    for (offset in 0 until 7) {
        sevenDayConsumed += totals.kcalOn(today.plusDays(-offset))
        sevenDayGoal += goals.effective(today.plusDays(-offset))
    }
    var streak = 0
    while (dailyGoalMet(totals, today.plusDays(-streak), goals.effective(today.plusDays(-streak)))) streak += 1
    return MonthlyStatusData(isCurrentMonth, consideredDays, metCount, remaining, sevenDayGoal - sevenDayConsumed, streak, goalSum, consumed, bonusKcal)
}

// ---------- Sleep ----------

internal data class SleepWindow(val bedtime: Double, val wakeTime: Double)

internal fun timeToMinutes(time: String?): Double? {
    if (time.isNullOrEmpty()) return null
    val parts = time.split(":")
    val hours = parts.getOrNull(0)?.toIntOrNull() ?: return null
    val minutes = parts.getOrNull(1)?.toIntOrNull() ?: return null
    return (hours * 60 + minutes).toDouble()
}

/** Snapped to 15 minutes, wrapped to 00:00–23:45, as "HH:MM". */
internal fun minutesToTime(minutes: Double): String {
    val snapped = jsRound(minutes / 15) * 15
    val wrapped = ((snapped % 1440) + 1440) % 1440
    return "${pad2((wrapped / 60).toInt())}:${pad2((wrapped % 60).toInt())}"
}

private const val FALLBACK_SLEEP_MINUTES = 7.5 * 60

/** Day override → weekday pattern → general default; one missing time = 7.5 h from the other. */
internal fun getSleepWindow(
    date: LocalDate,
    defaults: SleepDefaults?,
    weekdaySchedules: Map<Int, SleepScheduleEntry>,
    workShifts: Map<LocalDate, WorkShiftEntry>,
): SleepWindow {
    val override = workShifts[date]
    val perDay = weekdaySchedules[weekdayIndex(date)]
    fun pick(vararg values: String?): String? = values.firstOrNull { !it.isNullOrEmpty() }
    val bedtime = timeToMinutes(pick(override?.bedtime, perDay?.bedtime, defaults?.defaultBedtime))
    val wakeTime = timeToMinutes(pick(override?.wakeTime, perDay?.wakeTime, defaults?.defaultWakeTime))
    if (bedtime != null && wakeTime != null) return SleepWindow(bedtime, wakeTime)
    if (bedtime != null) return SleepWindow(bedtime, (bedtime + FALLBACK_SLEEP_MINUTES) % 1440)
    if (wakeTime != null) return SleepWindow((wakeTime - FALLBACK_SLEEP_MINUTES + 1440) % 1440, wakeTime)
    return SleepWindow(23.0 * 60, (23 * 60 + FALLBACK_SLEEP_MINUTES) % 1440)
}

/** A bedtime 00:00–03:59 before the wake time still belongs to the evening. */
internal const val LATE_BEDTIME_CUTOFF_MINUTES = 4.0 * 60

internal fun isDaytimeSleep(window: SleepWindow): Boolean =
    window.bedtime < window.wakeTime && window.bedtime >= LATE_BEDTIME_CUTOFF_MINUTES

/** Where the bedtime handle sits on the 00–24 timeline: after-midnight bedtimes pin to the bottom. */
internal fun bedtimeDisplayMinutes(window: SleepWindow): Double =
    if (window.bedtime < LATE_BEDTIME_CUTOFF_MINUTES && !isDaytimeSleep(window)) 24.0 * 60 else window.bedtime

// ---------- Energy (src/lib/weekly-energy-summary.ts, pal-model.ts, healthy-intake.ts) ----------

internal const val ENABLE_WEEKLY_ENERGY_SUMMARY = true
private const val KCAL_PER_KG_ESTIMATE = 7700.0
private const val SEDENTARY_FACTOR = 1.2
private const val MIN_ESTIMATE_DAYS = 3
private const val ADAPTIVE_WINDOW_DAYS = 28
private const val ADAPTIVE_MIN_LOGGED_DAYS = 14
private const val ADAPTIVE_MIN_WEIGH_INS = 3
private const val ADAPTIVE_MIN_WEIGHT_SPAN_DAYS = 14.0
private const val ADAPTIVE_MIN_RATIO_TO_FORMULA = 0.7
private const val ADAPTIVE_MAX_RATIO_TO_FORMULA = 1.4
private const val DAY_MS = 24.0 * 60 * 60 * 1000
private const val CHILD_AGE_LIMIT = 18
private const val PAL_MIN = 1.2
private const val PAL_MAX = 2.0
private const val STEPS_MAX_DAILY_PAL_SHIFT = 0.15

/** src/lib/pal-model.ts PAL_LEVELS representative values. */
private fun activityLevelFactor(level: String?): Double? = when (level) {
    "VERY_LOW" -> 1.3
    "LOW" -> 1.45
    "MODERATE" -> 1.65
    "HIGH" -> 1.85
    "VERY_HIGH" -> 2.0
    else -> null
}

private fun everydayFactor(profile: EnergyProfile?): Double =
    profile?.palBase ?: activityLevelFactor(profile?.activityLevel) ?: SEDENTARY_FACTOR

private fun round2(value: Double): Double = jsRound(value * 100) / 100.0

private fun stepPal(steps: Double): Double = when {
    steps < 3000 -> 1.3
    steps < 5000 -> 1.4
    steps < 7500 -> 1.5
    steps < 10000 -> 1.6
    steps < 15000 -> 1.75
    else -> 1.9
}

private fun stepsAdjustedPal(basePal: Double, steps: Double?): Double {
    if (steps == null || !(steps >= 0)) return basePal
    val shift = max(-STEPS_MAX_DAILY_PAL_SHIFT, min(STEPS_MAX_DAILY_PAL_SHIFT, stepPal(steps) - basePal))
    return round2(min(PAL_MAX, max(PAL_MIN, basePal + shift)))
}

private fun maintenanceKcal(bmr: Double, pal: Double, allowance: Double, logged: Double, measured: Double?): Double {
    if (measured != null && measured > 0) return bmr + measured
    return bmr * pal + (if (logged > 0) logged else allowance)
}

internal class DeviceDayData(val activeKcalByDay: Map<LocalDate, Double>, val stepsByDay: Map<LocalDate, Double>)

/** Per day and type: summed per source, the highest source wins. */
internal fun deviceDataByDay(metrics: List<CalMetric>): DeviceDayData {
    val perSource = mutableMapOf<Pair<String, LocalDate>, MutableMap<String, Double>>()
    for (metric in metrics) {
        if (metric.type != "ACTIVE_ENERGY_KCAL" && metric.type != "STEPS") continue
        val bySource = perSource.getOrPut(metric.type to metric.at.date) { mutableMapOf() }
        val source = metric.source ?: ""
        bySource[source] = (bySource[source] ?: 0.0) + metric.value
    }
    val active = mutableMapOf<LocalDate, Double>()
    val steps = mutableMapOf<LocalDate, Double>()
    for ((key, bySource) in perSource) {
        val best = bySource.values.maxOrNull() ?: continue
        if (best <= 0) continue
        if (key.first == "STEPS") steps[key.second] = best else active[key.second] = best
    }
    return DeviceDayData(active, steps)
}

private fun dayMaintenance(bmr: Double, profile: EnergyProfile?, loggedKcal: Double, device: DeviceDayData?, day: LocalDate): Double {
    val measured = device?.activeKcalByDay?.get(day)
    val steps = device?.stepsByDay?.get(day)
    val pal = if (measured != null && measured != 0.0) everydayFactor(profile) else stepsAdjustedPal(everydayFactor(profile), steps)
    return maintenanceKcal(bmr, pal, profile?.trainingAllowanceKcal ?: 0.0, loggedKcal, measured)
}

/** Resting metabolic rate: Mifflin-St Jeor for adults, Schofield under 18. */
internal fun estimateBmr(profile: EnergyProfile): Double? {
    val weight = profile.weightKg?.takeIf { it != 0.0 } ?: return null
    val height = profile.heightCm?.takeIf { it != 0.0 } ?: return null
    val age = profile.age ?: return null
    val sex = profile.sex?.takeIf { it.isNotEmpty() } ?: return null
    if (age < CHILD_AGE_LIMIT) return schofieldBmr(weight, height / 100, age, sex)
    val base = 10 * weight + 6.25 * height - 5 * age
    return if (sex == "MALE") base + 5 else base - 161
}

private fun schofieldBmr(w: Double, h: Double, age: Int, sex: String): Double {
    if (sex == "MALE") {
        if (age < 3) return 0.167 * w + 1517.4 * h - 617.6
        if (age < 10) return 19.59 * w + 130.3 * h + 414.9
        return 16.25 * w + 137.2 * h + 515.5
    }
    if (age < 3) return 16.252 * w + 1023.2 * h - 413.5
    if (age < 10) return 16.97 * w + 161.8 * h + 371.2
    return 8.365 * w + 465 * h + 200
}

/** Latest weigh-in on or before [limitMs], else the profile weight. */
internal fun weightAt(weighIns: List<CalWeighIn>, limitMs: Long, fallbackKg: Double?): Double? {
    var best: CalWeighIn? = null
    for (entry in weighIns) {
        if (entry.epochMs > limitMs) continue
        if (best == null || entry.epochMs > best.epochMs) best = entry
    }
    return best?.weightKg ?: fallbackKg
}

/** src/lib/healthy-intake.ts minimumHealthyKcal. */
internal fun minimumHealthyKcal(profile: EnergyProfile?): Int {
    val isChild = profile?.age != null && profile.age < CHILD_AGE_LIMIT
    val floorKcal = if (isChild) 0.0 else if (profile?.sex == "MALE") 1500.0 else 1200.0
    val bmr = profile?.let { estimateBmr(it) }
    return (ceil(max(floorKcal, bmr ?: 0.0) / 10) * 10).toInt()
}

internal fun isIntakeTooLow(kcal: Double, minimumKcal: Int, isPastDay: Boolean): Boolean = isPastDay && kcal > 0 && kcal < minimumKcal

internal class WeeklyEnergySummary(val balanceKcal: Double, val countedDays: Int)

/** Only days up to today with registrations count (an empty day is missing data, not a deficit). */
internal fun computeWeeklyEnergySummary(days: List<LocalDate>, today: LocalDate, totals: Map<LocalDate, Double>, reference: (LocalDate) -> Double): WeeklyEnergySummary? {
    var balance = 0.0
    var counted = 0
    for (date in days) {
        if (date > today) continue
        val kcal = totals.kcalOn(date)
        if (kcal <= 0) continue
        balance += kcal - reference(date)
        counted += 1
    }
    return if (counted > 0) WeeklyEnergySummary(balance, counted) else null
}

private fun estimateAdaptiveMaintenance(totals: Map<LocalDate, Double>, weighIns: List<CalWeighIn>, endExclusive: LocalDate, formulaMaintenance: Double?): Double? {
    val startDate = endExclusive.plusDays(-ADAPTIVE_WINDOW_DAYS)
    val startMs = endExclusive.startMs() - (ADAPTIVE_WINDOW_DAYS * DAY_MS).toLong()
    var intakeSum = 0.0
    var loggedDays = 0
    for (offset in 0 until ADAPTIVE_WINDOW_DAYS) {
        val kcal = totals.kcalOn(startDate.plusDays(offset))
        if (kcal <= 0) continue
        intakeSum += kcal
        loggedDays += 1
    }
    if (loggedDays < ADAPTIVE_MIN_LOGGED_DAYS) return null
    val points = weighIns
        .map { (it.epochMs - startMs) / DAY_MS to it.weightKg }
        .filter { it.first >= 0 && it.first < ADAPTIVE_WINDOW_DAYS }
    if (points.size < ADAPTIVE_MIN_WEIGH_INS) return null
    val xs = points.map { it.first }
    if (xs.max() - xs.min() < ADAPTIVE_MIN_WEIGHT_SPAN_DAYS) return null
    val meanX = xs.sum() / points.size
    val meanY = points.sumOf { it.second } / points.size
    var covariance = 0.0
    var variance = 0.0
    for ((x, y) in points) {
        covariance += (x - meanX) * (y - meanY)
        variance += (x - meanX) * (x - meanX)
    }
    if (variance == 0.0) return null
    val maintenance = intakeSum / loggedDays - (covariance / variance) * KCAL_PER_KG_ESTIMATE
    if (!maintenance.isFinite() || maintenance <= 0) return null
    if (formulaMaintenance != null) {
        val ratio = maintenance / formulaMaintenance
        if (ratio < ADAPTIVE_MIN_RATIO_TO_FORMULA || ratio > ADAPTIVE_MAX_RATIO_TO_FORMULA) return null
    }
    return maintenance
}

private fun formulaMaintenanceEstimate(bmr: Double?, activities: List<CalActivity>, profile: EnergyProfile?, device: DeviceDayData?): Double? {
    if (bmr == null) return null
    val byDay = activityKcalByDay(activities)
    val end = Clock.System.now().toLocalDateTime(calTz).date
    var sum = 0.0
    for (offset in 1..ADAPTIVE_WINDOW_DAYS) {
        val day = end.plusDays(-offset)
        sum += dayMaintenance(bmr, profile, byDay[day] ?: 0.0, device, day)
    }
    return sum / ADAPTIVE_WINDOW_DAYS
}

/** Energy-based weight estimate for the shown week (always labelled "Estimeret"). */
internal fun estimateWeekWeightGrams(
    days: List<LocalDate>,
    today: LocalDateTime,
    totals: Map<LocalDate, Double>,
    weighIns: List<CalWeighIn>,
    activities: List<CalActivity>,
    profile: EnergyProfile?,
    device: DeviceDayData,
): Double? {
    if (profile == null) return null
    val weekEnd = days.last().plusDays(1)
    val asOf = if (weekEnd < today.date) weekEnd else today.date
    val bmr = estimateBmr(profile.copy(weightKg = weightAt(weighIns, asOf.startMs(), profile.weightKg)))
    val adaptive = estimateAdaptiveMaintenance(totals, weighIns, asOf, formulaMaintenanceEstimate(bmr, activities, profile, device))
    if (adaptive == null && bmr == null) return null
    val activityByDay = activityKcalByDay(activities)
    var balance = 0.0
    var counted = 0
    for (date in days) {
        if (date >= today.date) continue
        val kcal = totals.kcalOn(date)
        if (kcal <= 0) continue
        val maintenance = adaptive ?: dayMaintenance(bmr!!, profile, activityByDay[date] ?: 0.0, device, date)
        balance += kcal - maintenance
        counted += 1
    }
    if (counted < MIN_ESTIMATE_DAYS) return null
    return balance / KCAL_PER_KG_ESTIMATE * 1000
}

/** "+1.234 kcal" / "÷250 kcal" ("÷" is the calendar's minus). */
internal fun formatSignedKcal(value: Double): String {
    val rounded = jsRound(value)
    val sign = if (rounded > 0) "+" else if (rounded < 0) "÷" else ""
    return "$sign${formatNumber(abs(rounded).toDouble())} kcal"
}

internal fun formatEstimatedWeight(grams: Double): String {
    val rounded = jsRound(grams / 10) * 10
    val sign = if (rounded > 0) "+" else if (rounded < 0) "-" else ""
    if (abs(rounded) >= 1000) return "$sign${formatNumber(abs(rounded) / 1000.0, 2)} kg"
    return "$sign${formatNumber(abs(rounded).toDouble())} g"
}

// ---------- Water (src/lib/water-display.ts) ----------

private val WATER_TITLE = Regex("(^|\\s)(flaske|kilde|mineral|dansk|poste|drikke)?vand\\b|(^|\\s)water\\b|(^|\\s)aqua\\b", RegexOption.IGNORE_CASE)

internal fun isWaterRegistration(registration: CalRegistration): Boolean {
    if (jsRound(registration.kcal) != 0L) return false
    if (WATER_TITLE.containsMatchIn(registration.title)) return true
    return registration.isDrink
}

internal fun waterRegistrationMl(registration: CalRegistration): Double = registration.amountGrams?.takeIf { it > 0 } ?: 0.0

internal fun formatCl(ml: Double): String {
    val cl = ml / 10
    val digits = if (cl == floor(cl) || cl >= 10) 0 else 1
    return "${formatNumber(cl, digits)} cl"
}

/** formatKg in page.tsx: up to one decimal. */
internal fun formatKg(value: Double): String = formatNumber(value, 1)

/** src/lib/calendar-measurements.ts formatWeightKg: always one decimal + " kg". */
internal fun formatWeightKg(value: Double): String = "${formatNumber(value, 1, minDecimals = 1)} kg"

private val SOURCE_ICON_SLUGS = setOf("apple-health", "garmin", "google-health", "health-connect", "polar-flow", "samsung-health", "strava", "withings")

/** Logo of the smart scale/app that delivered the measurement (mirror of integrationIconForSource on web). */
internal fun integrationIconForSource(source: String?): String? {
    if (source == null) return null
    val slug = if (source == "FITBIT") "google-health" else source.lowercase().replace('_', '-')
    return if (slug in SOURCE_ICON_SLUGS) "/integrations/$slug.png" else null
}

internal fun formatGoalValue(value: Double): String = formatNumber(value, 1)

// ---------- Measurements (src/lib/calendar-measurements.ts) ----------

internal class MeasurementType(val type: String, val unit: String, val digits: Int)

internal val MEASUREMENT_TYPES = listOf(
    MeasurementType("BODY_FAT_PERCENT", "%", 1),
    MeasurementType("FAT_MASS_KG", "kg", 1),
    MeasurementType("FAT_FREE_MASS_KG", "kg", 1),
    MeasurementType("MUSCLE_MASS_KG", "kg", 1),
    MeasurementType("SKELETAL_MUSCLE_MASS_KG", "kg", 1),
    MeasurementType("BONE_MASS_KG", "kg", 1),
    MeasurementType("BODY_WATER_PERCENT", "%", 1),
    MeasurementType("EXTRACELLULAR_WATER_KG", "kg", 1),
    MeasurementType("INTRACELLULAR_WATER_KG", "kg", 1),
    MeasurementType("VISCERAL_FAT_INDEX", "", 0),
    MeasurementType("PROTEIN_PERCENT", "%", 1),
    MeasurementType("BASAL_METABOLIC_RATE_KCAL", "kcal", 0),
    MeasurementType("METABOLIC_AGE_YEARS", "år", 0),
    MeasurementType("BMI", "", 1),
    MeasurementType("HEIGHT_CM", "cm", 0),
    MeasurementType("BLOOD_PRESSURE_SYSTOLIC_MMHG", "mmHg", 0),
    MeasurementType("BLOOD_PRESSURE_DIASTOLIC_MMHG", "mmHg", 0),
    MeasurementType("HEART_RATE_BPM", "bpm", 0),
    MeasurementType("PULSE_WAVE_VELOCITY_M_S", "m/s", 1),
    MeasurementType("VASCULAR_AGE_YEARS", "år", 0),
    MeasurementType("OXYGEN_SATURATION_PERCENT", "%", 0),
    MeasurementType("TEMPERATURE_C", "°C", 1),
    MeasurementType("SKIN_TEMPERATURE_C", "°C", 1),
    MeasurementType("BLOOD_GLUCOSE_MMOL_L", "mmol/l", 1),
    MeasurementType("NERVE_HEALTH_SCORE", "", 0),
    MeasurementType("SKIN_CONDUCTANCE_US", "µS", 1),
)
private val MEASUREMENT_ORDER = MEASUREMENT_TYPES.mapIndexed { index, type -> type.type to index }.toMap()
private const val SAME_MEASUREMENT_MS = 2 * 60 * 1000L

internal class CalendarMeasurement(
    val id: String,
    val time: LocalDateTime,
    val epochMs: Long,
    val weightKg: Double?,
    var source: String?,
    val metrics: MutableList<CalMetric>,
)

internal fun measurementsForDay(weighIns: List<CalWeighIn>, metrics: List<CalMetric>, day: LocalDate): List<CalendarMeasurement> {
    val items = weighIns.filter { it.at.date == day }
        .map { CalendarMeasurement("weight-${it.id}", it.at, it.epochMs, it.weightKg, it.source, mutableListOf()) }
        .toMutableList()
    val samples = metrics
        .filter { it.type in MEASUREMENT_ORDER && !it.recordedAt.endsWith("T00:00:00.000Z") && it.at.date == day }
        .sortedBy { it.recordedAt }
    for (metric in samples) {
        val match = items.firstOrNull { item ->
            abs(item.epochMs - metric.epochMs) <= SAME_MEASUREMENT_MS && item.metrics.none { it.type == metric.type }
        }
        if (match != null) {
            match.metrics += metric
            if (match.source == null && metric.source != null) match.source = metric.source
        } else {
            items += CalendarMeasurement(
                "metric-${metric.id ?: "${metric.type}-${metric.recordedAt}"}",
                metric.at,
                metric.epochMs,
                null,
                metric.source,
                mutableListOf(metric),
            )
        }
    }
    for (item in items) item.metrics.sortBy { MEASUREMENT_ORDER[it.type] ?: 0 }
    return items.sortedBy { it.epochMs }
}

internal fun formatMeasurementValue(metric: CalMetric): String {
    val spec = MEASUREMENT_TYPES.firstOrNull { it.type == metric.type }
    val formatted = formatNumber(metric.value, spec?.digits ?: 1)
    return if (!spec?.unit.isNullOrEmpty()) "$formatted ${spec!!.unit}" else formatted
}

// ---------- Goals (målsætninger) ----------

internal fun goalTargetNameKey(type: String): String = when (type) {
    "weight" -> "goals.weight"
    "chestCm" -> "bodyMeasurements.names.chest"
    "waistCm" -> "bodyMeasurements.names.waist"
    "hipCm" -> "bodyMeasurements.names.hip"
    "upperArmCm" -> "bodyMeasurements.names.upperArm"
    "thighCm" -> "bodyMeasurements.names.thigh"
    "bodyFatPercent" -> "goals.composition.bodyFatPercent"
    "muscleMassKg" -> "goals.composition.muscleMassKg"
    else -> type
}

/** The target shown in the circle: the weight if the goal has one, else the first. */
internal fun primaryGoalTarget(goal: CalGoal): CalGoalTarget? = goal.targets.firstOrNull { it.type == "weight" } ?: goal.targets.firstOrNull()

/** A goal has only a date, so the day view shows it at 12:00. */
internal const val GOAL_HOUR = 12

// ---------- Sport icons (src/lib/sport-icons.ts) ----------

private val SPORT_ICONS = mapOf(
    "running" to "Run", "trail_running" to "Run", "orienteering" to "Run", "obstacle_race" to "Run",
    "treadmill" to "Treadmill", "cycling" to "Bike", "spinning" to "Bike", "mountain_biking" to "Bike", "ebike" to "Bike",
    "walking" to "Walk", "nordic_walking" to "Trekking", "hiking" to "Mountain", "dog_walking" to "Dog",
    "stair_climbing" to "StairsUp", "climbing" to "Mountain", "swimming" to "Swimming", "open_water" to "Swimming",
    "water_polo" to "Swimming", "aqua_fitness" to "Pool", "rowing" to "Kayak", "rowing_machine" to "Kayak",
    "kayaking" to "Kayak", "canoeing" to "Kayak", "sup" to "Kayak", "surfing" to "WaveSine", "windsurfing" to "Sailboat",
    "cardio" to "Heartbeat", "hiit" to "Heartbeat", "circuit" to "Heartbeat", "elliptical" to "Heartbeat", "aerobics" to "Heartbeat",
    "strength" to "Barbell", "crossfit" to "Barbell", "bootcamp" to "Barbell", "kettlebell" to "Barbell",
    "bodyweight" to "Gymnastics", "jump_rope" to "JumpRope", "trampoline" to "Gymnastics", "yoga" to "Yoga",
    "pilates" to "Stretching", "dance" to "Music", "zumba" to "Music", "ballet" to "Music", "boxing" to "Karate",
    "kickboxing" to "Karate", "martial_arts" to "Karate", "wrestling" to "Karate", "fencing" to "Swords",
    "football" to "BallFootball", "handball" to "PlayHandball", "basketball" to "BallBasketball", "volleyball" to "BallVolleyball",
    "floorball" to "Activity", "ice_hockey" to "IceSkating", "rugby" to "Activity", "ultimate" to "Disc",
    "tennis" to "BallTennis", "padel" to "BallTennis", "badminton" to "BallTennis", "squash" to "BallTennis",
    "table_tennis" to "PingPong", "golf" to "Golf", "ski" to "Snowflake", "cross_country_ski" to "Snowflake",
    "snowboard" to "Snowboarding", "ice_skating" to "IceSkating", "snow_shoveling" to "Shovel",
    "inline_skating" to "Skateboarding", "skateboarding" to "Skateboarding", "horse_riding" to "Horse",
    "gardening" to "Plant", "woodcutting" to "Axe", "moving" to "Box", "housework" to "Home",
    "playing_kids" to "MoodKid", "other" to "Activity",
)

internal fun sportIcon(sportType: String): String = SPORT_ICONS[sportType] ?: "Activity"

// ---------- Open day (src/lib/calendar-open-day.ts) ----------

/**
 * The day open in the day view survives leaving /calendar (opening a
 * registration, tapping another tab) for 6 hours — the web keeps it in the
 * URL and sessionStorage; the app keeps it in memory for the session.
 */
internal object CalendarOpenDay {
    private const val MAX_AGE_MS = 6 * 60 * 60 * 1000L
    private var date: LocalDate? = null
    private var savedAt: Long = 0

    fun read(): LocalDate? {
        val stored = date ?: return null
        return if (Clock.System.now().toEpochMilliseconds() - savedAt <= MAX_AGE_MS) stored else null
    }

    fun sync(value: LocalDate?) {
        date = value
        savedAt = Clock.System.now().toEpochMilliseconds()
    }
}

/** "YYYY-MM-DD" → local date, or null. */
internal fun parseDateKey(value: String?): LocalDate? = value?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

/** Local date + minutes → the ISO instant string the API stores. */
internal fun isoInstant(date: LocalDate, minutes: Int): String = toIsoInstant(date.at(minutes / 60, minutes % 60))

internal fun toIsoInstant(time: LocalDateTime): String = Instant.fromEpochMilliseconds(time.epochMs()).toString()
