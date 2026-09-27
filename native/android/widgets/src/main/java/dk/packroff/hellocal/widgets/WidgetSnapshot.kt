// Mirror of `WidgetSnapshot` in src/lib/widgets.ts (GET /api/widgets/snapshot).
package dk.packroff.hellocal.widgets

import kotlinx.serialization.Serializable

@Serializable
data class WidgetSnapshot(
    val generatedAt: String,
    val locale: String,
    val tzOffsetMinutes: Int,
    val refreshAfterSeconds: Int,
    val today: Today,
    val charts: List<Chart>,
    val statBoxes: List<StatBox>,
    val addActions: List<AddAction>,
    val recentEntries: List<RecentEntry>,
    val paths: Paths,
) {
    @Serializable
    data class Today(val date: String, val eatenKcal: Int, val goalKcal: Int, val leftKcal: Int, val overGoal: Boolean)

    @Serializable
    data class ChartPoint(val date: String, val value: Double? = null)

    @Serializable
    data class Chart(
        val key: String,
        val label: String,
        val unit: String,
        val goal: Double? = null,
        val points: List<ChartPoint>,
        val path: String,
        val deepLink: String,
    )

    @Serializable
    data class StatBox(
        val key: String,
        val label: String,
        val value: String,
        val progress: Double? = null,
        val path: String,
        val deepLink: String,
    )

    @Serializable
    data class AddAction(val key: String, val label: String, val path: String, val deepLink: String)

    @Serializable
    data class RecentEntry(
        val id: String,
        val title: String,
        val kcal: Int,
        val amountGrams: Double,
        val createdAt: String,
        val imageUrl: String? = null,
        val path: String,
        val deepLink: String,
    )

    @Serializable
    data class Paths(val add: String, val statistics: String, val calendar: String)

    fun statBox(key: String?): StatBox? = statBoxes.firstOrNull { it.key == (key ?: "kcalLeft") } ?: statBoxes.firstOrNull()
}

/** Same defaults as DEFAULT_ADD_ROW_KEYS / DEFAULT_STAT_BOX_KEY in src/lib/widgets.ts. */
val DEFAULT_ADD_ROW_KEYS = listOf("search", "camera", "water", "weight")
const val MAX_ADD_ROW_ACTIONS = 5
const val DEFAULT_STAT_BOX_KEY = "kcalLeft"
