package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.style.TextAlign
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
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.datetime.LocalDate

// "Månedens synder" (G3, docs/DECISIONS.md 2026-09-24): opened from the button
// under the calendar's month view with ?month=YYYY-MM. Grouped by product
// type, biggest first, with the items under each group.

private fun monthStart(param: String?): LocalDate {
    val match = param?.let { Regex("^(\\d{4})-(\\d{2})$").matchEntire(it) }
    val today = todayLocal()
    val year = match?.groupValues?.get(1)?.toInt() ?: today.year
    val month = match?.groupValues?.get(2)?.toInt() ?: today.monthNumber
    // new Date(year, month - 1, 1) also accepts month 0/13 by rolling the year.
    return LocalDate(year, 1, 1).plusMonths(month - 1)
}

private fun monthParam(date: LocalDate): String = "${date.year}-${date.monthNumber.toString().padStart(2, '0')}"

/** Native port of src/app/statistics/month-sinners/page.tsx. */
@Composable
fun MonthSinnersScreen(args: RouteArgs) {
    StatisticsPremiumGate(renderWhilePending = false) { MonthSinnersContent(args) }
}

@Composable
private fun MonthSinnersContent(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val start = remember(args.opt("month")) { monthStart(args.opt("month")) }
    val range = DayRange(start, start.plusMonths(1))
    var registrations by remember { mutableStateOf<List<StatRegistration>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var metric by remember { mutableStateOf(SourceMetric.Kcal) }

    LaunchedEffect(Unit) {
        registrations = attempt { loadRegistrations() } ?: emptyList()
        loading = false
    }

    val groups = remember(registrations, range, metric) {
        groupSourcesByProductType(registrations.filter { range.contains(it.createdAtMillis) }, metric)
    }
    val monthLabel = daMonthYear(start).replaceFirstChar { it.uppercase() }

    fun moveMonth(direction: Int) {
        nav.replace("/statistics/month-sinners?month=${monthParam(start.plusMonths(direction))}")
    }

    HcScreen("Månedens synder", back = nav.showBack) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                MonthNavButton("ChevronLeft", t.t("calendar.periodNavAriaLabel", "direction" to t.t("calendar.previous"), "period" to t.t("calendar.periodMonth"))) { moveMonth(-1) }
                Box(Modifier.heightIn(min = 44.dp).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                    HcText(monthLabel, HcTypeRoles.Body, bold = true, color = HcColors.Black, maxLines = 1)
                }
                MonthNavButton("ChevronRight", t.t("calendar.periodNavAriaLabel", "direction" to t.t("calendar.next"), "period" to t.t("calendar.periodMonth"))) { moveMonth(1) }
            }
            // SourceMetricTabs: Kalorier | Fedt | Sukker
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SourceMetric.entries.forEach { option ->
                    StatsChoiceChip(option.label, selected = option == metric, onClick = { metric = option }, modifier = Modifier.weight(1f))
                }
            }

            when {
                loading -> HcText("Henter…", HcTypeRoles.Body, Modifier.fillMaxWidth().padding(vertical = 32.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
                groups.isEmpty() -> HcText(
                    "Ingen registreringer i denne måned",
                    HcTypeRoles.Body,
                    Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    color = HcColors.TextSecondary,
                    align = TextAlign.Center,
                )
                else -> groups.forEach { group ->
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            HcText(group.productType, HcTypeRoles.Body, Modifier.weight(1f).alignByBaseline(), bold = true, color = HcColors.Black, maxLines = 1)
                            HcText(
                                "${formatMetric(group.value, metric)} · ${formatShare(group.share)}",
                                HcTypeRoles.Small,
                                Modifier.alignByBaseline(),
                                bold = true,
                                color = HcColors.Black,
                            )
                        }
                        SourceItemList(group.items, metric)
                    }
                }
            }
        }
    }
}

/** The calendar's PeriodButton: a 44 px round icon button. */
@Composable
private fun MonthNavButton(icon: String, description: String, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        HcIcon(icon, size = 22.dp, color = HcColors.Black, contentDescription = description)
    }
}

/** src/components/SourceRows.tsx — FoodRow-style rows with only the chosen value on the right. */
@Composable
private fun SourceItemList(items: List<SourceItem>, metric: SourceMetric) {
    val nav = LocalNavigator.current
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan)) {
        items.forEachIndexed { index, item ->
            if (index > 0) HcDivider()
            Row(
                Modifier
                    .fillMaxWidth()
                    .let { if (item.productId != null) it.clickable { nav.push("/add/${item.productId}") } else it }
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan), contentAlignment = Alignment.Center) {
                    if (item.imageUrl != null) {
                        HcRemoteImage(item.imageUrl, Modifier.size(44.dp).padding(4.dp), contentScale = ContentScale.Fit)
                    } else {
                        HcIcon("ToolsKitchen2", size = 20.dp)
                    }
                }
                HcText(item.title, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black, maxLines = 2)
                HcText(formatMetric(item.value, metric), HcTypeRoles.Body, bold = true, color = HcColors.Black)
            }
        }
    }
}
