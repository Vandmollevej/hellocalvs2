package dk.packroff.hellocal.screens.statistics

import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.WeightUnit
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.theme.HcColors
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate

// src/components/useStatChartRenderer.tsx — draws the statistics charts from
// their key (src/lib/stat-charts.ts). Shared by the statistics page and
// "Tilføj til statistik", so a chart looks the same before and after it is
// added. Weight, sleep ratings, calorie budgets, sex and body measurements
// are fetched here; the pages pass registrations/activities/metrics.

private const val DAY_COUNT = 7

// The charts' allowed colours (design.md §3); after seven they repeat dashed.
private val GROUP_COLORS: List<Color> = listOf(
    HcColors.Green,
    HcColors.Black,
    HcColors.RedMuted,
    HcColors.Accent,
    HcColors.Gray,
    HcColors.Watch,
    HcColors.GreenMuted,
)

// Body composition under the weight (only when an integration has body fat on).
private val BODY_COMPOSITION_SERIES = listOf(
    Triple("BODY_FAT_PERCENT", "statistics.bodyFat", "%") to HcColors.RedMuted,
    Triple("MUSCLE_MASS_KG", "statistics.muscleMass", "kg") to HcColors.GreenMuted,
    Triple("BODY_WATER_PERCENT", "statistics.bodyWater", "%") to HcColors.Watch,
)

/** One value per day for the last [dayCount] days (today included). */
private fun dailySeries(byDay: Map<LocalDate, Double>, dayCount: Int = DAY_COUNT): List<Double> {
    val today = todayLocal()
    return (0 until dayCount).map { i -> byDay[today.plusDays(-(dayCount - 1 - i))] ?: 0.0 }
}

private fun averageByDay(points: List<Pair<LocalDate, Double>>): Map<LocalDate, Double> =
    points.groupBy({ it.first }, { it.second }).mapValues { (_, values) -> values.sum() / values.size }

internal class StatChartData(
    val chartSeries: List<ChartSeries>,
    val sleepChartSeries: List<ChartSeries>,
    val sleepStatDays: List<SleepStatDay>,
    val intradayRegistrations: List<StatRegistration>,
    val intradayWindowDays: Int,
    val allDays: List<DailyTotal>,
    val bodyEntries: List<BodyEntry>,
    val sex: String?,
    val bodyLoading: Boolean,
)

/**
 * useStatChartRenderer: [enabled] = false while the page is only a skeleton
 * (no data is fetched then).
 */
@Composable
internal fun rememberStatChartData(
    registrations: List<StatRegistration>,
    activities: List<StatActivity>,
    metrics: List<StatMetric>,
    intradayRegistrations: List<StatRegistration>,
    intradayWindowDays: Int,
    enabled: Boolean = true,
    bodyCompositionEnabled: Boolean = false,
): StatChartData {
    val t = LocalTranslator.current
    var weightEntries by remember { mutableStateOf<List<WeightEntry>>(emptyList()) }
    var sleepEntries by remember { mutableStateOf<List<SleepRating>>(emptyList()) }
    var budgets by remember { mutableStateOf<List<BudgetSnapshot>>(emptyList()) }
    var bodyEntries by remember { mutableStateOf<List<BodyEntry>>(emptyList()) }
    var bodyLoading by remember { mutableStateOf(true) }
    var sex by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(enabled) {
        if (!enabled) return@LaunchedEffect
        val today = todayLocal()
        launch { attempt { loadWeightEntries() }?.let { weightEntries = it } }
        launch { attempt { loadSleepQuality(today.plusDays(-(DAY_COUNT - 1)), today) }?.let { sleepEntries = it } }
        // Calorie budget per date — forward only (src/lib/daily-budget.ts).
        launch { attempt { loadDailyBudgets() }?.let { budgets = it } }
        launch { attempt { loadProfileUser() }?.let { sex = it.string("sex") } }
        launch {
            attempt { loadBodyEntries() }?.let { bodyEntries = it }
            bodyLoading = false
        }
    }

    // Kg or pounds (stone is too coarse for an axis).
    val weightUnit = remember { Units.current().weight }
    val chartWeightUnit = if (weightUnit == WeightUnit.Kg) "kg" else "lb"
    val toChartWeight: (Double) -> Double = { kg -> if (weightUnit == WeightUnit.Kg) kg else Units.kgToLb(kg) }

    val allDays = remember(registrations) { groupByDay(registrations) }

    val chartSeries = remember(allDays, budgets, weightEntries, registrations, metrics, bodyCompositionEnabled, t) {
        val today = todayLocal()
        val kcalDaily = dailySeries(allDays.associate { it.date to it.kcal })
        val lookup = makeBudgetLookup(budgets, DAILY_KCAL_GOAL)
        val kcalGoalDaily = (0 until DAY_COUNT).map { i -> lookup(today.plusDays(-(DAY_COUNT - 1 - i))) }
        val weightDaily = dailySeries(averageByDay(weightEntries.map { localDateTimeOf(it.weighedAtMillis).date to it.weightKg }))
        val trend = computeTrendWeight(weightEntries, registrations.map { it.createdAtMillis })
            ?.let { points -> dailySeries(averageByDay(points.map { it.date to it.trendKg })) }
        val composition = if (!bodyCompositionEnabled) emptyList() else BODY_COMPOSITION_SERIES.mapNotNull { (meta, color) ->
            val (type, labelKey, unit) = meta
            val points = metrics.filter { it.type == type }.map { it.recordedAt.date to it.value }
            if (points.isEmpty()) null
            else ChartSeries(type, t.t(labelKey), color, dailySeries(averageByDay(points)), unit = unit, showPointStatus = true)
        }
        buildList {
            add(
                ChartSeries(
                    "kcal", t.t("statistics.calories"), HcColors.Green, kcalDaily, unit = "kcal",
                    goal = kcalGoalDaily.lastOrNull() ?: DAILY_KCAL_GOAL, goals = kcalGoalDaily, colorByGoal = true,
                ),
            )
            add(
                ChartSeries(
                    "weight", t.t("statistics.weight"), HcColors.Gray, weightDaily.map(toChartWeight), unit = chartWeightUnit,
                    goal = toChartWeight(WEIGHT_GOAL_KG), showPointStatus = true,
                ),
            )
            if (trend != null) {
                add(ChartSeries("weightTrend", t.t("statistics.trendWeight"), HcColors.Black, trend.map(toChartWeight), unit = chartWeightUnit, dashed = true))
            }
            addAll(composition)
        }
    }

    val sleepChartSeries = remember(sleepEntries, allDays, t) {
        listOf(
            ChartSeries("sleepQuality", t.t("statistics.sleepQuality"), HcColors.Black, dailySeries(sleepEntries.associate { it.date to it.rating.toDouble() }), unit = "1–5"),
            ChartSeries("kcal", t.t("statistics.calories"), HcColors.Green, dailySeries(allDays.associate { it.date to it.kcal }), unit = "kcal"),
        )
    }

    // The sleep statistics' charts: always the last 7 days like the other charts.
    val sleepStatDays = remember(sleepEntries, registrations, activities, metrics) {
        buildSleepStatDays(sleepPeriodDays(SleepStatPeriodKey.Last7), sleepEntries, registrations, activities, metrics)
    }

    return StatChartData(chartSeries, sleepChartSeries, sleepStatDays, intradayRegistrations, intradayWindowDays, allDays, bodyEntries, sex, bodyLoading)
}

/** Draws one chart by its key; nothing for an unknown key. */
@Composable
internal fun StatChartView(key: String, data: StatChartData) {
    val t: Translator = LocalTranslator.current
    when (val def = statChartDef(key) ?: return) {
        StatChartDef.CaloriesAndWeight -> StatChart(statChartLabel(def, t), data.chartSeries, listOf("kcal"))
        StatChartDef.SleepQuality -> StatChart(
            statChartLabel(def, t),
            data.sleepChartSeries,
            listOf("sleepQuality", "kcal"),
            storageKey = "hellocal.statistik.sleepSeries",
        )
        is StatChartDef.SleepInsight -> SleepInsightChart(def.insight, data.sleepStatDays)
        StatChartDef.IntradayKcal -> IntradayKcalChart(data.intradayRegistrations, data.intradayWindowDays)
        is StatChartDef.BodyMeasurement -> BodyMeasurementChart(def.def, data.bodyEntries, data.sex, data.bodyLoading)
        is StatChartDef.NutrientGroup -> {
            // Every mineral/vitamin can be ticked in the chart's own picker.
            val series = nutrientGroupMembers(def.group).mapIndexed { index, member ->
                ChartSeries(
                    key = member.key,
                    label = statCardLabel(member.key),
                    color = GROUP_COLORS[index % GROUP_COLORS.size],
                    dashed = index >= GROUP_COLORS.size,
                    unit = member.unit,
                    values = dailySeries(data.allDays.associate { it.date to (it.nutrients[member.key] ?: 0.0) }),
                )
            }
            StatChart(
                statChartLabel(def, t),
                series,
                NUTRIENT_GROUP_DEFAULT_SERIES[def.group].orEmpty(),
                storageKey = "hellocal.statistik.series.${def.key}",
            )
        }
        is StatChartDef.Daily -> {
            val label = statChartLabel(def, t)
            StatChart(
                label,
                listOf(ChartSeries(def.field, label, HcColors.Green, dailySeries(data.allDays.associate { it.date to it.field(def.field) }), unit = def.unit)),
                listOf(def.field),
                storageKey = "hellocal.statistik.series.${def.key}",
            )
        }
    }
}
