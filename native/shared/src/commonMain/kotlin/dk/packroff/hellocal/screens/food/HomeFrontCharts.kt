package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.HcText
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable
import kotlinx.datetime.LocalDate
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.plus
import kotlinx.datetime.daysUntil
import kotlin.math.max
import kotlin.math.min

/**
 * Native port of src/components/frontcharts/FrontCharts.tsx: today's pulse and
 * calorie charts, recommended vs. actual intake, the goal timeline and the
 * action box (+ sheet). Replaces the old white info box (user 2026-10-14).
 */

private const val BUCKET_MIN = 15
private const val GOAL_BAR_DP = 4
/** Same stroke width for every line and stick in the charts (web: LINE_W). */
private const val LINE_DP = 2f
private const val FALLBACK_DAYS = 30
private const val FLOOR_KCAL_FEMALE = 1200.0

@Serializable
private data class MetricDto(val type: String = "", val value: Double = 0.0, val recordedAt: String = "")

@Serializable
private data class MetricsResponse(val metrics: List<MetricDto> = emptyList())

@Serializable
private data class ScheduleDto(val weekday: Int = 0, val bedtime: String = "", val wakeTime: String = "")

@Serializable
private data class SchedulesResponse(val schedules: List<ScheduleDto> = emptyList())

@Serializable
private data class GoalTargetDto(val type: String = "", val value: Double = 0.0)

@Serializable
private data class GoalDto(val createdAt: String = "", val targetDate: String? = null, val targets: List<GoalTargetDto> = emptyList())

@Serializable
private data class GoalsResponse(val goals: List<GoalDto> = emptyList())

@Serializable
private data class WeightDto(val weightKg: Double = 0.0, val weighedAt: String = "")

@Serializable
private data class WeightsResponse(val entries: List<WeightDto> = emptyList())

@Serializable
private data class ProfileUserDto(val recipeProviders: List<String> = emptyList(), val birthDate: String? = null)

@Serializable
private data class ProfileResponse(val user: ProfileUserDto? = null)

private data class ChartData(
    val registrations: List<RegistrationDto> = emptyList(),
    val metrics: List<MetricDto> = emptyList(),
    val schedules: List<ScheduleDto> = emptyList(),
    val goals: List<GoalDto> = emptyList(),
    val weights: List<WeightDto> = emptyList(),
    val budgetKcal: Double = DAILY_KCAL_GOAL,
    val hasHelloFresh: Boolean = false,
    val birthDate: String? = null,
)

private suspend fun loadChartData(): ChartData = coroutineScope {
    val regs = async { runCatching { ApiJson.decodeFromJsonElement(RegistrationsResponse.serializer(), Api.get("/api/registrations")).registrations }.getOrNull() }
    val metrics = async { runCatching { ApiJson.decodeFromJsonElement(MetricsResponse.serializer(), Api.get("/api/health-metrics")).metrics }.getOrNull() }
    val schedules = async { runCatching { ApiJson.decodeFromJsonElement(SchedulesResponse.serializer(), Api.get("/api/sleep-schedule")).schedules }.getOrNull() }
    val goals = async { runCatching { ApiJson.decodeFromJsonElement(GoalsResponse.serializer(), Api.get("/api/goals")).goals }.getOrNull() }
    val weights = async { runCatching { ApiJson.decodeFromJsonElement(WeightsResponse.serializer(), Api.get("/api/weight-entries")).entries }.getOrNull() }
    val budget = async { runCatching { Api.get("/api/profile/activity?tz=${FoodTime.tzOffsetMinutesEast()}").obj("summary").obj("budget").num("budgetKcal") }.getOrNull() }
    val profile = async { runCatching { ApiJson.decodeFromJsonElement(ProfileResponse.serializer(), Api.get("/api/profile")).user }.getOrNull() }
    val user = profile.await()
    ChartData(
        regs.await() ?: emptyList(), metrics.await() ?: emptyList(), schedules.await() ?: emptyList(),
        goals.await() ?: emptyList(), weights.await() ?: emptyList(), budget.await() ?: DAILY_KCAL_GOAL,
        user?.recipeProviders?.contains("hellofresh") == true, user?.birthDate,
    )
}

private fun hourOf(iso: String?): Double? =
    FoodTime.parse(iso)?.let { FoodTime.local(it) }?.let { it.hour + it.minute / 60.0 }

private fun isTodayIso(iso: String?) = FoodTime.isToday(iso)

private fun hourLabel(h: Int) = FoodTime.two(if (h % 24 == 0 && h > 0) 24 else h % 24)

/** Catmull-Rom → cubic Bézier through the points. */
private fun smoothPath(points: List<Offset>): Path {
    val path = Path()
    if (points.isEmpty()) return path
    path.moveTo(points[0].x, points[0].y)
    for (i in 0 until points.size - 1) {
        val p0 = points.getOrElse(i - 1) { points[i] }
        val p1 = points[i]
        val p2 = points[i + 1]
        val p3 = points.getOrElse(i + 2) { p2 }
        path.cubicTo(
            p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
            p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
            p2.x, p2.y,
        )
    }
    return path
}

/** Room above the plot for the number on top of the highest stick (web: PEAK_SPACE). */
private val PEAK_PAD = 11.dp

/** The highest value and where it sits; drawn as a number just above that point (user 2026-10-16). */
private data class Peak(val x: Float, val y: Float, val value: Double)

/**
 * A chart without numbers on the left (user 2026-10-16): only the highest value on top of the
 * highest stick/top, hour captions below ("kl." on the left) and the title in the middle.
 */
@Composable
private fun ColumnScope.ChartFrame(left: String, right: String, title: String, draw: DrawScope.() -> Peak?) {
    val measurer = rememberTextMeasurer()
    val peakStyle = HcTypeRoles.Micro.style(HcColors.TextSecondary)
    // Each chart is lower than its share of the space, leaving air between them.
    Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(0.7f)) {
            Canvas(Modifier.fillMaxWidth().weight(1f)) {
                val peak = draw()
                if (peak != null) {
                    val layout = measurer.measure(peak.value.toInt().toString(), peakStyle)
                    val w = layout.size.width.toFloat()
                    val x = (peak.x - w / 2).coerceIn(0f, max(0f, size.width - w))
                    drawText(layout, topLeft = Offset(x, peak.y - 2.dp.toPx() - layout.size.height))
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                HcText(left, HcTypeRoles.Caption, color = HcColors.TextSecondary)
                HcText(title, HcTypeRoles.Caption, color = HcColors.Text)
                HcText(right, HcTypeRoles.Caption, color = HcColors.TextSecondary)
            }
        }
    }
}

/** Vertical scale: [lo] at the bottom, [hi] PEAK_PAD below the top. */
private fun DrawScope.scaleY(lo: Double, hi: Double): (Double) -> Float {
    val span = max(1.0, hi - lo)
    val pad = PEAK_PAD.toPx()
    return { v -> size.height - ((v - lo) / span).toFloat() * (size.height - pad) }
}

private fun DrawScope.baseline() {
    drawLine(HcColors.Line, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 1f)
}

private fun DrawScope.plotX(count: Int, i: Int) = (i + 0.5f) / count * size.width

@Composable
fun HomeFrontCharts(modifier: Modifier = Modifier) {
    val t = LocalTranslator.current
    var data by remember { mutableStateOf(ChartData()) }
    LaunchedEffect(Unit) { data = loadChartData() }

    val now = FoodTime.local(FoodTime.now())
    val today = FoodTime.today()
    val schedule = data.schedules.firstOrNull { it.weekday == now.dayOfWeek.ordinal }
    val awake = awakeHours(schedule?.wakeTime, schedule?.bedtime)
    val start = awake.start
    val end = awake.end

    val pulse = stickBuckets(
        data.metrics.filter { it.type == "HEART_RATE_BPM" && isTodayIso(it.recordedAt) }
            .mapNotNull { m -> hourOf(m.recordedAt)?.let { it to m.value } },
        start, end, BUCKET_MIN,
    )
    val todays = data.registrations.filter { isTodayIso(it.createdAt) }
    val intake = todays.mapNotNull { r -> hourOf(r.createdAt)?.let { it to r.kcalSnapshot } }
    val budget = data.budgetKcal
    // The calorie chart sums per hour so the recommended curve shows next to the meals (web: KCAL_BUCKET_MIN).
    val hourShares = recommendedShares(start, end, 60)
    val hourSums = sumBuckets(intake, start, end, 60)
    // "kl." in front of the left hour under the x axis (web: frontCharts.clockLeft).
    fun clock(hour: String) = t.t("frontCharts.clockLeft", "hour" to hour)

    Column(modifier) {
      Column(Modifier.fillMaxWidth().weight(1f)) {
        // Pulse: a blue curve through each quarter hour's average, a dashed grey line where
        // moderate intensity starts (web: PulseSticks with zoneBpm); the day's max on top.
        val filled = pulse.filterNotNull()
        val zone = moderatePulseBpm(ageFrom(data.birthDate, today))
        val lo = min(filled.minOfOrNull { it.min } ?: zone, zone)
        val hi = max(filled.maxOfOrNull { it.max } ?: zone, zone)
        ChartFrame(clock(hourLabel(start)), hourLabel(end), t.t("frontCharts.pulse")) {
            baseline()
            val y = scaleY(lo, hi)
            if (filled.isNotEmpty()) {
                drawLine(
                    HcColors.Line, Offset(0f, y(zone)), Offset(size.width, y(zone)), strokeWidth = LINE_DP.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx())),
                )
            }
            val points = filled.map { b -> Offset(plotX(pulse.size, b.index), y((b.min + b.max) / 2)) }
            if (points.size > 1) drawPath(smoothPath(points), HcColors.ChartBlue, style = Stroke(width = LINE_DP.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
            filled.maxByOrNull { it.max }?.let { Peak(plotX(pulse.size, it.index), y(it.max), it.max) }
        }

        // Calories distributed: own intake per hour as blue sticks, the recommended distribution as a grey line.
        val maxSum = hourSums.maxOrNull() ?: 0.0
        val topKcal = max(maxSum, max((hourShares.maxOrNull() ?: 0.0) * budget, 1.0))
        ChartFrame(clock(hourLabel(start)), hourLabel(end), t.t("frontCharts.planVsActual")) {
            baseline()
            val y = scaleY(0.0, topKcal)
            val plan = hourShares.mapIndexed { i, s -> Offset(plotX(hourShares.size, i), y(s * budget)) }
            drawPath(smoothPath(plan), HcColors.Line, style = Stroke(width = LINE_DP.dp.toPx(), cap = StrokeCap.Round))
            hourSums.forEachIndexed { i, v ->
                if (v > 0) {
                    val x = plotX(hourSums.size, i)
                    drawLine(HcColors.ChartBlue, Offset(x, size.height), Offset(x, y(v)), strokeWidth = LINE_DP.dp.toPx(), cap = StrokeCap.Round)
                }
            }
            if (maxSum > 0) Peak(plotX(hourSums.size, hourSums.indexOf(maxSum)), y(maxSum), maxSum) else null
        }

        // Goal timeline: one stick per day/week from the goal's start to its target date;
        // without a dated weight goal the last 30 days (web: FALLBACK_DAYS).
        val weightGoal = data.goals.firstOrNull { g -> g.targetDate != null && g.targets.any { it.type == "weight" } }
        val goalEnd = weightGoal?.targetDate?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() } ?: today
        val goalStart = weightGoal?.let { FoodTime.parse(it.createdAt)?.let { i -> FoodTime.local(i).date } }
            ?: goalEnd.plus(-(FALLBACK_DAYS - 1), DateTimeUnit.DAY)
        run {
            val totalDays = max(1, goalStart.daysUntil(goalEnd) + 1)
            val perDay = HashMap<LocalDate, Double>()
            for (r in data.registrations) {
                val d = FoodTime.parse(r.createdAt)?.let { FoodTime.local(it).date } ?: continue
                perDay[d] = (perDay[d] ?: 0.0) + r.kcalSnapshot
            }
            val days = (0 until totalDays).map { i -> perDay[goalStart.plus(i, DateTimeUnit.DAY)] }
            val boxDp = 170
            val per = daysPerBar(totalDays, max(1, (boxDp - 34) / GOAL_BAR_DP))
            val bars = groupDays(days, per)
            val (recMin, recMax) = recommendedRange(budget, FLOOR_KCAL_FEMALE)
            val measured = bars.filter { it.lowKcal != null && it.highKcal != null }
            val top = max(measured.maxOfOrNull { it.highKcal!! } ?: 0.0, max(recMax, max(budget, 1.0)))
            val bottom = min(measured.minOfOrNull { it.lowKcal!! } ?: recMin, min(recMin, budget))
            ChartFrame(
                "${goalStart.dayOfMonth}/${goalStart.monthNumber}", "${goalEnd.dayOfMonth}/${goalEnd.monthNumber}", t.t(if (per >= 7) "frontCharts.goalWeeks" else "frontCharts.goalDays"),
            ) {
                baseline()
                val y = scaleY(bottom, top)
                drawRect(HcColors.Nav, Offset(0f, y(recMax)), Size(size.width, max(2f, y(recMin) - y(recMax))), alpha = 0.7f)
                drawLine(HcColors.TextSecondary, Offset(0f, y(budget)), Offset(size.width, y(budget)), strokeWidth = LINE_DP.dp.toPx())
                val slots = bars.size
                val barW = LINE_DP.dp.toPx()
                bars.forEachIndexed { i, b ->
                    val low = b.lowKcal ?: return@forEachIndexed
                    val high = b.highKcal ?: return@forEachIndexed
                    val x = plotX(slots, i)
                    drawLine(HcColors.ChartBlue, Offset(x, y(low)), Offset(x, min(y(low) - 1f, y(high))), strokeWidth = barW, cap = StrokeCap.Round)
                }
                // The highest intake on top of its stick, otherwise the goal at the bar's right end.
                val maxHigh = measured.maxOfOrNull { it.highKcal!! }
                val peakIndex = if (maxHigh == null) -1 else bars.indexOfFirst { it.highKcal == maxHigh }
                if (maxHigh != null && peakIndex >= 0) Peak(plotX(slots, peakIndex), y(maxHigh) - barW / 2, maxHigh)
                else Peak(size.width, y(budget), budget)
            }
        }
      }
    }
}
