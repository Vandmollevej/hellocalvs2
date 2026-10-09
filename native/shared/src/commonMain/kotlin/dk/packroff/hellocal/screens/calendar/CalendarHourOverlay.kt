package dk.packroff.hellocal.screens.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.app.BackHandler
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.screens.capture.WeightEntryDetailsSheet
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.CalendarPartyPopperIcon
import dk.packroff.hellocal.ui.CalendarWaterGlassIcon
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcButtonKind
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.VSpace
import dk.packroff.hellocal.ui.formatNumber
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDateTime

// HourEntriesOverlay in src/app/calendar/page.tsx: everything in one hour of
// the day view — the målsætning, weigh-ins and one fold-out group per exact
// time (food, water, measurements).

private sealed class HourItem(val id: String, val time: LocalDateTime) {
    class Registration(val registration: CalRegistration) : HourItem(registration.id, registration.at)
    class Water(val entry: CalWater) : HourItem(entry.id, entry.at)
    class Measurement(val measurement: CalendarMeasurement) : HourItem(measurement.id, measurement.time)
}

@Composable
internal fun HourEntriesOverlay(
    hour: Int,
    registrations: List<CalRegistration>,
    waterEntries: List<CalWater>,
    measurements: List<CalendarMeasurement>,
    goals: List<CalGoal>,
    onClose: () -> Unit,
) {
    val t = LocalTranslator.current
    BackHandler(enabled = true, onBack = onClose)
    val groups = remember(registrations, waterEntries, measurements) {
        val sorted = (registrations.map { HourItem.Registration(it) } + waterEntries.map { HourItem.Water(it) } + measurements.map { HourItem.Measurement(it) })
            .sortedBy { it.time }
        val result = mutableListOf<Pair<String, MutableList<HourItem>>>()
        for (item in sorted) {
            val key = "${item.time.hour}:${item.time.minute}"
            val last = result.lastOrNull()
            if (last != null && last.first == key) last.second += item else result += key to mutableListOf<HourItem>(item)
        }
        result
    }
    // Every exact time is a fold-out group, closed by default (the user's explicit correction).
    val openKeys = remember { mutableStateListOf<String>() }

    Column(Modifier.fillMaxSize().zIndex(60f).blockTouchesBelow().background(HcColors.Cream)) {
        Box(Modifier.fillMaxWidth().background(HcColors.Green).statusBarsPadding().height(56.dp).padding(horizontal = 12.dp)) {
            Box(Modifier.align(Alignment.CenterStart).size(44.dp).clickable(onClick = onClose), contentAlignment = Alignment.Center) {
                HcChevron(ChevronDirection.Left, color = HcColors.White)
            }
            HcText(
                t.t("calendar.hourRangeLabel", "start" to pad2(hour), "end" to pad2((hour + 1) % 24)),
                HcTypeRoles.BodyLg,
                Modifier.align(Alignment.Center),
                bold = true,
                color = HcColors.White,
            )
        }
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp)) {
            for (goal in goals) GoalAccordion(goal)
            for ((key, items) in groups) {
                // A weigh-in alone at its time opens the details sheet directly (no fold-out).
                val solo = (items.singleOrNull() as? HourItem.Measurement)?.measurement
                if (solo != null && solo.weightKg != null && solo.id.startsWith("weight-")) {
                    SoloWeightRow(items.first().time, solo)
                    continue
                }
                val isOpen = key in openKeys
                // Food as "540 kcal", water as glass + cl — both can share a time; water products are not food.
                val foodItems = items.filter { it is HourItem.Registration && !isWaterRegistration(it.registration) }
                val groupKcal = foodItems.sumOf { (it as HourItem.Registration).registration.kcal }
                val groupWaterMl = items.sumOf {
                    when (it) {
                        is HourItem.Water -> it.entry.amountMl
                        is HourItem.Registration -> if (isWaterRegistration(it.registration)) waterRegistrationMl(it.registration) else 0.0
                        is HourItem.Measurement -> 0.0
                    }
                }
                val groupWeight = items.firstNotNullOfOrNull { (it as? HourItem.Measurement)?.measurement?.weightKg }
                Column(Modifier.padding(bottom = 8.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan)) {
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight)
                            .clickable { if (isOpen) openKeys.remove(key) else openKeys.add(key) }.padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        HcText(clock(items.first().time), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (foodItems.isNotEmpty()) EnergyChip(EnergyChipKind.Intake, groupKcal, iconSize = 18.dp, role = HcTypeRoles.Body)
                            if (groupWaterMl > 0) EnergyChip(EnergyChipKind.Water, groupWaterMl, iconSize = 18.dp, role = HcTypeRoles.Body)
                            if (groupWeight != null) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    HcIcon("Scale", size = 18.dp, color = HcColors.Black)
                                    HcText(formatWeightKg(groupWeight), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                                }
                            }
                            Box(Modifier.offset(x = (-4).dp)) {
                                HcChevron(if (isOpen) ChevronDirection.Down else ChevronDirection.Right, color = HcColors.Black)
                            }
                        }
                    }
                    if (isOpen) {
                        Column(Modifier.fillMaxWidth().background(HcColors.Cream).padding(horizontal = 16.dp)) {
                            items.forEachIndexed { index, item ->
                                HourItemRow(item)
                                if (index < items.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SoloWeightRow(time: LocalDateTime, measurement: CalendarMeasurement) {
    var open by remember { mutableStateOf(false) }
    Row(
        Modifier.padding(bottom = 8.dp).fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(RoundedCornerShape(16.dp))
            .background(HcColors.Tan).clickable { open = true }.padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HcText(clock(time), HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HcIcon("Scale", size = 18.dp, color = HcColors.Black)
            HcText(formatWeightKg(measurement.weightKg ?: 0.0), HcTypeRoles.Body, bold = true, color = HcColors.Black)
            Box(Modifier.offset(x = (-4).dp)) { HcChevron(ChevronDirection.Right, color = HcColors.Black) }
        }
    }
    if (open) WeightEntryDetailsSheet(measurement.id.removePrefix("weight-"), onClose = { open = false })
}

@Composable
private fun HourItemRow(item: HourItem) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    when (item) {
        is HourItem.Water -> CalendarFoodRow(
            title = t.t("calendar.waterTitle"),
            thumbnail = { CalendarWaterGlassIcon(22.dp, HcColors.Black) },
            right = { EnergyChip(EnergyChipKind.Water, item.entry.amountMl, iconSize = 18.dp, role = HcTypeRoles.Body) },
        )
        is HourItem.Measurement -> MeasurementRow(item.measurement)
        is HourItem.Registration -> {
            val registration = item.registration
            val isWater = isWaterRegistration(registration)
            val glass: (@Composable () -> Unit)? = if (isWater && registration.imageUrl == null) {
                { CalendarWaterGlassIcon(22.dp, HcColors.Black) }
            } else {
                null
            }
            Box(Modifier.fillMaxWidth().clickable { nav.push("/registration/${registration.id}") }) {
                CalendarFoodRow(
                    title = registration.title,
                    image = if (isWater) null else registration.imageUrl,
                    thumbnail = glass,
                    right = {
                        EnergyChip(
                            if (isWater) EnergyChipKind.Water else EnergyChipKind.Intake,
                            if (isWater) waterRegistrationMl(registration) else registration.kcal,
                            iconSize = 18.dp,
                            role = HcTypeRoles.Body,
                        )
                    },
                )
            }
        }
    }
}

/** The målsætning at the top of the 12 o'clock hour: fold-out like the time groups. */
@Composable
private fun GoalAccordion(goal: CalGoal) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    var open by remember { mutableStateOf(false) }
    val weight = goal.targets.firstOrNull { it.type == "weight" }
    Column(Modifier.padding(bottom = 8.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(HcColors.Tan)) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clickable { open = !open }.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CalendarPartyPopperIcon(18.dp, HcColors.Black)
                HcText(t.t("goals.title"), HcTypeRoles.Body, color = HcColors.Black, maxLines = 1)
            }
            if (weight != null) GoalTargetValue(weight)
            Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                HcChevron(if (open) ChevronDirection.Down else ChevronDirection.Right, color = HcColors.Black)
            }
        }
        if (open) {
            Column(Modifier.fillMaxWidth().background(HcColors.Cream).padding(horizontal = 16.dp)) {
                for (target in goal.targets) {
                    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        HcText(t.t(goalTargetNameKey(target.type)), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                        GoalTargetValue(target)
                    }
                    Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
                }
                Row(
                    Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clickable { nav.push("/profile/goals") },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HcText(t.t("calendar.openTargetDate"), HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                    HcIcon("ChevronRight", size = 18.dp, color = HcColors.Black)
                }
            }
        }
    }
}

/**
 * A weigh-in with the scale's other readings (fat %, muscle mass …) or a
 * reading without a weigh-in (e.g. blood pressure). A weigh-in opens its
 * details sheet.
 */
@Composable
private fun MeasurementRow(measurement: CalendarMeasurement) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var open by remember { mutableStateOf(false) }
    val weighInId = if (measurement.id.startsWith("weight-")) measurement.id.removePrefix("weight-") else null
    val source = measurement.source?.takeIf { it != "MANUAL" }?.let { t.t("calendar.measurement.source.$it") }
    val weightKg = measurement.weightKg
    val subtitle: (@Composable () -> Unit)? = if (source != null) {
        { HcText(source, HcTypeRoles.Small, color = HcColors.TextSecondary) }
    } else {
        null
    }
    val right: (@Composable () -> Unit)? = if (weightKg != null) {
        { HcText(formatWeightKg(weightKg), HcTypeRoles.Body, bold = true, color = HcColors.Black) }
    } else {
        null
    }
    Column(Modifier.fillMaxWidth().let { if (weighInId != null) it.clickable { open = true } else it }) {
        CalendarFoodRow(
            title = if (weightKg != null) t.t("calendar.measurement.weight") else t.t("calendar.measurement.title"),
            thumbnail = { HcIcon("Scale", size = 22.dp, color = HcColors.Black) },
            subtitle = subtitle,
            right = right,
        )
        if (measurement.metrics.isNotEmpty()) {
            Column(Modifier.fillMaxWidth().padding(start = 54.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for (metric in measurement.metrics) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        HcText(t.t("calendar.measurement.type.${metric.type}"), HcTypeRoles.Small, Modifier.weight(1f), color = HcColors.TextSecondary)
                        HcText(formatMeasurementValue(metric), HcTypeRoles.Small, bold = true, color = HcColors.Black, align = TextAlign.End)
                    }
                }
            }
        }
    }
    // The shared weigh-in sheet (src/components/weight/WeightEntryDetailsSheet.tsx) — unit-aware.
    if (open && weighInId != null) WeightEntryDetailsSheet(weighInId, onClose = { open = false })
}
