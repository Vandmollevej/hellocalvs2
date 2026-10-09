package dk.packroff.hellocal.screens.statistics

import kotlinx.datetime.LocalDate
import kotlin.math.round

// Pure calculations ported 1:1 from src/lib/daily-totals.ts,
// src/lib/nutrients.ts, src/lib/food-classification.ts, src/lib/goals.ts,
// src/lib/daily-budget.ts and src/lib/weight-trend.ts.

// ---------- Goals (src/lib/goals.ts) ----------

internal const val DAILY_KCAL_GOAL = 3299.0
internal const val WEIGHT_GOAL_KG = 100.0

// ---------- Nutrients (src/lib/nutrients.ts) ----------

internal class NutrientDef(val key: String, val unit: String, val digits: Int, val group: String)

internal val NUTRIENTS = listOf(
    NutrientDef("saturatedFat", "g", 1, "macro"),
    NutrientDef("unsaturatedFat", "g", 1, "macro"),
    NutrientDef("transFat", "g", 2, "macro"),
    NutrientDef("cholesterol", "mg", 0, "macro"),
    NutrientDef("sugar", "g", 1, "macro"),
    NutrientDef("fiber", "g", 1, "macro"),
    NutrientDef("salt", "g", 1, "macro"),
    NutrientDef("sodium", "mg", 0, "mineral"),
    NutrientDef("potassium", "mg", 0, "mineral"),
    NutrientDef("calcium", "mg", 0, "mineral"),
    NutrientDef("magnesium", "mg", 0, "mineral"),
    NutrientDef("iron", "mg", 1, "mineral"),
    NutrientDef("zinc", "mg", 1, "mineral"),
    NutrientDef("copper", "mg", 2, "mineral"),
    NutrientDef("manganese", "mg", 2, "mineral"),
    NutrientDef("selenium", "µg", 0, "mineral"),
    NutrientDef("phosphorus", "mg", 0, "mineral"),
    NutrientDef("iodine", "µg", 0, "mineral"),
    NutrientDef("vitaminA", "µg", 0, "vitamin"),
    NutrientDef("vitaminC", "mg", 0, "vitamin"),
    NutrientDef("vitaminD", "µg", 1, "vitamin"),
    NutrientDef("vitaminE", "mg", 1, "vitamin"),
    NutrientDef("vitaminK", "µg", 0, "vitamin"),
    NutrientDef("vitaminB1", "mg", 2, "vitamin"),
    NutrientDef("vitaminB2", "mg", 2, "vitamin"),
    NutrientDef("vitaminB3", "mg", 1, "vitamin"),
    NutrientDef("vitaminB5", "mg", 1, "vitamin"),
    NutrientDef("vitaminB6", "mg", 2, "vitamin"),
    NutrientDef("vitaminB7", "µg", 1, "vitamin"),
    NutrientDef("vitaminB9", "µg", 0, "vitamin"),
    NutrientDef("vitaminB12", "µg", 1, "vitamin"),
)

internal val NUTRIENT_BY_KEY: Map<String, NutrientDef> = NUTRIENTS.associateBy { it.key }

// ---------- Daily totals (src/lib/daily-totals.ts) ----------

internal class DailyTotal(val date: LocalDate) {
    var kcal = 0.0
    var protein = 0.0
    var carbs = 0.0
    var fat = 0.0
    /** Per nutrient key (incl. the named legacy fields sugar, fiber, salt, …). */
    val nutrients = mutableMapOf<String, Double>()
    val nutrientsEstimated = mutableMapOf<String, Double>()
    val nutrientsTolerance = mutableMapOf<String, Double>()

    /** The named numeric fields of DailyTotal (kcal, protein, … vitaminC). */
    fun field(name: String): Double = when (name) {
        "kcal" -> kcal
        "protein" -> protein
        "carbs" -> carbs
        "fat" -> fat
        else -> nutrients[name] ?: 0.0
    }
}

private fun MutableMap<String, Double>.add(key: String, value: Double?) {
    if (value == null || !value.isFinite()) return
    this[key] = (this[key] ?: 0.0) + value
}

/** One total per local calendar day, in first-seen order (groupByDay). */
internal fun groupByDay(registrations: List<StatRegistration>): List<DailyTotal> {
    val byDay = LinkedHashMap<LocalDate, DailyTotal>()
    for (r in registrations) {
        val total = byDay.getOrPut(r.createdAt.date) { DailyTotal(r.createdAt.date) }
        total.kcal += r.kcal
        total.protein += r.protein
        total.carbs += r.carbs
        total.fat += r.fat ?: 0.0
        val snapshot = r.nutrientSnapshot
        for (key in LEGACY_NUTRIENT_KEYS) {
            total.nutrients.add(key, if (snapshot != null && snapshot.containsKey(key)) snapshot[key] else r.legacy[key])
        }
        snapshot?.forEach { (key, value) -> if (key !in LEGACY_NUTRIENT_KEYS) total.nutrients.add(key, value) }
        r.nutrientEstimated.forEach { (key, value) -> total.nutrientsEstimated.add(key, value) }
        r.nutrientTolerance.forEach { (key, value) -> total.nutrientsTolerance.add(key, value) }
    }
    return byDay.values.toList()
}

internal fun <T> List<T>.withinLastDays(days: Int, millis: (T) -> Long): List<T> {
    val cutoff = nowMillis() - days * 24L * 60 * 60 * 1000
    return filter { millis(it) >= cutoff }
}

internal fun List<DailyTotal>.inRange(range: DayRange): List<DailyTotal> = filter { it.date >= range.start && it.date < range.end }

// ---------- Food classification (src/lib/food-classification.ts) ----------

internal val MEAT_TYPES = listOf("BEEF", "PORK", "POULTRY", "FISH")

/** Hidden until there is a volume limit (docs/DECISIONS.md 2026-09-28). */
internal const val SINNERS_ENABLED = false

internal enum class SourceMetric(val label: String) { Kcal("Kalorier"), Fat("Fedt"), Sugar("Sukker") }

internal fun registrationSugarGrams(r: StatRegistration): Double {
    r.sugarSnapshot?.let { return it }
    val per100 = r.classification?.sugarPer100g
    val amount = r.amountGrams
    return if (per100 != null && amount != null && amount != 0.0) per100 * amount / 100 else 0.0
}

internal fun metricValue(r: StatRegistration, metric: SourceMetric): Double = when (metric) {
    SourceMetric.Kcal -> r.kcal
    SourceMetric.Fat -> r.fat ?: 0.0
    SourceMetric.Sugar -> registrationSugarGrams(r)
}

internal class MeatTotal(var grams: Double = 0.0, var kcal: Double = 0.0)

internal fun meatTotals(registrations: List<StatRegistration>): Map<String, MeatTotal> {
    val totals = MEAT_TYPES.associateWith { MeatTotal() }
    for (r in registrations) {
        for (share in r.classification?.meat.orEmpty()) {
            val total = totals[share.type] ?: continue
            total.grams += (r.amountGrams ?: 0.0) * share.share
            total.kcal += r.kcal * share.share
        }
    }
    return totals
}

internal fun sugaryDrinkKcal(registrations: List<StatRegistration>): Double =
    registrations.filter { it.classification?.isSugaryDrink == true }.sumOf { it.kcal }

internal class AlcoholTotals(val kcal: Double, val volumeMl: Double, val units: Double)

internal fun alcoholTotals(registrations: List<StatRegistration>): AlcoholTotals {
    var kcal = 0.0
    var volume = 0.0
    var units = 0.0
    for (r in registrations) {
        val c = r.classification ?: continue
        if (!c.isAlcohol) continue
        val ml = r.amountGrams ?: 0.0
        kcal += r.kcal
        volume += ml
        // 1 genstand = 12 g ren alkohol; ethanol vejer 0,789 g/ml.
        if (c.alcoholPercent != null) units += ml * (c.alcoholPercent / 100) * 0.789 / 12
    }
    return AlcoholTotals(kcal, volume, units)
}

internal class SourceItem(val key: String, val productId: String?, val title: String, var imageUrl: String?, val productType: String, var value: Double)

internal fun productTypeLabel(r: StatRegistration): String =
    r.classification?.productType ?: if (r.dishId != null) "Retter" else "Andet"

private fun sourceKey(r: StatRegistration): String = when {
    r.productId != null -> "p:${r.productId}"
    r.genericIngredientId != null -> "g:${r.genericIngredientId}"
    r.dishId != null -> "d:${r.dishId}"
    else -> "t:${r.title}"
}

/** All registrations of the same item added up; biggest first. */
internal fun aggregateSources(registrations: List<StatRegistration>, metric: SourceMetric): List<SourceItem> {
    val byKey = LinkedHashMap<String, SourceItem>()
    for (r in registrations) {
        val key = sourceKey(r)
        val value = metricValue(r, metric)
        val existing = byKey[key]
        if (existing != null) {
            existing.value += value
            if (existing.imageUrl == null && r.imageUrl != null) existing.imageUrl = r.imageUrl
            continue
        }
        byKey[key] = SourceItem(key, r.productId, r.title, r.imageUrl, productTypeLabel(r), value)
    }
    return byKey.values.filter { it.value > 0 }.sortedByDescending { it.value }
}

internal class SourceGroup(val productType: String, val value: Double, val share: Double, val items: List<SourceItem>)

/** The items grouped by product type, biggest group first. */
internal fun groupSourcesByProductType(registrations: List<StatRegistration>, metric: SourceMetric): List<SourceGroup> {
    val items = aggregateSources(registrations, metric)
    val total = items.sumOf { it.value }
    val byType = LinkedHashMap<String, MutableList<SourceItem>>()
    for (item in items) byType.getOrPut(item.productType) { mutableListOf() } += item
    return byType.map { (type, list) ->
        val value = list.sumOf { it.value }
        SourceGroup(type, value, if (total > 0) value / total else 0.0, list)
    }.sortedByDescending { it.value }
}

internal fun formatAmount(value: Double, maximumFractionDigits: Int = 0): String = daNumber(value, maximumFractionDigits)

/** Grams up to 999 g, then kg. */
internal fun formatGrams(grams: Double): String =
    if (round(grams) >= 1000) "${formatAmount(grams / 1000, 1)} kg" else "${formatAmount(grams)} g"

/** cl under 1 litre, then litres. */
internal fun formatVolume(ml: Double): String =
    if (round(ml) >= 1000) "${formatAmount(ml / 1000, 1)} l" else "${formatAmount(ml / 10)} cl"

internal fun formatMetric(value: Double, metric: SourceMetric): String =
    if (metric == SourceMetric.Kcal) "${formatAmount(value)} kcal" else "${formatAmount(value, if (value < 10) 1 else 0)} g"

internal fun formatShare(share: Double): String = "${formatAmount(share * 100)} %"

// ---------- Daily budget (src/lib/daily-budget.ts) ----------

/** Budget for a date: own snapshot → latest earlier → fallback. */
internal fun makeBudgetLookup(snapshots: List<BudgetSnapshot>, fallbackKcal: Double): (LocalDate) -> Double {
    val sorted = snapshots.sortedBy { it.date }
    return { date ->
        val key = date.isoKey()
        var best: BudgetSnapshot? = null
        for (snapshot in sorted) {
            if (snapshot.date > key) break
            best = snapshot
        }
        best?.budgetKcal ?: fallbackKcal
    }
}

// ---------- Trend weight (src/lib/weight-trend.ts) ----------

internal class TrendPoint(val date: LocalDate, val trendKg: Double)

private const val MIN_TREND_SAMPLES = 5
private const val SMOOTHING_ALPHA = 0.3
private const val MEAL_PROXIMITY_MS = 2L * 60 * 60 * 1000
private const val MEAL_ADJUSTMENT_KG = 0.4

/** Null when there isn't enough data yet for a reliable estimate. */
internal fun computeTrendWeight(entries: List<WeightEntry>, mealMillis: List<Long>): List<TrendPoint>? {
    if (entries.size < MIN_TREND_SAMPLES) return null
    val sorted = entries.sortedBy { it.weighedAtMillis }
    var morning: Double? = null
    var evening: Double? = null
    var other: Double? = null
    fun ema(previous: Double?, value: Double) = if (previous == null) value else SMOOTHING_ALPHA * value + (1 - SMOOTHING_ALPHA) * previous
    val points = mutableListOf<TrendPoint>()
    for (entry in sorted) {
        val nearMeal = mealMillis.any { kotlin.math.abs(it - entry.weighedAtMillis) <= MEAL_PROXIMITY_MS }
        val adjusted = if (nearMeal) entry.weightKg - MEAL_ADJUSTMENT_KG else entry.weightKg
        when (entry.timeOfDay) {
            "MORNING" -> morning = ema(morning, adjusted)
            "EVENING" -> evening = ema(evening, adjusted)
            else -> other = ema(other, adjusted)
        }
        val active = listOfNotNull(morning, evening, other)
        points += TrendPoint(localDateTimeOf(entry.weighedAtMillis).date, active.sum() / active.size)
    }
    return points
}

// ---------- Caffeine (src/lib/toxins.ts, the "caffeine" terms) ----------

private val CAFFEINE_TERMS = listOf("kaffe", "coffee", "espresso", "=te", "sort te", "grøn te", "=tea", "=cola", "energidrik", "energy drink", "guarana", "koffein", "caffeine")
private const val LETTERS = "abcdefghijklmnopqrstuvwxyz0123456789æøåäöüé"

private fun termMatches(text: String, term: String): Boolean {
    if (!term.startsWith("=")) return text.contains(term)
    val word = term.drop(1)
    var from = 0
    while (true) {
        val at = text.indexOf(word, from)
        if (at < 0) return false
        val before = if (at == 0) null else text[at - 1]
        val afterIndex = at + word.length
        val after = if (afterIndex >= text.length) null else text[afterIndex]
        if ((before == null || before !in LETTERS) && (after == null || after !in LETTERS)) return true
        from = at + 1
    }
}

internal fun isCaffeine(title: String?): Boolean {
    val text = title?.lowercase() ?: return false
    if (text.isBlank()) return false
    return CAFFEINE_TERMS.any { termMatches(text, it) }
}
