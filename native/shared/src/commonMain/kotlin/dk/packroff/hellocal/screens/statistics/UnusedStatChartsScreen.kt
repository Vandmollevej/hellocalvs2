package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.StatsAccordionSection
import dk.packroff.hellocal.ui.StatsSearchField
import kotlinx.coroutines.launch

// Same build-up as /statistics/unused-cards, but only for the charts at the
// top of the statistics page: search across the blocks and "+ Tilføj" on
// every chart (one at a time). Charts are shown full width, as they will look.

private fun chartCategories(t: Translator, region: String): List<Pair<String, List<String>>> = listOf(
    t.t("statUnusedCharts.category.energyWeight") to listOf("caloriesAndWeight", "intradayKcal", "sleepQuality"),
    t.t("bodyMeasurements.title") to BODY_MEASUREMENT_CHART_KEYS,
    nutritionSectionLabel(region) to listOf(
        "daily:protein", "daily:carbs", "daily:fat", "daily:saturatedFat", "daily:unsaturatedFat",
        "daily:transFat", "daily:cholesterol", "daily:salt",
    ),
    t.t("statUnusedCards.category.carbsFibre") to listOf("daily:sugar", "daily:fiber"),
    t.t("statUnusedCards.category.sleep") to listOf("sleep:quality", "sleep:kcal", "sleep:coffee", "sleep:sport", "sleep:device", "sleep:bodyFat"),
    t.t("statUnusedCards.category.minerals") to listOf("minerals"),
    t.t("statUnusedCards.category.vitamins") to listOf("vitamins"),
)

/** Native port of src/app/statistics/unused-charts/page.tsx. */
@Composable
fun UnusedStatChartsScreen(args: RouteArgs) {
    StatisticsPremiumGate(renderWhilePending = false) { UnusedStatChartsContent() }
}

@Composable
private fun UnusedStatChartsContent() {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var region by remember { mutableStateOf("DK") }
    var activeKeys by remember { mutableStateOf(loadChartLayout().toSet()) }
    var query by remember { mutableStateOf("") }
    var registrations by remember { mutableStateOf<List<StatRegistration>>(emptyList()) }
    var activities by remember { mutableStateOf<List<StatActivity>>(emptyList()) }
    var metrics by remember { mutableStateOf<List<StatMetric>>(emptyList()) }

    // Data for the chart previews (each request on its own, failures ignored).
    LaunchedEffect(Unit) {
        launch { attempt { loadRegistrations() }?.let { registrations = it } }
        launch { attempt { loadActivities() }?.let { activities = it } }
        launch { attempt { loadMetrics() }?.let { metrics = it } }
        launch { region = attempt { loadProfileUser() }?.string("region") ?: "DK" }
    }

    val previewRegistrations = remember(registrations) { registrations.withinLastDays(PREVIEW_INTRADAY_DAYS) { it.createdAtMillis } }
    val chartData = rememberStatChartData(registrations, activities, metrics, previewRegistrations, PREVIEW_INTRADAY_DAYS)

    val categories = remember(t, region, activeKeys) {
        chartCategories(t, region).map { (title, keys) ->
            title to keys.filter { it !in activeKeys }.mapNotNull { statChartDef(it) }.map { it.key to statChartLabel(it, t) }
        }
    }

    // Search across all blocks: matches the chart's name or the block's title.
    val normalizedQuery = query.trim().lowercase()
    val searchResults = remember(categories, normalizedQuery) {
        if (normalizedQuery.isEmpty()) emptyList()
        else categories.flatMap { (title, options) ->
            val categoryMatches = title.lowercase().contains(normalizedQuery)
            options.filter { categoryMatches || it.second.lowercase().contains(normalizedQuery) }
        }
    }

    fun addChart(key: String) {
        addChartsToLayout(listOf(key))
        activeKeys = activeKeys + key
        nav.back()
    }

    HcScreen(t.t("statUnusedCharts.title"), back = nav.showBack) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HcText(t.t("statUnusedCharts.hint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            StatsSearchField(query, { query = it }, t.t("statUnusedCharts.searchPlaceholder"))

            if (normalizedQuery.isNotEmpty()) {
                Column(Modifier.padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(t.t("statUnusedCards.searchResults"), HcTypeRoles.Body, Modifier.padding(horizontal = 4.dp), bold = true, color = HcColors.Black)
                    if (searchResults.isEmpty()) EmptyNote(t.t("statUnusedCharts.noSearchResults"))
                    else ChartPreviewList(searchResults.map { it.first }, chartData, ::addChart)
                }
            }

            categories.forEachIndexed { index, (title, options) ->
                key(title) {
                    StatsAccordionSection(
                        title = title,
                        count = options.size,
                        defaultOpen = index == 0,
                        bodyPadding = if (options.isEmpty()) PaddingValues(12.dp) else PaddingValues(vertical = 12.dp),
                    ) {
                        if (options.isEmpty()) EmptyNote(t.t("statUnusedCharts.noChartsLeft"))
                        else ChartPreviewList(options.map { it.first }, chartData, ::addChart)
                    }
                }
            }
        }
    }
}
