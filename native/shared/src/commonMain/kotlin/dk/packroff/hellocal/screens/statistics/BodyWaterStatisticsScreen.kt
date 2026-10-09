package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.StatsChoiceChip
import dk.packroff.hellocal.ui.StatsLegendDot
import dk.packroff.hellocal.ui.StatsSkeleton
import kotlinx.datetime.LocalDate
import kotlin.math.round
import kotlin.math.sqrt

// src/lib/water-stats.ts — body water (% of body weight, from smart scales)
// per day against the same day's calories, salt and sugar.

internal enum class WaterFactorKey(val key: String) { Kcal("kcal"), Salt("salt"), Sugar("sugar") }

internal class WaterStatDay(val date: LocalDate, val waterPercent: Double?, val kcal: Double?, val salt: Double?, val sugar: Double?) {
    fun factor(key: WaterFactorKey): Double? = when (key) {
        WaterFactorKey.Kcal -> kcal
        WaterFactorKey.Salt -> salt
        WaterFactorKey.Sugar -> sugar
    }
}

// NOTE(parity): the web looks the day totals up by groupByDay's "y-m0-d"
// key with a "YYYY-MM-DD" key, so on the web kcal/salt/sugar never match and
// stay empty. The app matches by calendar day, which is what the page
// describes; see the hand-off report.
internal fun buildWaterStatDays(days: List<LocalDate>, registrations: List<StatRegistration>, metrics: List<StatMetric>): List<WaterStatDay> {
    val totals = groupByDay(registrations).associateBy { it.date }
    val water = mutableMapOf<LocalDate, Pair<Double, Int>>()
    for (m in metrics) {
        if (m.type != "BODY_WATER_PERCENT") continue
        val (sum, count) = water[m.recordedAt.date] ?: (0.0 to 0)
        water[m.recordedAt.date] = (sum + m.value) to (count + 1)
    }
    return days.map { date ->
        val total = totals[date]
        val w = water[date]
        WaterStatDay(
            date = date,
            waterPercent = w?.let { round(it.first / it.second * 10) / 10 },
            kcal = total?.let { round(it.kcal) },
            salt = total?.let { round(it.field("salt") * 10) / 10 },
            sugar = total?.let { round(it.field("sugar") * 10) / 10 },
        )
    }
}

/** Pearson correlation over days with both values; null under 5 pairs or without variation. */
internal fun waterCorrelation(days: List<WaterStatDay>, factor: WaterFactorKey): Double? {
    val pairs = days.mapNotNull { d -> val f = d.factor(factor); if (d.waterPercent != null && f != null) d.waterPercent to f else null }
    if (pairs.size < 5) return null
    val mx = pairs.sumOf { it.first } / pairs.size
    val my = pairs.sumOf { it.second } / pairs.size
    var sxy = 0.0
    var sxx = 0.0
    var syy = 0.0
    for ((x, y) in pairs) {
        sxy += (x - mx) * (y - my)
        sxx += (x - mx) * (x - mx)
        syy += (y - my) * (y - my)
    }
    return if (sxx == 0.0 || syy == 0.0) null else round(sxy / sqrt(sxx * syy) * 100) / 100
}

/** Native port of src/app/statistics/body-water/page.tsx. */
@Composable
fun BodyWaterStatisticsScreen(args: RouteArgs) {
    StatisticsPremiumGate(renderWhilePending = false) { BodyWaterContent() }
}

private const val W_LEFT = 8f
private const val W_RIGHT = 312f
private const val W_TOP = 10f
private const val W_BOTTOM = 124f

private fun scale(values: List<Double?>): (Double) -> Float {
    val present = values.filterNotNull()
    if (present.isEmpty()) return { W_BOTTOM }
    val min = present.min()
    val max = present.max()
    return { v -> if (max == min) (W_TOP + W_BOTTOM) / 2 else (W_BOTTOM - (v - min) / (max - min) * (W_BOTTOM - W_TOP)).toFloat() }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BodyWaterContent() {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var period by remember { mutableStateOf(SleepStatPeriodKey.Last30) }
    var factor by remember { mutableStateOf(WaterFactorKey.Salt) }
    val periodDays = remember(period) { sleepPeriodDays(period) }
    val inputs = rememberSleepStatInputs()
    val days = remember(periodDays, inputs) { buildWaterStatDays(periodDays, inputs.registrations, inputs.metrics) }

    val n = maxOf(days.size, 1)
    fun x(i: Int) = W_LEFT + (W_RIGHT - W_LEFT) / n * (i + 0.5f)
    val waterValues = days.map { it.waterPercent }
    val factorValues = days.map { it.factor(factor) }
    val yWater = scale(waterValues)
    val yFactor = scale(factorValues)
    val hasWater = days.any { it.waterPercent != null }
    val r = waterCorrelation(days, factor)

    HcScreen(t.t("waterStats.title"), back = nav.showBack) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(Modifier.fillMaxWidth().background(HcColors.Brand, RoundedCornerShape(HcDimens.RadiusCard)).padding(HcDimens.SpaceBlock)) {
                HcText(t.t("waterStats.intro"), HcTypeRoles.Small, color = HcColors.White)
            }
            SleepPeriodChips(period) { period = it }
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                WaterFactorKey.entries.forEach { key ->
                    StatsChoiceChip(t.t("waterStats.factor.${key.key}"), selected = factor == key, onClick = { factor = key })
                }
            }
            when {
                inputs.loading -> StatsSkeleton(Modifier.fillMaxWidth().height(224.dp))
                !hasWater -> HcText(t.t("waterStats.noData"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                else -> ChartCard {
                    ViewBoxCanvas(320f, 130f) {
                        fun drawLine(values: List<Double?>, y: (Double) -> Float, color: Color) {
                            val points = values.mapIndexedNotNull { i, v -> v?.let { Offset(x(i), y(it)) } }
                            if (points.size > 1) polyline(points, color, 2f)
                            points.forEach { circle(it.x, it.y, if (n > 40) 1.4f else 3f, color) }
                        }
                        drawLine(factorValues, yFactor, HcColors.Gray)
                        drawLine(waterValues, yWater, HcColors.Green)
                    }
                    FlowRow(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            StatsLegendDot(HcColors.Brand)
                            HcText(t.t("waterStats.water"), HcTypeRoles.Small)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            StatsLegendDot(HcColors.Inactive)
                            HcText(t.t("waterStats.factor.${factor.key}"), HcTypeRoles.Small)
                        }
                    }
                    HcText(
                        if (r == null) t.t("waterStats.correlationNone") else t.t("waterStats.correlation", "value" to jsNumber(r).replace(".", ",")),
                        HcTypeRoles.Small,
                        Modifier.padding(top = 12.dp),
                        color = HcColors.Black,
                    )
                }
            }
        }
    }
}
