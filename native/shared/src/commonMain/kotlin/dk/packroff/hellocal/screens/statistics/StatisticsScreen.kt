package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.app.TrendIcon
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcDivider
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonObject

/**
 * Native port of src/app/statistics/page.tsx (+ statistics/layout.tsx's
 * PremiumGate). Charts and cards in the user's own order, one global period
 * for the cards, "Udregn" meal insights.
 */
@Composable
fun StatisticsScreen(args: RouteArgs) {
    StatisticsPremiumGate(renderWhilePending = true) { pending -> StatisticsContent(pending) }
}

private class PageExtras(
    val activities: List<StatActivity>,
    val integrations: List<StatIntegration>,
    val metrics: List<StatMetric>,
    val profile: JsonObject,
)

@Composable
private fun StatisticsContent(premiumPending: Boolean) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val tier = rememberSubscriptionTier()

    var registrations by remember { mutableStateOf<List<StatRegistration>>(emptyList()) }
    var activities by remember { mutableStateOf<List<StatActivity>>(emptyList()) }
    var metrics by remember { mutableStateOf<List<StatMetric>>(emptyList()) }
    var hasConnectedIntegration by remember { mutableStateOf(false) }
    var warnOnRecommendedLimits by remember { mutableStateOf(false) }
    var autoExpandUncertainty by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    // G3: registrations with classification for the meat/drink cards.
    var sources by remember { mutableStateOf<List<StatRegistration>>(emptyList()) }
    var sourcesLoading by remember { mutableStateOf(true) }
    // The user chooses whether Charts or Cards come first (saved per device).
    var sectionOrder by remember { mutableStateOf(loadSectionOrder()) }
    var periodSelection by remember { mutableStateOf(DEFAULT_STAT_SELECTION) }
    // "Tilføj" only shows while a section is being edited — or is empty.
    var showAddChart by remember { mutableStateOf(false) }
    var showAddCard by remember { mutableStateOf(false) }
    var editingCharts by remember { mutableStateOf(false) }
    var editingCards by remember { mutableStateOf(false) }
    val showAdd = showAddChart || showAddCard
    val showSectionHeaders = editingCharts || editingCards

    val scrollState = rememberScrollState()
    val edit = remember { StatsEditController(scrollState) }
    var viewportOrigin by remember { mutableStateOf(Offset.Zero) }

    LaunchedEffect(premiumPending) {
        if (premiumPending) return@LaunchedEffect
        coroutineScope {
            // The page and useSourceRegistrations both read /api/registrations;
            // one request serves both here.
            val registrationsJob = async { attempt { loadRegistrations() } }
            val othersJob = async {
                attempt {
                    coroutineScope {
                        val a = async { loadActivities() }
                        val i = async { loadIntegrations() }
                        val m = async { loadMetrics() }
                        val p = async { loadProfileUser() }
                        PageExtras(a.await(), i.await(), m.await(), p.await())
                    }
                }
            }
            val loadedRegistrations = registrationsJob.await()
            sources = loadedRegistrations ?: emptyList()
            sourcesLoading = false
            val others = othersJob.await()
            if (loadedRegistrations != null && others != null) {
                registrations = loadedRegistrations
                activities = others.activities
                metrics = others.metrics
                hasConnectedIntegration = others.integrations.any { it.connectable && it.status == "CONNECTED" }
                warnOnRecommendedLimits = others.profile.flag("warnOnRecommendedLimits") == true
                autoExpandUncertainty = others.profile.flag("autoExpandUncertainty") == true
            } else {
                registrations = emptyList()
                activities = emptyList()
                metrics = emptyList()
                hasConnectedIntegration = false
                warnOnRecommendedLimits = false
            }
            loading = false
        }
    }

    val allDays = remember(registrations) { groupByDay(registrations) }
    val activeRange = remember(periodSelection) { selectionRange(periodSelection) }
    val activePeriodDays = remember(activeRange) {
        maxOf(1, kotlin.math.round((activeRange.endMillis - activeRange.startMillis) / 86_400_000.0).toInt())
    }
    val periodSources = remember(sources, activeRange) { sources.filter { activeRange.contains(it.createdAtMillis) } }

    // One global period (StatPeriodPicker) for all cards.
    val statCards = remember(allDays, activities, hasConnectedIntegration, metrics, loading, activeRange, sourcesLoading, periodSources) {
        computeStatCards(
            StatCardData(
                days = allDays.inRange(activeRange),
                activities = if (hasConnectedIntegration) activities.filter { activeRange.contains(it.startedAtMillis) } else null,
                metrics = metrics.filter { activeRange.contains(it.recordedAtMillis) },
                sources = if (sourcesLoading) null else periodSources,
            ),
        ).map { it.withValue(if (loading) "—" else it.value, loading) }
    }

    val recentRegistrations = remember(registrations, activeRange) { registrations.filter { activeRange.contains(it.createdAtMillis) } }
    val chartData = rememberStatChartData(
        registrations = registrations,
        activities = activities,
        metrics = metrics,
        intradayRegistrations = recentRegistrations,
        intradayWindowDays = activePeriodDays,
        enabled = !premiumPending,
    )

    HcScreen(
        t.t("statistics.title"),
        back = nav.showBack,
        scroll = false,
        contentPadding = PaddingValues(0.dp),
        icon = { TrendIcon(HcColors.White, size = 20) },
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .onGloballyPositioned {
                    val bounds = it.boundsInRoot()
                    viewportOrigin = bounds.topLeft
                    edit.viewportTop = bounds.top
                    edit.viewportBottom = bounds.bottom
                }
                .pointerInput(edit) { detectBackgroundTap(edit) { viewportOrigin } }
                .verticalScroll(scrollState)
                .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // One shared "Tilføj" at the top: charts and cards are chosen on the same page.
            if (showAdd) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Row(
                        Modifier.heightIn(min = 32.dp).clickable { nav.push("/statistics/unused-cards") },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        HcIcon("Plus", size = 14.dp, stroke = 2.5f, color = HcColors.Black)
                        HcText(t.t("statSections.add"), HcTypeRoles.Small, bold = true, color = HcColors.Black)
                    }
                }
            }

            sectionOrder.forEachIndexed { index, key ->
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    if (index > 0) HcDivider()
                    if (showSectionHeaders) {
                        SectionHeader(
                            title = t.t(if (key == StatSectionKey.Charts) "statSections.chartsHeading" else "statSections.cardsHeading"),
                            canMoveUp = index > 0,
                            canMoveDown = index < sectionOrder.size - 1,
                            onMove = { delta ->
                                sectionOrder = moveSection(sectionOrder, key, delta).also { saveSectionOrder(it) }
                            },
                        )
                    }
                    if (key == StatSectionKey.Charts) {
                        StatChartsSection(
                            edit = edit,
                            onShowAddChange = { showAddChart = it },
                            onEditModeChange = { editingCharts = it },
                        ) { chartKey -> StatChartView(chartKey, chartData) }
                    } else {
                        StatPeriodPicker(periodSelection) { periodSelection = it }
                        StatCardsGrid(
                            cards = statCards,
                            highlightRecommendedLimits = warnOnRecommendedLimits,
                            autoExpandUncertainty = autoExpandUncertainty,
                            loading = loading,
                            edit = edit,
                            onShowAddChange = { showAddCard = it },
                            onEditModeChange = { editingCards = it },
                        )
                        MealInsightsButton(tier)
                        // "Største syndere" is switched off until there is a volume limit (SINNERS_ENABLED).
                    }
                }
            }
        }
    }
}

/** The "Grafer"/"Kort" heading with up/down arrows — only while editing. */
@Composable
private fun SectionHeader(title: String, canMoveUp: Boolean, canMoveDown: Boolean, onMove: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        HcText(title, HcTypeRoles.BodyLg, Modifier.weight(1f), bold = true, color = HcColors.Black)
        Box(
            Modifier.size(32.dp).alpha(if (canMoveUp) 1f else 0.25f).clickable(enabled = canMoveUp) { onMove(-1) },
            contentAlignment = Alignment.Center,
        ) {
            HcIcon("ChevronUp", size = 18.dp, stroke = 2f, color = HcColors.Black)
        }
        Box(
            Modifier.size(32.dp).alpha(if (canMoveDown) 1f else 0.25f).clickable(enabled = canMoveDown) { onMove(1) },
            contentAlignment = Alignment.Center,
        ) {
            HcIcon("ChevronDown", size = 18.dp, stroke = 2f, color = HcColors.Black)
        }
    }
}
