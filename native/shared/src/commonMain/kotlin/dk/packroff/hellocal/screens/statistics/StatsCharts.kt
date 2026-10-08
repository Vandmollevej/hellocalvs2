package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLink
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.StatsChoiceChip
import dk.packroff.hellocal.ui.StatsLegendDot
import dk.packroff.hellocal.ui.StatsSkeleton
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.datetime.LocalDate
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

// The statistics charts: src/components/StatChart.tsx, IntradayKcalChart.tsx,
// BodyMeasurementChart.tsx, SleepInsightChart.tsx and HistoryLineChart.tsx.

// ---------- StatChart ----------

internal class ChartSeries(
    val key: String,
    val label: String,
    val color: Color,
    val values: List<Double>,
    val unit: String? = null,
    /** Plotted as deviation from the goal (0 = goal hit) when set. */
    val goal: Double? = null,
    /** Goal per point (wins over [goal]). */
    val goals: List<Double>? = null,
    val dashed: Boolean = false,
    val colorByGoal: Boolean = false,
    val showPointStatus: Boolean = false,
)

private const val CHART_TOP = 15f
private const val CHART_BOTTOM = 75f
private const val CHART_CENTER = (CHART_TOP + CHART_BOTTOM) / 2f
private const val CHART_HALF_RANGE = CHART_BOTTOM - CHART_CENTER
private val DASH_3_3 = floatArrayOf(3f, 3f)

private class ChartPoint(val x: Float, val y: Float, val deviation: Double)

private fun chartX(i: Int, count: Int): Float = 10f + i * (260f / max(count - 1, 1))

private fun normalize(values: List<Double>): List<ChartPoint> {
    val maxValue = (values + 1.0).max()
    // Math.min(...positives, 0) — always 0 for positive values.
    val minValue = min(values.filter { it > 0 }.minOrNull() ?: Double.POSITIVE_INFINITY, 0.0)
    val range = max(maxValue - minValue, 1.0)
    return values.mapIndexed { i, value ->
        val normalized = if (value > 0) (value - minValue) / range else 0.0
        ChartPoint(chartX(i, values.size), (75 - normalized * 60).toFloat(), 0.0)
    }
}

private fun normalizeDeviation(values: List<Double>, goal: Double, goals: List<Double>?): List<ChartPoint> {
    val deviations = values.mapIndexed { i, value -> if (value > 0) value - (goals?.getOrNull(i) ?: goal) else null }
    val maxAbs = (deviations.map { abs(it ?: 0.0) } + 1.0).max()
    return values.indices.map { i ->
        val deviation = deviations[i]
        if (deviation == null) ChartPoint(chartX(i, values.size), CHART_CENTER, 0.0)
        else ChartPoint(chartX(i, values.size), (CHART_CENTER - (deviation / maxAbs) * CHART_HALF_RANGE).toFloat(), deviation)
    }
}

/** Change from the previous measurement, with sign; null when there is none. */
private fun pointStatus(values: List<Double>, i: Int, unit: String?): Pair<String, Boolean>? {
    if (i == 0) return null
    val prev = values[i - 1]
    val curr = values[i]
    if (prev <= 0 || curr <= 0) return null
    val diff = curr - prev
    val rounded = round(abs(diff) * 10) / 10
    if (rounded == 0.0) return null
    val sign = if (diff > 0) "+" else "-"
    return "$sign${jsNumber(rounded)}${unit ?: ""}" to (diff <= 0)
}

private fun seriesLabel(s: ChartSeries) = s.label + (s.unit?.let { " ($it)" } ?: "")

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun StatChart(
    title: String,
    series: List<ChartSeries>,
    defaultEnabledKeys: List<String>,
    storageKey: String = "hellocal.statistik.series",
) {
    val t = LocalTranslator.current
    var enabledKeys by remember(storageKey) { mutableStateOf(loadStringList(storageKey) ?: defaultEnabledKeys) }
    var menuOpen by remember { mutableStateOf(false) }

    fun toggleSeries(key: String) {
        enabledKeys = if (key in enabledKeys) enabledKeys - key else enabledKeys + key
        saveStringList(storageKey, enabledKeys)
    }

    val visible = series.filter { it.key in enabledKeys }
    val hasGoalSeries = visible.any { it.goal != null }

    ChartCard {
        Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            HcText(title, HcTypeRoles.Body, Modifier.alignByBaseline().weight(1f, fill = false), bold = true, color = HcColors.Black)
            HcText(t.t("statChart.last7Days"), HcTypeRoles.Micro, Modifier.alignByBaseline(), color = HcColors.TextSecondary)
        }

        ViewBoxCanvas(280f, 90f) {
            if (hasGoalSeries) line(6f, CHART_CENTER, 274f, CHART_CENTER, HcColors.Gray, 1f, DASH_3_3)
            for (s in visible) {
                val under = HcColors.Green
                val over = HcColors.Black
                val goal = s.goal
                val points = if (goal != null) normalizeDeviation(s.values, goal, s.goals) else normalize(s.values)
                val useGoalColor = goal != null && s.colorByGoal
                if (useGoalColor) {
                    for (i in 1 until points.size) {
                        val prev = points[i - 1]
                        val p = points[i]
                        line(prev.x, prev.y, p.x, p.y, if (prev.deviation > 0 || p.deviation > 0) over else under, 2.8f, round = true)
                    }
                } else {
                    polyline(points.map { Offset(it.x, it.y) }, s.color, 2.8f, if (s.dashed) floatArrayOf(5f, 4f) else null)
                }
                points.forEachIndexed { i, p ->
                    val dotColor = if (useGoalColor) (if (p.deviation > 0) over else under) else s.color
                    val isUnder = useGoalColor && p.deviation <= 0
                    circle(p.x, p.y, 3.2f, dotColor, if (isUnder) HcColors.White else null, if (isUnder) 1.5f else 0f)
                    val status = if (s.showPointStatus) pointStatus(s.values, i, s.unit) else null
                    if (status != null) {
                        val labelAbove = i % 2 == 0
                        text(
                            (if (status.second) "✓ " else "− ") + status.first,
                            p.x,
                            if (labelAbove) p.y - 8 else p.y + 13,
                            7f,
                            if (status.second) HcColors.Green else HcColors.Black,
                            bold = true,
                            anchor = TextAnchor.Middle,
                        )
                    }
                }
            }
        }

        Row(Modifier.padding(top = 8.dp)) {
            Row(
                Modifier.clip(RoundedCornerShape(HcDimens.RadiusCard)).alpha(0.7f).clickable { menuOpen = !menuOpen }.padding(4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                FlowRow(Modifier.weight(1f, fill = false), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    visible.forEach { s ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            StatsLegendDot(s.color)
                            HcText(seriesLabel(s), HcTypeRoles.Small, color = HcColors.Black)
                        }
                    }
                }
                HcIcon("ChevronDown", Modifier.rotate(if (menuOpen) 180f else 0f), size = 16.dp, stroke = 2.5f, color = HcColors.Black)
            }
        }

        // The line picker folds out inside the card (2026-10-02), so it can hold many lines.
        if (menuOpen) {
            Column(
                Modifier
                    .padding(top = 8.dp)
                    .fillMaxWidth()
                    .heightIn(max = 320.dp)
                    .clip(RoundedCornerShape(HcDimens.RadiusCard))
                    .background(HcColors.White)
                    .border(1.dp, HcColors.TanDark, RoundedCornerShape(HcDimens.RadiusCard))
                    .verticalScroll(rememberScrollState())
                    .padding(6.dp),
            ) {
                series.forEach { s ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        StatsLegendDot(s.color)
                        HcText(seriesLabel(s), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
                        HcToggle(checked = s.key in enabledKeys, onChange = { toggleSeries(s.key) })
                    }
                }
            }
        }
    }
}

// ---------- IntradayKcalChart ----------

private const val BUCKET_MINUTES = 30
private const val BUCKET_COUNT = 24 * 60 / BUCKET_MINUTES

/** Calorie intake 00–24 as a smooth curve (src/components/IntradayKcalChart.tsx). */
@Composable
internal fun IntradayKcalChart(registrations: List<StatRegistration>, windowDays: Int) {
    val averages = remember(registrations, windowDays) {
        val totals = DoubleArray(BUCKET_COUNT)
        for (r in registrations) {
            val bucket = min(BUCKET_COUNT - 1, r.createdAt.minutesOfDay() / BUCKET_MINUTES)
            totals[bucket] += r.kcal
        }
        totals.map { it / max(windowDays, 1) }
    }
    val maxValue = (averages + 1.0).max()
    val points = averages.mapIndexed { i, value ->
        Triple(10f + i * (260f / (BUCKET_COUNT - 1)), (80 - (value / maxValue) * 65).toFloat(), value)
    }
    // Clear local peaks only, so one can see how much was eaten when the curve tops.
    val peaks = points.filterIndexed { i, p ->
        if (p.third < maxValue * 0.15) return@filterIndexed false
        val prev = points.getOrNull(i - 1)
        val next = points.getOrNull(i + 1)
        if (prev != null && p.third < prev.third) return@filterIndexed false
        if (next != null && p.third < next.third) return@filterIndexed false
        !(prev != null && next != null && p.third == prev.third && p.third == next.third)
    }

    ChartCard {
        HcText("Kalorieindtag i løbet af dagen", HcTypeRoles.Body, Modifier.padding(bottom = 16.dp), bold = true, color = HcColors.Black)
        ViewBoxCanvas(280f, 90f) {
            val curve = points.map { Offset(it.first, it.second) }
            polygon(listOf(Offset(10f, 80f)) + curve + Offset(270f, 80f), HcColors.Green, 0.15f)
            polyline(curve, HcColors.Green, 2.5f)
            peaks.forEach { p ->
                text("${round(p.third).toLong()} kcal", p.first, max(8f, p.second - 6), 7f, HcColors.Black, bold = true, anchor = TextAnchor.Middle)
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            listOf(0, 6, 12, 18, 24).forEach { hour ->
                HcText(hour.toString().padStart(2, '0'), HcTypeRoles.Micro, color = HcColors.TextSecondary)
            }
        }
    }
}

// ---------- BodyMeasurementChart ----------

private class BodySeries(val points: List<Pair<Long, Double>>, val latest: Double?, val change: Double?)

/** src/lib/body-measurement-series.ts — at most the latest 10 measurements. */
private fun buildBodyMeasurementSeries(entries: List<BodyEntry>, field: String, maxPoints: Int = 10): BodySeries {
    val points = entries.mapNotNull { e -> e.values[field]?.takeIf { it > 0 }?.let { e.measuredAtMillis to it } }
        .sortedBy { it.first }
        .takeLast(maxPoints)
    val latest = points.lastOrNull()?.second
    val change = if (points.size > 1) round((points[points.size - 1].second - points[points.size - 2].second) * 10) / 10 else null
    return BodySeries(points, latest, change)
}

private fun formatChange(cm: Double, unit: LengthUnit): String {
    val value = if (unit == LengthUnit.In) cmToIn(cm) else cm
    return "${jsNumber(round(value * 10) / 10).replace(".", ",")} ${lengthUnitLabel(unit)}"
}

@Composable
internal fun BodyMeasurementChart(def: BodyMeasurementDef, entries: List<BodyEntry>, sex: String?, loading: Boolean) {
    val t = LocalTranslator.current
    val lengthUnit = remember { currentUnits().height }
    val series = remember(entries, def.field) { buildBodyMeasurementSeries(entries, def.field) }
    val label = t.t(def.nameKey)

    Row(
        Modifier.fillMaxWidth().background(HcColors.Card, RoundedCornerShape(HcDimens.RadiusCard)).padding(HcDimens.SpaceBlock),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.width(80.dp).height(108.dp), contentAlignment = Alignment.Center) {
            bodyMeasurementImage(def, sex)?.let { HcRemoteImage(it, Modifier.width(80.dp).height(108.dp), contentScale = ContentScale.Fit) }
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HcText(label, HcTypeRoles.Body, Modifier.weight(1f).alignByBaseline(), bold = true, color = HcColors.Black)
                series.latest?.let {
                    HcText(formatLength(it, lengthUnit), HcTypeRoles.Body, Modifier.alignByBaseline(), bold = true, color = HcColors.Black)
                }
            }
            when {
                loading -> StatsSkeleton(Modifier.fillMaxWidth().height(84.dp))
                series.points.isEmpty() -> Column(Modifier.height(84.dp), verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically)) {
                    HcText(t.t("bodyMeasurementChart.noData"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    HcLink(t.t("bodyMeasurementChart.register"), "/profile/body-measurements", role = HcTypeRoles.Small)
                }
                else -> {
                    val points = series.points
                    val minTime = points.minOf { it.first }
                    val maxTime = points.maxOf { it.first }
                    val minValue = points.minOf { it.second }
                    val maxValue = points.maxOf { it.second }
                    val left = 6f
                    val right = 194f
                    val top = 10f
                    val bottom = 74f
                    fun x(time: Long) = if (maxTime == minTime) (left + right) / 2 else left + ((time - minTime).toFloat() / (maxTime - minTime)) * (right - left)
                    fun y(value: Double) = if (maxValue == minValue) (top + bottom) / 2 else (bottom - ((value - minValue) / (maxValue - minValue)) * (bottom - top)).toFloat()
                    val coords = points.map { Offset(x(it.first), y(it.second)) }
                    ViewBoxCanvas(200f, 84f) {
                        if (points.size > 1) {
                            text(formatLength(maxValue, lengthUnit), left, top - 3, 8f, HcColors.Gray)
                            text(formatLength(minValue, lengthUnit), left, bottom + 9, 8f, HcColors.Gray)
                            polyline(coords, HcColors.Green, 2.4f)
                        }
                        coords.forEach { circle(it.x, it.y, 3f, HcColors.Green) }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val first = localDateTimeOf(points.first().first).date
                        val last = localDateTimeOf(points.last().first).date
                        HcText(
                            if (points.size > 1) "${daShortDate(first)} – ${daShortDate(last)}" else daShortDate(first),
                            HcTypeRoles.Micro,
                            Modifier.weight(1f).alignByBaseline(),
                            color = HcColors.TextSecondary,
                        )
                        val change = series.change
                        if (change != null && change != 0.0) {
                            HcText(
                                t.t("bodyMeasurementChart.change", "value" to "${if (change > 0) "+" else "−"}${formatChange(abs(change), lengthUnit)}"),
                                HcTypeRoles.Micro,
                                Modifier.alignByBaseline(),
                                bold = true,
                                color = HcColors.Black,
                            )
                        }
                    }
                }
            }
        }
    }
}

// ---------- SleepInsightChart ----------

/** One morning in the sleep statistics (src/lib/sleep-stats.ts SleepStatDay). */
internal class SleepStatDay(
    val date: LocalDate,
    val rating: Int?,
    val kcal: Double?,
    val lastMealMinutes: Double?,
    val coffeeCount: Int,
    val lastCoffeeMinutes: Double?,
    val sportMinutes: Double,
    val lastSportEndMinutes: Double?,
    val deviceSleepHours: Double?,
    val bodyFatPercent: Double?,
)

/** buildSleepStatDays: the rated morning against the day BEFORE the night. */
internal fun buildSleepStatDays(
    days: List<LocalDate>,
    ratings: List<SleepRating>,
    registrations: List<StatRegistration>,
    activities: List<StatActivity>,
    metrics: List<StatMetric>,
): List<SleepStatDay> {
    val ratingByDay = ratings.associate { it.date to it.rating }
    val regsByDay = registrations.groupBy { it.createdAt.date }
    val activitiesByDay = activities.groupBy { it.startedAt.date }
    val sleepMinutesByDay = mutableMapOf<LocalDate, Double>()
    val bodyFatByDay = mutableMapOf<LocalDate, Pair<Double, Int>>()
    for (m in metrics) {
        if (m.type == "SLEEP_MINUTES") sleepMinutesByDay[m.recordedAt.date] = (sleepMinutesByDay[m.recordedAt.date] ?: 0.0) + m.value
        if (m.type == "BODY_FAT_PERCENT") {
            val (sum, count) = bodyFatByDay[m.recordedAt.date] ?: (0.0 to 0)
            bodyFatByDay[m.recordedAt.date] = (sum + m.value) to (count + 1)
        }
    }
    return days.map { date ->
        val evening = date.plusDays(-1)
        val regs = regsByDay[evening].orEmpty()
        val coffee = regs.filter { isCaffeine(it.title) }
        val sports = activitiesByDay[evening].orEmpty()
        val deviceMinutes = sleepMinutesByDay[date]
        val bodyFat = bodyFatByDay[date]
        SleepStatDay(
            date = date,
            rating = ratingByDay[date],
            kcal = if (regs.isNotEmpty()) round(regs.sumOf { it.kcal }) else null,
            lastMealMinutes = regs.maxOfOrNull { it.createdAt.minutesOfDay() }?.toDouble(),
            coffeeCount = coffee.size,
            lastCoffeeMinutes = coffee.maxOfOrNull { it.createdAt.minutesOfDay() }?.toDouble(),
            sportMinutes = sports.sumOf { it.durationMinutes },
            lastSportEndMinutes = sports.maxOfOrNull { it.startedAt.minutesOfDay() + it.durationMinutes },
            deviceSleepHours = if (deviceMinutes != null && deviceMinutes != 0.0) round(deviceMinutes / 60 * 10) / 10 else null,
            bodyFatPercent = bodyFat?.let { round(it.first / it.second * 10) / 10 },
        )
    }
}

private const val S_LEFT = 26f
private const val S_RIGHT = 290f
private const val S_TOP = 10f
private const val S_BOTTOM = 124f
private const val S_HEIGHT = S_BOTTOM - S_TOP
private const val FULL_NIGHT_HOURS = 8.0

private class Overlay(val key: String, val label: String, val color: Color, val values: List<Double?>, val format: (Double) -> String, val time: Boolean = false)

private fun overlaysFor(kind: SleepInsightKind, days: List<SleepStatDay>, t: (String) -> String): List<Overlay> {
    val kcal: (Double) -> String = { "${round(it).toLong()} kcal" }
    val time: (Double) -> String = { formatMinutesOfDay(it) }
    return when (kind) {
        SleepInsightKind.Quality -> listOf(Overlay("lastMeal", t("sleepStats.lastMeal"), HcColors.Green, days.map { it.lastMealMinutes }, time, true))
        SleepInsightKind.Kcal -> listOf(Overlay("kcal", t("sleepStats.kcal"), HcColors.Green, days.map { it.kcal }, kcal))
        SleepInsightKind.Coffee -> listOf(
            Overlay("coffeeCount", t("sleepStats.coffeeCount"), HcColors.Green, days.map { if (it.coffeeCount == 0) null else it.coffeeCount.toDouble() }, { jsNumber(it) }),
            Overlay("lastCoffee", t("sleepStats.lastCoffee"), HcColors.Gray, days.map { it.lastCoffeeMinutes }, time, true),
        )
        SleepInsightKind.Sport -> listOf(
            Overlay("sportMinutes", t("sleepStats.sportMinutes"), HcColors.Green, days.map { if (it.sportMinutes == 0.0) null else it.sportMinutes }, { "${jsNumber(it)} min" }),
            Overlay("lastSport", t("sleepStats.lastSport"), HcColors.Gray, days.map { it.lastSportEndMinutes }, time, true),
        )
        else -> listOf(Overlay("deviceSleep", t("sleepStats.deviceSleep"), HcColors.Green, days.map { it.deviceSleepHours }, { "${daNumber(it, 3)} t" }))
    }
}

/** Time bars scale from 12:00 so the evening's differences show. */
private fun domain(overlay: Overlay): Pair<Double, Double> {
    val present = overlay.values.filterNotNull()
    return if (overlay.time) (12.0 * 60) to (present + 24.0 * 60).max() else 0.0 to (present + 1.0).max()
}

private fun dotRadius(n: Int) = if (n > 40) 1.4f else if (n > 14) 2.2f else 3.2f

private fun labelIndexes(n: Int, days: List<SleepStatDay>): List<Int> =
    if (n <= 7) days.indices.toList() else listOf(0, (n - 1) / 2, n - 1).filter { it < days.size }

/** SleepInsightChart: experienced sleep 1–5 as a curve with optional bars for the day before. */
@Composable
internal fun SleepInsightChart(kind: SleepInsightKind, days: List<SleepStatDay>) {
    if (kind == SleepInsightKind.BodyFat) BodyFatSleepChart(days) else SleepBarChart(kind, days)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SleepBarChart(kind: SleepInsightKind, days: List<SleepStatDay>) {
    val t = LocalTranslator.current
    val overlays = overlaysFor(kind, days) { t.t(it) }
    // The last-intake overlay is opt-in; the other charts show everything.
    val defaultOn = if (kind == SleepInsightKind.Quality) emptyList() else overlays.map { it.key }
    val storageKey = "hellocal.sleepStats.${kind.key}"
    var enabled by remember(storageKey) { mutableStateOf(loadStringList(storageKey) ?: defaultOn) }

    val visible = overlays.filter { it.key in enabled }
    val n = max(days.size, 1)
    val slot = (S_RIGHT - S_LEFT) / n
    val barWidth = max(slot * 0.7f / max(visible.size, 1), 0.6f)
    fun xCenter(i: Int) = S_LEFT + slot * (i + 0.5f)
    fun ratingY(rating: Int) = S_BOTTOM - ((rating - 1) / 4f) * S_HEIGHT
    val dot = dotRadius(n)
    val hasRatings = days.any { it.rating != null }

    ChartCard {
        HcText(t.t("sleepStats.chart.${kind.key}"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
        HcText(t.t("sleepStats.chartInfo.${kind.key}"), HcTypeRoles.Small, Modifier.padding(top = 4.dp), color = HcColors.TextSecondary)
        ViewBoxCanvas(320f, 146f, Modifier.padding(top = 12.dp)) {
            for (rating in 1..5) {
                line(S_LEFT, ratingY(rating), S_RIGHT, ratingY(rating), HcColors.TanDark, 0.6f)
                text(rating.toString(), S_LEFT - 6, ratingY(rating) + 3, 8f, HcColors.Black, anchor = TextAnchor.End)
            }
            visible.forEachIndexed { overlayIndex, overlay ->
                val (lo, hi) = domain(overlay)
                overlay.values.forEachIndexed { i, value ->
                    if (value != null) {
                        val h = max(((min(value, hi) - lo) / (hi - lo) * S_HEIGHT).toFloat(), 1f)
                        val x = xCenter(i) - (barWidth * visible.size) / 2 + barWidth * overlayIndex
                        rect(x, S_BOTTOM - h, barWidth, h, overlay.color, 0.55f, min(barWidth / 3, 1.5f))
                    }
                }
            }
            visible.firstOrNull()?.let { axis ->
                val (lo, hi) = domain(axis)
                text(axis.format(hi), S_RIGHT + 4, S_TOP + 3, 7f, HcColors.Black)
                text(axis.format(lo), S_RIGHT + 4, S_BOTTOM + 3, 7f, HcColors.Black)
            }
            // The curve breaks where a night has no rating.
            val segments = mutableListOf<MutableList<Offset>>()
            var current = mutableListOf<Offset>()
            days.forEachIndexed { i, day ->
                val rating = day.rating
                if (rating == null) {
                    if (current.isNotEmpty()) segments += current
                    current = mutableListOf()
                } else current += Offset(xCenter(i), ratingY(rating))
            }
            if (current.isNotEmpty()) segments += current
            segments.forEach { if (it.size > 1) polyline(it, HcColors.Black, 2f) }
            days.forEachIndexed { i, day -> day.rating?.let { circle(xCenter(i), ratingY(it), dot, HcColors.Black) } }
            labelIndexes(n, days).forEach { i ->
                text(daShortDate(days[i].date), xCenter(i), 140f, 7.5f, HcColors.Black, anchor = TextAnchor.Middle)
            }
        }
        if (!hasRatings) HcText(t.t("sleepStats.noRatings"), HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
        FlowRow(
            Modifier.fillMaxWidth().padding(top = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(Modifier.heightIn(min = 40.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                StatsLegendDot(HcColors.Black)
                HcText(t.t("sleepStats.experienced"), HcTypeRoles.Small, color = HcColors.Black)
            }
            overlays.forEach { overlay ->
                StatsChoiceChip(
                    overlay.label,
                    selected = overlay.key in enabled,
                    onClick = {
                        enabled = if (overlay.key in enabled) enabled - overlay.key else enabled + overlay.key
                        saveStringList(storageKey, enabled)
                    },
                    leading = { StatsLegendDot(overlay.color) },
                )
            }
        }
    }
}

/** Body fat and both kinds of sleep on one shared 0–100 axis. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BodyFatSleepChart(days: List<SleepStatDay>) {
    val t = LocalTranslator.current
    val storageKey = "hellocal.sleepStats.bodyFat"
    val lines = listOf(
        Triple("experienced", t.t("sleepStats.experienced"), HcColors.Black) to days.map { d -> d.rating?.let { it * 20.0 } },
        Triple("measured", t.t("sleepStats.measuredSleep"), HcColors.Gray) to days.map { d -> d.deviceSleepHours?.let { min(it / FULL_NIGHT_HOURS * 100, 100.0) } },
        Triple("bodyFat", t.t("sleepStats.bodyFat"), HcColors.Green) to days.map { it.bodyFatPercent },
    )
    var enabled by remember { mutableStateOf(loadStringList(storageKey) ?: listOf("experienced", "measured", "bodyFat")) }
    val n = max(days.size, 1)
    val slot = (S_RIGHT - S_LEFT) / n
    fun xCenter(i: Int) = S_LEFT + slot * (i + 0.5f)
    fun y(value: Double) = (S_BOTTOM - (value / 100) * S_HEIGHT).toFloat()
    val dot = dotRadius(n)

    ChartCard {
        HcText(t.t("sleepStats.chart.bodyFat"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
        HcText(t.t("sleepStats.chartInfo.bodyFat"), HcTypeRoles.Small, Modifier.padding(top = 4.dp), color = HcColors.TextSecondary)
        ViewBoxCanvas(320f, 146f, Modifier.padding(top = 12.dp)) {
            for (value in listOf(0, 20, 40, 60, 80, 100)) {
                line(S_LEFT, y(value.toDouble()), S_RIGHT, y(value.toDouble()), HcColors.TanDark, 0.6f)
                text(value.toString(), S_LEFT - 6, y(value.toDouble()) + 3, 8f, HcColors.Black, anchor = TextAnchor.End)
            }
            lines.filter { it.first.first in enabled }.forEach { (meta, values) ->
                val points = values.mapIndexedNotNull { i, v -> v?.let { Offset(xCenter(i), y(it)) } }
                if (points.size > 1) polyline(points, meta.third, 2f)
                points.forEach { circle(it.x, it.y, dot, meta.third) }
            }
            labelIndexes(n, days).forEach { i ->
                text(daShortDate(days[i].date), xCenter(i), 140f, 7.5f, HcColors.Black, anchor = TextAnchor.Middle)
            }
        }
        FlowRow(
            Modifier.fillMaxWidth().padding(top = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            lines.forEach { (meta, _) ->
                StatsChoiceChip(
                    meta.second,
                    selected = meta.first in enabled,
                    onClick = {
                        enabled = if (meta.first in enabled) enabled - meta.first else enabled + meta.first
                        saveStringList(storageKey, enabled)
                    },
                    leading = { StatsLegendDot(meta.third) },
                )
            }
        }
    }
}

// ---------- HistoryLineChart (profile status) ----------

internal class HistoryPoint(val id: String?, val atMillis: Long, val value: Double)

/** src/components/HistoryLineChart.tsx — green line over time, optional dashed goal line. */
@Composable
internal fun HistoryLineChart(points: List<HistoryPoint>, format: (Double) -> String, target: Double?, targetLabel: String?) {
    if (points.isEmpty()) return
    val minTime = points.minOf { it.atMillis }
    val maxTime = points.maxOf { it.atMillis }
    val minValue = points.minOf { it.value }
    val maxValue = points.maxOf { it.value }
    // The goal counts in the y axis, so its line is always visible.
    val low = if (target != null) min(minValue, target) else minValue
    val high = if (target != null) max(maxValue, target) else maxValue
    val left = 6f
    val right = 314f
    val top = 14f
    val bottom = 106f
    fun x(time: Long) = if (maxTime == minTime) (left + right) / 2 else left + ((time - minTime).toFloat() / (maxTime - minTime)) * (right - left)
    fun y(value: Double) = if (high == low) (top + bottom) / 2 else (bottom - ((value - low) / (high - low)) * (bottom - top)).toFloat()
    val coords = points.map { Offset(x(it.atMillis), y(it.value)) }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        ViewBoxCanvas(320f, 120f) {
            if (high != low) {
                text(format(high), left, top - 4, 9f, HcColors.Gray)
                text(format(low), left, bottom + 11, 9f, HcColors.Gray)
            }
            if (target != null) {
                line(left, y(target), right, y(target), HcColors.Gray, 1f, DASH_3_3)
                if (targetLabel != null) text(targetLabel, right, y(target) - 4, 9f, HcColors.Gray, anchor = TextAnchor.End)
            }
            if (coords.size > 1) polyline(coords, HcColors.Green, 2.4f)
            // Many weigh-ins → small dots, so the line doesn't drown.
            coords.forEach { circle(it.x, it.y, if (coords.size > 30) 1.6f else 3f, HcColors.Green) }
        }
        val first = localDateTimeOf(points.first().atMillis).date
        val last = localDateTimeOf(points.last().atMillis).date
        HcText(
            if (points.size > 1) "${daShortDateYear2(first)} – ${daShortDateYear2(last)}" else daShortDateYear2(first),
            HcTypeRoles.Micro,
            color = HcColors.TextSecondary,
        )
    }
}
