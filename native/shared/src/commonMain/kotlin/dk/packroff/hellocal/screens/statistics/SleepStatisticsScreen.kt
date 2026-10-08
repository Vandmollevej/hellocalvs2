package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcDivider
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.StatsChoiceChip
import dk.packroff.hellocal.ui.StatsSkeleton
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

// src/lib/use-sleep-stat-inputs.ts — everything the sleep and body-water
// statistics need besides the ratings (each request falls back to empty).
internal class SleepStatInputs(
    val loading: Boolean,
    val registrations: List<StatRegistration> = emptyList(),
    val activities: List<StatActivity> = emptyList(),
    val metrics: List<StatMetric> = emptyList(),
    val integrations: List<StatIntegration> = emptyList(),
)

@Composable
internal fun rememberSleepStatInputs(): SleepStatInputs {
    var inputs by remember { mutableStateOf(SleepStatInputs(loading = true)) }
    LaunchedEffect(Unit) {
        coroutineScope {
            val r = async { attempt { loadRegistrations() } ?: emptyList() }
            val a = async { attempt { loadActivities() } ?: emptyList() }
            val m = async { attempt { loadMetrics() } ?: emptyList() }
            val i = async { attempt { loadIntegrations() } ?: emptyList() }
            inputs = SleepStatInputs(false, r.await(), a.await(), m.await(), i.await())
        }
    }
    return inputs
}

/** The period buttons shared by the sleep and body-water statistics. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SleepPeriodChips(period: SleepStatPeriodKey, onChange: (SleepStatPeriodKey) -> Unit) {
    val t = LocalTranslator.current
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SleepStatPeriodKey.entries.forEach { key ->
            StatsChoiceChip(t.t("sleepStats.period.${key.key}"), selected = period == key, onClick = { onChange(key) })
        }
    }
}

/** src/components/IntegrationIcon.tsx — the logo, or the first letter until a logo exists. */
@Composable
internal fun StatsIntegrationIcon(icon: String?, label: String, size: Int) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    if (icon != null) {
        HcRemoteImage(icon, Modifier.size(size.dp).clip(shape), contentScale = ContentScale.Fit)
    } else {
        Box(Modifier.size(size.dp).clip(shape).background(HcColors.White), contentAlignment = Alignment.Center) {
            HcText(label.take(1).uppercase(), HcTypeRoles.Body, bold = true, color = HcColors.Black)
        }
    }
}

/**
 * Native port of src/app/statistics/sleep/page.tsx — opened from "Statistik"
 * in the calendar's sleep bar. Period choice on top; the charts also exist as
 * optional charts on the statistics page.
 */
@Composable
fun SleepStatisticsScreen(args: RouteArgs) {
    StatisticsPremiumGate(renderWhilePending = false) { SleepStatisticsContent() }
}

@Composable
private fun SleepStatisticsContent() {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var period by remember { mutableStateOf(SleepStatPeriodKey.Last7) }
    val periodDays = remember(period) { sleepPeriodDays(period) }
    val inputs = rememberSleepStatInputs()
    var ratings by remember { mutableStateOf<List<SleepRating>>(emptyList()) }

    LaunchedEffect(periodDays) {
        attempt { loadSleepQuality(periodDays.first(), periodDays.last()) }?.let { ratings = it }
    }

    val days = remember(periodDays, ratings, inputs) {
        buildSleepStatDays(periodDays, ratings, inputs.registrations, inputs.activities, inputs.metrics)
    }
    val connected = inputs.integrations.filter { it.status == "CONNECTED" }
    val available = inputs.integrations.filter { it.kind != "unavailable" && !it.legacy && it.status != "CONNECTED" }

    HcScreen(t.t("sleepStats.title"), back = nav.showBack) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SleepPeriodChips(period) { period = it }

            if (inputs.loading) {
                StatsSkeleton(Modifier.fillMaxWidth().height(224.dp))
            } else {
                SleepInsightChart(SleepInsightKind.Quality, days)
                SleepInsightChart(SleepInsightKind.Kcal, days)
                SleepInsightChart(SleepInsightKind.Coffee, days)
                SleepInsightChart(SleepInsightKind.Sport, days)
                if (connected.isNotEmpty()) SleepInsightChart(SleepInsightKind.Device, days)
                SleepInsightChart(SleepInsightKind.BodyFat, days)
            }

            if (!inputs.loading && connected.isEmpty() && available.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    HcText(t.t("sleepStats.devicesHeading"), HcTypeRoles.BodyLg, bold = true, color = HcColors.Black)
                    HcText(t.t("sleepStats.devicesIntro"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.White)) {
                        available.forEachIndexed { index, integration ->
                            if (index > 0) HcDivider()
                            Row(
                                Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = HcDimens.ControlHeight)
                                    .clickable { nav.push("/settings/integrations/${integration.pageSlug}") }
                                    .padding(horizontal = 16.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                StatsIntegrationIcon(integration.icon, integration.label, 32)
                                Column(Modifier.weight(1f)) {
                                    HcText(integration.label, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                                    HcText(integration.description, HcTypeRoles.Small, color = HcColors.TextSecondary)
                                }
                                HcIcon("ChevronRight", size = 18.dp, color = HcColors.Black)
                            }
                        }
                    }
                }
            }
        }
    }
}
