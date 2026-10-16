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
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
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
private data class ProfileUserDto(val recipeProviders: List<String> = emptyList())

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
)

private suspend fun loadChartData(): ChartData = coroutineScope {
    val regs = async { runCatching { ApiJson.decodeFromJsonElement(RegistrationsResponse.serializer(), Api.get("/api/registrations")).registrations }.getOrNull() }
    val metrics = async { runCatching { ApiJson.decodeFromJsonElement(MetricsResponse.serializer(), Api.get("/api/health-metrics")).metrics }.getOrNull() }
    val schedules = async { runCatching { ApiJson.decodeFromJsonElement(SchedulesResponse.serializer(), Api.get("/api/sleep-schedule")).schedules }.getOrNull() }
    val goals = async { runCatching { ApiJson.decodeFromJsonElement(GoalsResponse.serializer(), Api.get("/api/goals")).goals }.getOrNull() }
    val weights = async { runCatching { ApiJson.decodeFromJsonElement(WeightsResponse.serializer(), Api.get("/api/weight-entries")).entries }.getOrNull() }
    val budget = async { runCatching { Api.get("/api/profile/activity?tz=${FoodTime.tzOffsetMinutesEast()}").obj("summary").obj("budget").num("budgetKcal") }.getOrNull() }
    val profile = async { runCatching { ApiJson.decodeFromJsonElement(ProfileResponse.serializer(), Api.get("/api/profile")).user }.getOrNull() }
    ChartData(
        regs.await() ?: emptyList(), metrics.await() ?: emptyList(), schedules.await() ?: emptyList(),
        goals.await() ?: emptyList(), weights.await() ?: emptyList(), budget.await() ?: DAILY_KCAL_GOAL,
        profile.await()?.recipeProviders?.contains("hellofresh") == true,
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

private const val PLOT_PAD = 6f

/** A chart: max/min labels on the left, hour captions below; only the pulse has a title in the middle. */
@Composable
private fun ColumnScope.ChartFrame(top: String, bottom: String, left: String, right: String, title: String, draw: DrawScope.() -> Unit) {
    // The charts share the white box's height equally (web: chartH in FrontCharts).
    Column(Modifier.fillMaxWidth().weight(1f)) {
        Row(Modifier.fillMaxWidth().weight(1f)) {
            Column(Modifier.fillMaxHeight().padding(end = 6.dp), verticalArrangement = Arrangement.SpaceBetween) {
                HcText(top, HcTypeRoles.Caption, color = HcColors.TextSecondary)
                HcText(bottom, HcTypeRoles.Caption, color = HcColors.TextSecondary)
            }
            Canvas(Modifier.fillMaxSize()) { draw() }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            HcText(left, HcTypeRoles.Caption, color = HcColors.TextSecondary)
            HcText(title, HcTypeRoles.Caption, color = HcColors.Text)
            HcText(right, HcTypeRoles.Caption, color = HcColors.TextSecondary)
        }
    }
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
    val shares = recommendedShares(start, end, BUCKET_MIN)
    val sums = sumBuckets(intake, start, end, BUCKET_MIN)
    val nowHour = now.hour + now.minute / 60.0
    val elapsed = max(0, min(shares.size, kotlin.math.ceil((nowHour - start) * 60 / BUCKET_MIN).toInt()))
    val budget = data.budgetKcal
    val planCum = cumulative(shares.map { it * budget })
    val actualCum = cumulative(sums)

    Column(modifier) {
        // Pulse: one min/max stick per quarter hour.
        val filled = pulse.filterNotNull()
        val lo = filled.minOfOrNull { it.min } ?: 0.0
        val hi = filled.maxOfOrNull { it.max } ?: 0.0
        ChartFrame(
            if (filled.isEmpty()) "" else hi.toInt().toString(), if (filled.isEmpty()) "" else lo.toInt().toString(),
            hourLabel(start), hourLabel(end), t.t("frontCharts.pulse"),
        ) {
            baseline()
            val span = max(1.0, hi - lo).toFloat()
            for (b in filled) {
                val x = plotX(pulse.size, b.index)
                val y1 = size.height - PLOT_PAD - ((b.min - lo).toFloat() / span) * (size.height - 2 * PLOT_PAD)
                val y2 = size.height - PLOT_PAD - ((b.max - lo).toFloat() / span) * (size.height - 2 * PLOT_PAD)
                drawLine(HcColors.ChartBlue, Offset(x, y1), Offset(x, if (y1 == y2) y2 - 1f else y2), strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
            }
        }

        // Calories: sticks per quarter hour with the recommended distribution as a smooth curve.
        val topKcal = max(sums.maxOrNull() ?: 0.0, max((shares.maxOrNull() ?: 0.0) * budget, 1.0))
        ChartFrame(topKcal.toInt().toString(), "0", hourLabel(start), hourLabel(end), "") {
            baseline()
            sums.forEachIndexed { i, v ->
                if (v > 0) {
                    val x = plotX(sums.size, i)
                    drawLine(HcColors.ChartBlue, Offset(x, size.height), Offset(x, size.height - (v / topKcal).toFloat() * (size.height - PLOT_PAD)), strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
                }
            }
            val plan = shares.mapIndexed { i, s -> Offset(plotX(shares.size, i), size.height - (s * budget / topKcal).toFloat() * (size.height - PLOT_PAD)) }
            drawPath(smoothPath(plan), HcColors.TextSecondary, style = Stroke(width = 1.25.dp.toPx(), cap = StrokeCap.Round))
        }

        // Recommended (grey, static) vs. actual intake (blue).
        val topCum = max(planCum.lastOrNull() ?: 0.0, max(actualCum.getOrElse(max(0, elapsed - 1)) { 0.0 }, 1.0))
        ChartFrame(topCum.toInt().toString(), "0", hourLabel(start), hourLabel(end), "") {
            baseline()
            val plan = planCum.mapIndexed { i, v -> Offset(plotX(planCum.size, i), size.height - (v / topCum).toFloat() * (size.height - PLOT_PAD)) }
            drawPath(smoothPath(plan), HcColors.Line, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
            val actual = actualCum.take(elapsed).mapIndexed { i, v -> Offset(plotX(planCum.size, i), size.height - (v / topCum).toFloat() * (size.height - PLOT_PAD)) }
            if (actual.size > 1) drawPath(smoothPath(actual), HcColors.ChartBlue, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
        }

        // Goal timeline: one stick per day/week from the goal's start to its target date.
        val weightGoal = data.goals.firstOrNull { g -> g.targetDate != null && g.targets.any { it.type == "weight" } }
        val goalStart = weightGoal?.let { FoodTime.parse(it.createdAt)?.let { i -> FoodTime.local(i).date } }
        val goalEnd = weightGoal?.targetDate?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
        if (weightGoal != null && goalStart != null && goalEnd != null) {
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
            val span = max(1.0, top - bottom).toFloat()
            ChartFrame(
                top.toInt().toString(), bottom.toInt().toString(),
                "${goalStart.dayOfMonth}/${goalStart.monthNumber}", "${goalEnd.dayOfMonth}/${goalEnd.monthNumber}", "",
            ) {
                baseline()
                fun y(v: Double) = size.height - PLOT_PAD - ((v - bottom).toFloat() / span) * (size.height - 2 * PLOT_PAD)
                drawRect(HcColors.Nav, Offset(0f, y(recMax)), Size(size.width, max(2f, y(recMin) - y(recMax))), alpha = 0.7f)
                drawLine(HcColors.TextSecondary, Offset(0f, y(budget)), Offset(size.width, y(budget)), strokeWidth = 1.5.dp.toPx())
                val slots = bars.size
                val barW = max(1.5f, min(6f, size.width / slots * 0.6f))
                bars.forEachIndexed { i, b ->
                    val low = b.lowKcal ?: return@forEachIndexed
                    val high = b.highKcal ?: return@forEachIndexed
                    val x = plotX(slots, i)
                    drawLine(HcColors.ChartBlue, Offset(x, y(low)), Offset(x, min(y(low) - 1f, y(high))), strokeWidth = barW, cap = StrokeCap.Round)
                }
            }
        }
    }
}
