package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.StatsAccordionSection
import dk.packroff.hellocal.ui.StatsSearchField
import dk.packroff.hellocal.ui.statsOutline
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

// "Tilføj til statistik" (src/app/statistics/unused-cards/page.tsx): every
// chart and card that is not on the statistics page yet, grouped in fold-out
// blocks, with a search across all of them and the layout tools (heading,
// divider, fold-out box) on top. Each item is added one at a time.

/** src/lib/nutrition-terminology.ts — the region's own word for the nutrition section. */
internal fun nutritionSectionLabel(region: String?): String = when ((region ?: "DK").trim().uppercase()) {
    "DK" -> "Næringsindhold"
    "US", "CA" -> "Nutrition Facts"
    "GB", "IE", "AU", "NZ" -> "Nutrition information"
    "DE", "AT", "CH" -> "Nährwerte"
    "FR", "BE" -> "Informations nutritionnelles"
    "NL" -> "Voedingswaarde"
    "ES" -> "Información nutricional"
    "IT" -> "Valori nutrizionali"
    else -> "Næringsindhold"
}

private class CardCategory(val title: String, val keys: List<String>, val includeSportCards: Boolean = false)

private fun cardCategories(t: Translator, region: String): List<CardCategory> = listOf(
    CardCategory(nutritionSectionLabel(region), listOf("calories", "protein", "carbs", "fat", "saturatedFat", "unsaturatedFat", "transFat", "cholesterol", "salt")),
    CardCategory(t.t("statUnusedCards.category.carbsFibre"), listOf("sugar", "fiber")),
    CardCategory(
        t.t("statUnusedCards.category.minerals"),
        listOf("calcium", "chloride", "chromium", "fluoride", "phosphorus", "iron", "iodine", "potassium", "copper", "magnesium", "manganese", "molybdenum", "sodium", "selenium", "zinc"),
    ),
    CardCategory(
        t.t("statUnusedCards.category.vitamins"),
        listOf("vitaminA", "vitaminB1", "vitaminB2", "vitaminB3", "vitaminB5", "vitaminB6", "vitaminB7", "vitaminB9", "vitaminB12", "vitaminC", "vitaminD", "vitaminE", "vitaminK"),
    ),
    CardCategory("Kød, fisk og drikke", FOOD_SOURCE_STAT_KEYS),
    CardCategory(t.t("statUnusedCards.category.allergensAdditives"), listOf("allergens", "additives", "toxins")),
    CardCategory(
        t.t("statUnusedCards.category.sportActivity"),
        listOf(
            "steps", "distanceKm", "burned", "exerciseMinutes", "standMinutes", "floorsClimbed",
            "activeZoneMinutes", "heartRate", "restingHeartRate", "restingHeartRateMinutes",
            "heartRateMin", "heartRateMax", "hrv", "vo2Max", "heartRateRecovery",
            "respiratoryRate", "spo2", "temperature", "stress", "edaResponses", "cardioLoad",
        ),
        includeSportCards = true,
    ),
    CardCategory(t.t("statUnusedCards.category.body"), BODY_STAT_KEYS),
    CardCategory(t.t("statUnusedCards.category.heartHealth"), HEART_HEALTH_STAT_KEYS),
    CardCategory(
        t.t("statUnusedCards.category.sleep"),
        listOf("sleepDuration", "sleepInBed", "sleepBedtime", "sleepWakeTime", "sleepAwake", "sleepRem", "sleepLight", "sleepDeep", "sleepScore", "sleepEfficiency", "sleepAwakenings"),
    ),
    CardCategory(t.t("statUnusedCards.category.other"), listOf("water", "daysLogged", "goalsMet")),
)

/** The preview's day profile uses the statistics page's default period. */
internal const val PREVIEW_INTRADAY_DAYS = 7

/** Native port of src/app/statistics/unused-cards/page.tsx. */
@Composable
fun UnusedStatCardsScreen(args: RouteArgs) {
    StatisticsPremiumGate(renderWhilePending = false) { UnusedStatCardsContent() }
}

@Composable
private fun UnusedStatCardsContent() {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var registrations by remember { mutableStateOf<List<StatRegistration>>(emptyList()) }
    var activities by remember { mutableStateOf<List<StatActivity>>(emptyList()) }
    var metrics by remember { mutableStateOf<List<StatMetric>>(emptyList()) }
    var hasConnectedIntegration by remember { mutableStateOf(false) }
    var region by remember { mutableStateOf("DK") }
    var loading by remember { mutableStateOf(true) }
    var sources by remember { mutableStateOf<List<StatRegistration>>(emptyList()) }
    var sourcesLoading by remember { mutableStateOf(true) }
    var activeKeys by remember { mutableStateOf(activeStatKeys()) }
    var activeChartKeys by remember { mutableStateOf(loadChartLayout().toSet()) }
    var query by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        coroutineScope {
            val regsJob = async { attempt { loadRegistrations() } }
            val othersJob = async {
                attempt {
                    coroutineScope {
                        val a = async { loadActivities() }
                        val i = async { loadIntegrations() }
                        val m = async { loadMetrics() }
                        val p = async { loadProfileUser() }
                        Triple(a.await(), i.await(), m.await()) to p.await()
                    }
                }
            }
            val regs = regsJob.await()
            sources = regs ?: emptyList()
            sourcesLoading = false
            val others = othersJob.await()
            if (regs != null && others != null) {
                registrations = regs
                activities = others.first.first
                hasConnectedIntegration = others.first.second.any { it.connectable && it.status == "CONNECTED" }
                metrics = others.first.third
                region = others.second.string("region") ?: "DK"
            } else {
                registrations = emptyList()
                activities = emptyList()
                hasConnectedIntegration = false
                metrics = emptyList()
                region = "DK"
            }
            loading = false
        }
    }

    // All charts in one "Grafer" block at the top.
    val chartOptions = remember(activeChartKeys, t) {
        STAT_CHART_DEFS.filter { it.key !in activeChartKeys }.map { it.key to statChartLabel(it, t) }
    }

    val allCards = remember(registrations, activities, metrics, hasConnectedIntegration, sources, sourcesLoading) {
        computeStatCards(
            StatCardData(
                days = groupByDay(registrations.withinLastDays(STAT_WINDOW_DAYS) { it.createdAtMillis }),
                activities = if (hasConnectedIntegration) activities.withinLastDays(STAT_WINDOW_DAYS) { it.startedAtMillis } else null,
                metrics = metrics.withinLastDays(STAT_WINDOW_DAYS) { it.recordedAtMillis },
                sources = if (sourcesLoading) null else sources.withinLastDays(STAT_WINDOW_DAYS) { it.createdAtMillis },
            ),
        )
    }
    val cardByKey = remember(allCards) { allCards.associateBy { it.key } }

    val categories = remember(t, region, cardByKey, allCards, activeKeys) {
        cardCategories(t, region).map { category ->
            val categoryCards = category.keys.mapNotNull { cardByKey[it] }
            val sportCards = if (category.includeSportCards) allCards.filter { it.key.startsWith(SPORT_STAT_KEY_PREFIX) } else emptyList()
            category.title to (categoryCards + sportCards).filter { it.key !in activeKeys }
        }
    }

    // Search across every block: matches the card's name or the block's title.
    val normalizedQuery = query.trim().lowercase()
    val searchResults = remember(categories, normalizedQuery) {
        if (normalizedQuery.isEmpty()) emptyList() else {
            val seen = mutableSetOf<String>()
            categories.flatMap { (title, cards) ->
                val categoryMatches = title.lowercase().contains(normalizedQuery)
                cards.filter { card -> (categoryMatches || card.label.lowercase().contains(normalizedQuery)) && seen.add(card.key) }
            }
        }
    }
    val chartSearchResults = remember(chartOptions, normalizedQuery) {
        if (normalizedQuery.isEmpty()) emptyList() else chartOptions.filter { it.second.lowercase().contains(normalizedQuery) }
    }

    val previewRegistrations = remember(registrations) { registrations.withinLastDays(PREVIEW_INTRADAY_DAYS) { it.createdAtMillis } }
    val chartData = rememberStatChartData(registrations, activities, metrics, previewRegistrations, PREVIEW_INTRADAY_DAYS)

    fun addChart(key: String) {
        addChartsToLayout(listOf(key))
        activeChartKeys = activeChartKeys + key
        nav.back()
    }

    fun addCard(key: String) {
        addStatCardToLayout(key)
        activeKeys = activeKeys + key
        nav.back()
    }

    HcScreen(t.t("statUnusedCards.title"), back = nav.showBack) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HcText(t.t("statUnusedCards.hint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            StatsSearchField(query, { query = it }, t.t("statUnusedCards.searchPlaceholder"))

            // Search results right under the field, before the layout tools.
            if (normalizedQuery.isNotEmpty()) {
                Column(Modifier.padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(t.t("statUnusedCards.searchResults"), HcTypeRoles.Body, Modifier.padding(horizontal = 4.dp), bold = true, color = HcColors.Black)
                    if (searchResults.isEmpty() && chartSearchResults.isEmpty()) {
                        EmptyNote(t.t("statUnusedCards.noSearchResults"))
                    } else {
                        if (chartSearchResults.isNotEmpty()) ChartPreviewList(chartSearchResults.map { it.first }, chartData, ::addChart)
                        if (searchResults.isNotEmpty()) CardGrid(searchResults, loading, ::addCard)
                    }
                }
            }

            // Layout tools (heading, divider, fold-out box) together on top, in a darker box.
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.TanDark).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = HcDimens.ControlHeight)
                        .clip(RoundedCornerShape(HcDimens.RadiusCard))
                        .statsOutline(HcColors.Black.copy(alpha = 0.3f), width = 1.dp)
                        .clickable {
                            addHeaderToLayout()
                            nav.back()
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    HcText(t.t("statUnusedCards.addHeading"), HcTypeRoles.Body, bold = true, color = HcColors.TextSecondary)
                }
                // The same heading with lines as on every other page (.hf-type-section-title).
                Box(
                    Modifier.fillMaxWidth().heightIn(min = 44.dp).clickable {
                        addDividerToLayout()
                        nav.back()
                    },
                    contentAlignment = Alignment.Center,
                ) {
                    HcSectionTitle(t.t("statUnusedCards.addDivider"))
                }
                // Looks like a closed fold-out box as on the statistics page.
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = HcDimens.ControlHeight)
                        .clip(RoundedCornerShape(HcDimens.RadiusCard))
                        .background(HcColors.Tan)
                        .statsOutline(HcColors.Black.copy(alpha = 0.3f), width = 1.dp)
                        .clickable {
                            addAccordionToLayout(t.t("statUnusedCards.accordionTitle"))
                            nav.back()
                        }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    HcText(t.t("statUnusedCards.addAccordion"), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.TextSecondary)
                    HcChevron(ChevronDirection.Right)
                }
            }

            StatsAccordionSection(
                title = t.t("statSections.chartsHeading"),
                count = chartOptions.size,
                bodyPadding = if (chartOptions.isEmpty()) PaddingValues(12.dp) else PaddingValues(vertical = 12.dp),
            ) {
                if (chartOptions.isEmpty()) EmptyNote(t.t("statUnusedCharts.noChartsLeft"))
                else ChartPreviewList(chartOptions.map { it.first }, chartData, ::addChart)
            }

            categories.forEachIndexed { index, (title, cards) ->
                // Only the first group (Næringsindhold) starts open.
                androidx.compose.runtime.key(title) {
                    StatsAccordionSection(title = title, count = cards.size, defaultOpen = index == 0) {
                        if (cards.isEmpty()) EmptyNote(t.t("statUnusedCards.noCardsYet"))
                        else CardGrid(cards, loading, ::addCard)
                    }
                }
            }
        }
    }
}

/** `rounded-2xl bg-hf-tan/60 p-4 opacity-50` note for an empty block. */
@Composable
internal fun EmptyNote(text: String) {
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan.copy(alpha = 0.6f)).padding(16.dp).alpha(0.5f)) {
        HcText(text, HcTypeRoles.Small, color = HcColors.Black)
    }
}

/** src/components/StatChartPreviewList.tsx — full-width charts, each with "+ Tilføj" under it. */
@Composable
internal fun ChartPreviewList(keys: List<String>, data: StatChartData, onAdd: (String) -> Unit) {
    val t = LocalTranslator.current
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        keys.forEach { key ->
            androidx.compose.runtime.key(key) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatChartView(key, data)
                    HcButton(t.t("statUnusedCards.add"), onClick = { onAdd(key) }, kind = HcButtonKind.Secondary)
                }
            }
        }
    }
}

/** Cards are added one at a time: the whole card is the "+ Tilføj" button. */
@Composable
private fun CardGrid(cards: List<StatCardValue>, loading: Boolean, onAdd: (String) -> Unit) {
    val t = LocalTranslator.current
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        cards.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                row.forEach { card ->
                    Column(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(HcDimens.RadiusCard))
                            .background(HcColors.Card)
                            .clickable { onAdd(card.key) }
                            .padding(HcDimens.SpaceBlock),
                        verticalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            HcText(card.label, HcTypeRoles.Small, Modifier.weight(1f), color = HcColors.TextSecondary)
                            HcText(t.t("statUnusedCards.add"), HcTypeRoles.Small, bold = true, color = HcColors.Black, maxLines = 1)
                        }
                        Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            StatCardIcon(card.icon, card.iconSrc)
                            HcText(if (loading) "—" else card.value, HcTypeRoles.BodyLg, bold = true, color = HcColors.Black)
                        }
                    }
                }
                if (row.size == 1) Box(Modifier.weight(1f))
            }
        }
    }
}
