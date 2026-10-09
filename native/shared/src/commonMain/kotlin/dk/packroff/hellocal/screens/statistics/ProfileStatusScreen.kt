package dk.packroff.hellocal.screens.statistics

import dk.packroff.hellocal.ui.Units
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcDivider
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.StatsDropdownSection
import dk.packroff.hellocal.ui.StatsSkeleton
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlin.math.round

// Profil → Status (src/app/profile/status/page.tsx, src/lib/profile-status.ts):
// current weight, goal weight and the history of weight and body measurements.
// No new data types — the same WeightEntry and BodyMeasurement rows as the
// weight log and the body-measurement page.

private class StatusData(
    val startWeightKg: Double?,
    val targetWeightKg: Double?,
    val weights: List<WeightEntry>,
    val measurements: List<BodyEntry>,
    val goals: List<StatusGoal>,
)

/** Weigh-ins as a history, oldest first. */
private fun buildWeightHistory(entries: List<WeightEntry>): List<HistoryPoint> =
    entries.filter { it.weightKg > 0 }.map { HistoryPoint(it.id, it.weighedAtMillis, it.weightKg) }.sortedBy { it.atMillis }

/** One body measurement as a history, oldest first — all of them. */
private fun buildMeasurementHistory(entries: List<BodyEntry>, field: String): List<HistoryPoint> =
    entries.mapNotNull { e -> e.values[field]?.takeIf { it > 0 }?.let { HistoryPoint(null, e.measuredAtMillis, it) } }.sortedBy { it.atMillis }

/** Current weight = latest weigh-in; without any, the profile's start weight. */
private fun currentWeightKg(history: List<HistoryPoint>, startWeightKg: Double?): Double? =
    history.lastOrNull()?.value ?: startWeightKg?.takeIf { it > 0 }

/** Kg left to the goal (positive = lose, negative = gain), one decimal. */
private fun remainingToGoalKg(currentKg: Double?, targetKg: Double?): Double? {
    if (currentKg == null || targetKg == null || targetKg <= 0) return null
    return round((currentKg - targetKg) * 10) / 10
}

/** Per measurement the value from the newest goal that has it. */
private fun latestBodyGoals(goals: List<StatusGoal>): Map<String, Double> {
    val newestFirst = goals.sortedByDescending { it.createdAtMillis }
    val result = mutableMapOf<String, Double>()
    for (def in BODY_MEASUREMENT_FIELDS) {
        for (goal in newestFirst) {
            val value = goal.targets.firstOrNull { it.first == def.field }?.second
            if (value != null && value > 0) {
                result[def.field] = value
                break
            }
        }
    }
    return result
}

/** "3. okt." — with the year only when it isn't this year. */
private fun formatLatestDate(millis: Long): String {
    val date = localDateTimeOf(millis).date
    return if (date.year != todayLocal().year) daShortDateYear(date) else daShortDate(date)
}

/** Rows under the chart before "Vis alle" — the chart always shows all. */
private const val HISTORY_ROWS = 10

/** Native port of src/app/profile/status/page.tsx. */
@Composable
fun ProfileStatusScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val units = remember { Units.current() }
    var data by remember { mutableStateOf<StatusData?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        data = attempt {
            coroutineScope {
                val profile = async { loadProfileUser() }
                val weights = async { loadWeightEntries() }
                val measurements = async { loadBodyEntries() }
                // The body-measurement goals are extra — the page works without them.
                val goals = async { attempt { loadGoals() } ?: emptyList() }
                val user = profile.await()
                StatusData(user.number("weightKg"), user.number("targetWeightKg"), weights.await(), measurements.await(), goals.await())
            }
        }
        loading = false
    }

    val current = data
    if (loading || current == null) {
        HcScreen(t.t("profileStatus.title"), back = nav.showBack) {
            if (loading) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatsSkeleton(Modifier.fillMaxWidth().height(88.dp))
                    repeat(6) { StatsSkeleton(Modifier.fillMaxWidth().height(48.dp)) }
                }
            } else {
                HcText(t.t("profileStatus.loadError"), HcTypeRoles.Body, Modifier.fillMaxWidth().padding(16.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
            }
        }
        return
    }

    val weightHistory = remember(current) { buildWeightHistory(current.weights) }
    val currentKg = currentWeightKg(weightHistory, current.startWeightKg)
    val target = current.targetWeightKg?.takeIf { it > 0 }
    val remaining = remainingToGoalKg(currentKg, target)
    val showWeight: (Double) -> String = { Units.formatWeight(it, units.weight) }
    val showLength: (Double) -> String = { Units.formatLength(it, units.height) }
    val bodyGoals = remember(current) { latestBodyGoals(current.goals) }
    val bodyGoalFields = BODY_MEASUREMENT_FIELDS.filter { bodyGoals[it.field] != null }
    val latestDetail: (List<HistoryPoint>, (Double) -> String) -> String? = { points, format ->
        points.lastOrNull()?.let { t.t("profileStatus.latest", "date" to formatLatestDate(it.atMillis), "value" to format(it.value)) }
    }

    HcScreen(t.t("profileStatus.title"), back = nav.showBack) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatusTile(t.t("profileStatus.currentWeight"), currentKg?.let(showWeight) ?: "—", "/weight/create")
                    if (target != null) StatusTile(t.t("profileStatus.goal"), showWeight(target), "/profile/goals")
                    else SetGoalTile(t.t("profileStatus.setGoal"))
                }
                if (remaining != null) {
                    HcText(
                        when {
                            remaining == 0.0 -> t.t("profileStatus.goalReached")
                            remaining > 0 -> t.t("profileStatus.toLose", "value" to showWeight(kotlin.math.abs(remaining)))
                            else -> t.t("profileStatus.toGain", "value" to showWeight(kotlin.math.abs(remaining)))
                        },
                        HcTypeRoles.Small,
                        Modifier.fillMaxWidth(),
                        color = HcColors.TextSecondary,
                        align = TextAlign.Center,
                    )
                }
            }

            if (bodyGoalFields.isNotEmpty()) {
                HcSectionTitle(t.t("profileStatus.bodyGoals"), Modifier.padding(top = 32.dp, bottom = 16.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    bodyGoalFields.chunked(2).forEach { row ->
                        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { def -> StatusTile(t.t(def.nameKey), showLength(bodyGoals.getValue(def.field)), "/profile/goals") }
                            if (row.size == 1) Box(Modifier.weight(1f))
                        }
                    }
                }
            }

            HcSectionTitle(t.t("profileStatus.history"), Modifier.padding(top = 32.dp, bottom = 16.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                StatsDropdownSection(t.t("profileStatus.weightHistory"), latestDetail(weightHistory, showWeight)) {
                    HistoryPanel(
                        points = weightHistory,
                        format = showWeight,
                        target = target,
                        targetLabel = if (target != null) t.t("profileStatus.goal") else null,
                        emptyText = t.t("profileStatus.noWeights"),
                    )
                }
                BODY_MEASUREMENT_FIELDS.forEach { def ->
                    val points = remember(current, def.field) { buildMeasurementHistory(current.measurements, def.field) }
                    StatsDropdownSection(t.t(def.nameKey), latestDetail(points, showLength)) {
                        HistoryPanel(
                            points = points,
                            format = showLength,
                            target = bodyGoals[def.field],
                            targetLabel = if (bodyGoals[def.field] != null) t.t("profileStatus.measurementGoal") else null,
                            emptyText = t.t("profileStatus.noMeasurements"),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RowScope.StatusTile(label: String, value: String, href: String) {
    val nav = LocalNavigator.current
    Column(
        Modifier
            .weight(1f)
            .fillMaxHeight()
            .clip(RoundedCornerShape(HcDimens.RadiusCard))
            .background(HcColors.Card)
            .clickable { nav.push(href) }
            .padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        HcText(label, HcTypeRoles.Small, color = HcColors.TextSecondary)
        HcText(value, HcTypeRoles.Title, color = HcColors.Black)
    }
}

/** Without a goal weight, "Sæt et mål" stands in the middle of the tile. */
@Composable
private fun RowScope.SetGoalTile(label: String) {
    val nav = LocalNavigator.current
    Box(
        Modifier
            .weight(1f)
            .fillMaxHeight()
            .clip(RoundedCornerShape(HcDimens.RadiusCard))
            .background(HcColors.Card)
            .clickable { nav.push("/profile/goals") }
            .padding(HcDimens.SpaceBlock),
        contentAlignment = Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Body, bold = true, underline = true, color = HcColors.Black, align = TextAlign.Center)
    }
}

/** The chart on top, then the measurements newest first. */
@Composable
private fun HistoryPanel(points: List<HistoryPoint>, format: (Double) -> String, target: Double?, targetLabel: String?, emptyText: String) {
    val t = LocalTranslator.current
    var showAll by remember { mutableStateOf(false) }
    if (points.isEmpty()) {
        HcText(emptyText, HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
        return
    }
    val newestFirst = points.reversed()
    val visible = if (showAll) newestFirst else newestFirst.take(HISTORY_ROWS)
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        HistoryLineChart(points, format, target, targetLabel)
        Column {
            HcDivider()
            visible.forEachIndexed { index, point ->
                if (index > 0) HcDivider()
                Row(
                    Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    HcText(daDateTime(localDateTimeOf(point.atMillis)), HcTypeRoles.Small, Modifier.weight(1f), color = HcColors.TextSecondary)
                    HcText(format(point.value), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                }
            }
        }
        if (newestFirst.size > HISTORY_ROWS) {
            HcText(
                if (showAll) t.t("profileStatus.showLess") else t.t("profileStatus.showAll", "count" to newestFirst.size),
                HcTypeRoles.Small,
                Modifier.fillMaxWidth().clickable { showAll = !showAll },
                bold = true,
                underline = true,
                color = HcColors.Black,
                align = TextAlign.Center,
            )
        }
    }
}
