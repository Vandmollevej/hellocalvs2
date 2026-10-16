package dk.packroff.hellocal.screens.food

import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Native port of src/lib/front-charts.ts — keep both in step. */

internal data class AwakeHours(val start: Int, val end: Int)

internal fun awakeHours(wakeTime: String?, bedtime: String?): AwakeHours {
    fun parse(value: String?): Double? {
        val m = Regex("^(\\d{1,2}):(\\d{2})$").find(value ?: "") ?: return null
        return m.groupValues[1].toDouble() + m.groupValues[2].toDouble() / 60
    }
    val wake = parse(wakeTime) ?: 7.0
    var bed = parse(bedtime) ?: 23.0
    if (bed <= wake) bed = 24.0
    val start = max(0, floor(wake).toInt())
    val end = min(24, max(start + 1, ceil(bed).toInt()))
    return AwakeHours(start, end)
}

/** Bucket count for [startHour, endHour) in `bucketMinutes` steps. */
internal fun bucketCount(startHour: Int, endHour: Int, bucketMinutes: Int = 15) =
    max(1, ((endHour - startHour) * 60.0 / bucketMinutes).roundToInt())

internal data class StickBucket(val index: Int, val min: Double, val max: Double)

internal fun stickBuckets(samples: List<Pair<Double, Double>>, startHour: Int, endHour: Int, bucketMinutes: Int = 15): List<StickBucket?> {
    val count = bucketCount(startHour, endHour, bucketMinutes)
    val buckets = arrayOfNulls<StickBucket>(count)
    for ((hour, value) in samples) {
        if (hour < startHour || hour >= endHour) continue
        val index = min(count - 1, floor((hour - startHour) * 60 / bucketMinutes).toInt())
        val current = buckets[index]
        buckets[index] = if (current != null) StickBucket(index, min(current.min, value), max(current.max, value)) else StickBucket(index, value, value)
    }
    return buckets.toList()
}

internal fun sumBuckets(entries: List<Pair<Double, Double>>, startHour: Int, endHour: Int, bucketMinutes: Int = 15): List<Double> {
    val count = bucketCount(startHour, endHour, bucketMinutes)
    val sums = DoubleArray(count)
    for ((hour, kcal) in entries) {
        if (hour < startHour || hour >= endHour) continue
        sums[min(count - 1, floor((hour - startHour) * 60 / bucketMinutes).toInt())] += kcal
    }
    return sums.toList()
}

private data class Meal(val hour: Double, val share: Double, val spread: Double)

private val MEALS = listOf(Meal(7.75, 0.25, 0.9), Meal(12.5, 0.3, 1.0), Meal(18.25, 0.35, 1.1), Meal(15.5, 0.1, 0.8))

/** Recommended energy distribution over the day (shares sum to 1). */
internal fun recommendedShares(startHour: Int, endHour: Int, bucketMinutes: Int = 15): List<Double> {
    val count = bucketCount(startHour, endHour, bucketMinutes)
    val raw = DoubleArray(count) { i ->
        val hour = startHour + (i + 0.5) * bucketMinutes / 60
        MEALS.sumOf { meal ->
            val z = (hour - meal.hour) / meal.spread
            meal.share * exp(-(z * z))
        }
    }
    val total = raw.sum().takeIf { it != 0.0 } ?: 1.0
    return raw.map { it / total }
}

internal fun cumulative(values: List<Double>): List<Double> {
    var sum = 0.0
    return values.map { sum += it; sum }
}

internal fun aheadOfPlan(intakeSums: List<Double>, budgetKcal: Double, shares: List<Double>, elapsedBuckets: Int): Int {
    val idx = max(0, min(shares.size, elapsedBuckets)) - 1
    if (idx < 0) return 0
    val planned = cumulative(shares.map { it * budgetKcal }).getOrElse(idx) { 0.0 }
    val eaten = cumulative(intakeSums).getOrElse(idx) { 0.0 }
    return max(0.0, eaten - planned).roundToInt()
}

internal fun splitSurplus(surplusKcal: Int): Pair<Int, Int> {
    val reduce = (surplusKcal / 2.0 / 10).roundToInt() * 10
    return reduce to max(0, surplusKcal - reduce)
}

internal data class WalkOption(val key: String, val minutes: Int)

internal fun walkOptions(kcal: Int, weightKg: Double?): List<WalkOption> {
    val kg = if (weightKg != null && weightKg > 0) weightKg else 75.0
    return listOf("easy" to 2.8, "brisk" to 4.3, "fast" to 5.5).map { (key, met) ->
        WalkOption(key, max(5, (kcal / ((met * 3.5 * kg) / 200) / 5).roundToInt() * 5))
    }
}

internal data class GoalBar(val avgKcal: Double?, val lowKcal: Double?, val highKcal: Double?)

internal fun daysPerBar(totalDays: Int, maxBars: Int): Int {
    if (totalDays <= maxBars) return 1
    val raw = ceil(totalDays.toDouble() / max(1, maxBars)).toInt()
    return if (raw >= 5) ceil(raw / 7.0).toInt() * 7 else raw
}

/** Unmeasured days (null) are skipped; a bar with no measured day stays empty. */
internal fun groupDays(days: List<Double?>, perBar: Int): List<GoalBar> =
    days.chunked(perBar).map { slice ->
        val measured = slice.filterNotNull().filter { it > 0 }
        if (measured.isEmpty()) GoalBar(null, null, null) else GoalBar(measured.average(), measured.min(), measured.max())
    }

internal fun recommendedRange(budgetKcal: Double, floorKcal: Double): Pair<Double, Double> {
    val maxKcal = max(budgetKcal, floorKcal)
    val minKcal = min(maxKcal, max(floorKcal, (maxKcal * 0.85 / 10).roundToInt() * 10.0))
    return minKcal to maxKcal
}
