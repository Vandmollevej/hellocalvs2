package dk.packroff.hellocal.screens.statistics

import dk.packroff.hellocal.i18n.Translator

// src/lib/stat-charts.ts — which charts exist, which are active and their
// order (saved under the same key as the web's localStorage).

internal enum class SleepInsightKind(val key: String) {
    Quality("quality"),
    Kcal("kcal"),
    Coffee("coffee"),
    Sport("sport"),
    Device("device"),
    BodyFat("bodyFat"),
}

internal sealed class StatChartDef(val key: String) {
    object CaloriesAndWeight : StatChartDef("caloriesAndWeight")
    object IntradayKcal : StatChartDef("intradayKcal")
    object SleepQuality : StatChartDef("sleepQuality")
    class SleepInsight(val insight: SleepInsightKind) : StatChartDef("sleep:${insight.key}")
    class BodyMeasurement(val def: BodyMeasurementDef) : StatChartDef("body:${def.field}")
    class Daily(val field: String, val unit: String) : StatChartDef("daily:$field")
    /** One chart per group (minerals / vitamins); the user picks the lines. */
    class NutrientGroup(key: String, val group: String) : StatChartDef(key)
}

/** The nutrients of a group in catalogue order. */
internal fun nutrientGroupMembers(group: String): List<NutrientDef> = NUTRIENTS.filter { it.group == group }

internal val NUTRIENT_GROUP_DEFAULT_SERIES: Map<String, List<String>> = mapOf(
    "mineral" to listOf("calcium", "iron", "potassium"),
    "vitamin" to listOf("vitaminA", "vitaminC", "vitaminD"),
)

// Older saved layouts had one chart per mineral/vitamin.
private val LEGACY_CHART_KEYS = mapOf(
    "daily:potassium" to "minerals",
    "daily:calcium" to "minerals",
    "daily:iron" to "minerals",
    "daily:vitaminA" to "vitamins",
    "daily:vitaminC" to "vitamins",
)

internal val STAT_CHART_DEFS: List<StatChartDef> = buildList {
    add(StatChartDef.CaloriesAndWeight)
    add(StatChartDef.IntradayKcal)
    add(StatChartDef.SleepQuality)
    SleepInsightKind.entries.forEach { add(StatChartDef.SleepInsight(it)) }
    BODY_MEASUREMENT_FIELDS.forEach { add(StatChartDef.BodyMeasurement(it)) }
    add(StatChartDef.Daily("protein", "g"))
    add(StatChartDef.Daily("carbs", "g"))
    add(StatChartDef.Daily("fat", "g"))
    add(StatChartDef.Daily("saturatedFat", "g"))
    add(StatChartDef.Daily("unsaturatedFat", "g"))
    add(StatChartDef.Daily("transFat", "g"))
    add(StatChartDef.Daily("cholesterol", "mg"))
    add(StatChartDef.Daily("salt", "g"))
    add(StatChartDef.Daily("sugar", "g"))
    add(StatChartDef.Daily("fiber", "g"))
    add(StatChartDef.NutrientGroup("minerals", "mineral"))
    add(StatChartDef.NutrientGroup("vitamins", "vitamin"))
}

internal val DEFAULT_ACTIVE_CHART_KEYS = listOf("caloriesAndWeight", "intradayKcal", "sleepQuality")

private val chartDefByKey: Map<String, StatChartDef> = STAT_CHART_DEFS.associateBy { it.key }

internal fun statChartDef(key: String): StatChartDef? = chartDefByKey[key]

internal val BODY_MEASUREMENT_CHART_KEYS: List<String> = BODY_MEASUREMENT_FIELDS.map { "body:${it.field}" }

/** The chart's name — the same on the statistics page and on "Tilføj til statistik". */
internal fun statChartLabel(def: StatChartDef, t: Translator): String = when (def) {
    StatChartDef.CaloriesAndWeight -> t.t("statistics.caloriesAndWeightChart")
    StatChartDef.SleepQuality -> t.t("statistics.sleepQualityChart")
    StatChartDef.IntradayKcal -> t.t("statUnusedCharts.intradayKcal")
    is StatChartDef.SleepInsight -> t.t("sleepStats.chart.${def.insight.key}")
    is StatChartDef.BodyMeasurement -> t.t(def.def.nameKey)
    is StatChartDef.NutrientGroup -> t.t(if (def.group == "mineral") "statUnusedCards.category.minerals" else "statUnusedCards.category.vitamins")
    is StatChartDef.Daily -> statCardLabel(def.field)
}

private const val STAT_CHART_LAYOUT_STORAGE_KEY = "hellocal.statistik.charts"

private fun sanitizeCharts(keys: List<String>?): List<String> {
    if (keys == null) return DEFAULT_ACTIVE_CHART_KEYS
    val seen = mutableSetOf<String>()
    return keys.map { LEGACY_CHART_KEYS[it] ?: it }.filter { chartDefByKey.containsKey(it) && seen.add(it) }
}

internal fun loadChartLayout(): List<String> = sanitizeCharts(loadStringList(STAT_CHART_LAYOUT_STORAGE_KEY))

internal fun saveChartLayout(keys: List<String>) = saveStringList(STAT_CHART_LAYOUT_STORAGE_KEY, sanitizeCharts(keys))

/** Adds charts at the bottom of the chart section (already active ones are skipped). */
internal fun addChartsToLayout(keys: List<String>) {
    val current = loadChartLayout()
    saveChartLayout(current + keys.filter { it !in current })
}
