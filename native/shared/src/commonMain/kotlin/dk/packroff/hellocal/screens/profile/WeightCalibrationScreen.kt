package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.WeightUnit
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcCard
import dk.packroff.hellocal.ui.HcClampedText
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileEllipsisText
import dk.packroff.hellocal.ui.ProfileFilledField
import dk.packroff.hellocal.ui.ProfileIcon
import dk.packroff.hellocal.ui.ProfileLine
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.ProfileVectorIcon
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.LocalTime

import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant
import kotlin.math.abs

// HelloFresh-tekststil (prøve, kun denne side): 17 / 31 — samme som .hf-fresh-type på web.
private val FreshBody = HcTypeRole(17f, androidx.compose.ui.text.font.FontWeight(400), 31f, false, null)
private val FreshTitle = HcTypeRole(17f, androidx.compose.ui.text.font.FontWeight(700), 31f, true, null)

private val TIME_GRID_HOURS = listOf(8, 10, 12, 14, 16, 18, 20, 22)

/** Each condition is one of a pair of opposites with its own weight field. */
private class Condition(val key: String, val label: String, val icon: @Composable () -> Unit, val fields: Map<String, Any>)

private fun conditionPairs(t: Translator): List<Pair<Condition, Condition>> = listOf(
    Condition("unclothed", t.t("weightCalibration.clothed.false"), { ProfileIcon(ProfileVectorIcon.PersonUnclothed, 24.dp) }, mapOf("clothed" to false)) to
        Condition("clothed", t.t("weightCalibration.clothed.true"), { ProfileIcon(ProfileVectorIcon.PersonClothed, 24.dp) }, mapOf("clothed" to true)),
    Condition("shoesOff", t.t("weightCalibration.shoes.off"), { HcIcon("ShoeOff", size = 24.dp, color = HcColors.Black) }, mapOf("shoes" to "OFF")) to
        Condition("shoesOn", t.t("weightCalibration.shoes.on"), { HcIcon("Shoe", size = 24.dp, color = HcColors.Black) }, mapOf("shoes" to "ON")),
    Condition("morning", t.t("weightCalibration.timeOfDay.morning"), { HcIcon("Sun", size = 24.dp, color = HcColors.Black) }, mapOf("timeOfDay" to "MORNING")) to
        Condition("evening", t.t("weightCalibration.timeOfDay.evening"), { HcIcon("Moon", size = 24.dp, color = HcColors.Black) }, mapOf("timeOfDay" to "EVENING")),
    Condition("toiletBefore", t.t("weightCalibration.toilet.before"), { ProfileIcon(ProfileVectorIcon.ToiletOff, 24.dp) }, mapOf("toilet" to "BEFORE")) to
        Condition("toiletAfter", t.t("weightCalibration.toilet.after"), { ProfileIcon(ProfileVectorIcon.ToiletCheck, 24.dp) }, mapOf("toilet" to "AFTER")),
    Condition("mealBefore", t.t("weightCalibration.meal.before"), { ProfileIcon(ProfileVectorIcon.PlateFull, 24.dp) }, mapOf("meal" to "BEFORE")) to
        Condition("mealAfter", t.t("weightCalibration.meal.after"), { ProfileIcon(ProfileVectorIcon.PlateEmpty, 24.dp) }, mapOf("meal" to "AFTER")),
)

/** Today's whole-hour entries (created by the day list), by hour — editing a slot updates that row. */
private fun todaysSlotEntries(entries: List<WeightEntry>): Map<Int, WeightEntry> {
    val today = ProfileDates.today()
    val map = mutableMapOf<Int, WeightEntry>()
    for (entry in entries) {
        val local = ProfileDates.localDateTime(entry.weighedAt) ?: continue
        if (local.date == today && local.minute == 0 && local.second == 0 && local.hour !in map) map[local.hour] = entry
    }
    return map
}

private fun todayAtHourIso(hour: Int): String =
    LocalDateTime(ProfileDates.today(), LocalTime(hour, 0)).toInstant(TimeZone.currentSystemDefault()).toString()

/** Native port of src/app/profile/weight-calibration/page.tsx. */
@Composable
fun WeightCalibrationScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val weightUnit = remember { Units.current().weight }
    var entries by remember { mutableStateOf<List<WeightEntry>>(emptyList()) }
    val conditionValues = remember { mutableStateMapOf<String, String>() }
    val gridValues = remember { mutableStateMapOf<Int, String>() }
    var saving by remember { mutableStateOf(false) }
    // idle | saved | nothing | error
    var status by remember { mutableStateOf("idle") }
    val pairs = remember(t) { conditionPairs(t) }
    val slotEntries = todaysSlotEntries(entries)
    val inputKeyboard = if (weightUnit == WeightUnit.St) KeyboardType.Text else KeyboardType.Decimal

    suspend fun load() {
        try {
            val loaded = ProfileWeights.entries()
            entries = loaded
            val slots = todaysSlotEntries(loaded)
            gridValues.clear()
            for (hour in TIME_GRID_HOURS) slots[hour]?.let { gridValues[hour] = Units.weightToInputValue(it.weightKg, weightUnit) }
        } catch (e: Exception) {
            entries = emptyList()
        }
    }

    LaunchedEffect(Unit) { load() }

    // Explicit save (user decision 2026-09-25): one weigh-in per filled condition field plus every changed slot.
    fun save() {
        val requests = mutableListOf<suspend () -> Unit>()
        for (condition in pairs.flatMap { listOf(it.first, it.second) }) {
            val weightKg = Units.parseWeightInput(conditionValues[condition.key] ?: "", weightUnit) ?: continue
            val body = mapOf<String, Any>("weightKg" to weightKg) + condition.fields
            requests.add { Api.post("/api/weight-entries", body) }
        }
        for (hour in TIME_GRID_HOURS) {
            val weightKg = Units.parseWeightInput(gridValues[hour] ?: "", weightUnit) ?: continue
            val existing = slotEntries[hour]
            if (existing != null && abs(existing.weightKg - weightKg) < 0.05) continue
            if (existing != null) {
                requests.add { Api.patch("/api/weight-entries/${existing.id}", mapOf("weightKg" to weightKg)) }
            } else {
                val weighedAt = todayAtHourIso(hour)
                requests.add { Api.post("/api/weight-entries", mapOf("weightKg" to weightKg, "weighedAt" to weighedAt)) }
            }
        }
        if (requests.isEmpty()) {
            status = "nothing"
            return
        }
        saving = true
        scope.launch {
            val allOk = coroutineScope {
                requests.map { request -> async { runCatching { request() }.isSuccess } }.awaitAll().all { it }
            }
            if (allOk) {
                conditionValues.clear()
                status = "saved"
                // Hides "Du mangler at kalibrere din vægt" on the weight page.
                launch { runCatching { Api.post("/api/weight-calibration") } }
            } else {
                status = "error"
            }
            NativeHooks.onRegistrationChanged()
            load()
            saving = false
        }
    }

    HcScreen(title = t.t("weightCalibration.title"), contentPadding = ProfilePagePadding) {
        ProfilePage(gap = HcDimens.SpaceSection) {
            HcCard { HcClampedText(t.t("weightCalibration.intro"), FreshBody, color = HcColors.Black) }

            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                pairs.forEach { (left, right) ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        listOf(left, right).forEach { condition ->
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    condition.icon()
                                    ProfileEllipsisText(condition.label, FreshBody, color = HcColors.Black, bold = true)
                                }
                                ProfileFilledField(
                                    conditionValues[condition.key] ?: "",
                                    { conditionValues[condition.key] = it },
                                    Modifier.fillMaxWidth(),
                                    placeholder = if (weightUnit == WeightUnit.St) "11 5" else t.t("weightCalibration.weightPlaceholder"),
                                    keyboardType = inputKeyboard,
                                    suffix = Units.weightUnitLabel(weightUnit),
                                    role = FreshTitle,
                                    background = HcColors.White,
                                    borderColor = HcColors.GrayBorder,
                                    shape = RoundedCornerShape(8.dp),
                                )
                            }
                        }
                    }
                }
            }

            Column(Modifier.fillMaxWidth()) {
                HcText(t.t("weightCalibration.timeGrid.title"), FreshTitle, Modifier.padding(bottom = 8.dp), color = HcColors.Black)
                ProfileLine(HcColors.TanDark)
                TIME_GRID_HOURS.forEach { hour ->
                    Row(Modifier.fillMaxWidth().height(64.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        HcText("${hour.toString().padStart(2, '0')}:00", FreshBody, Modifier.width(48.dp), bold = true, color = HcColors.Black.copy(alpha = 0.6f))
                        Box(Modifier.weight(1f)) {
                            ProfileFilledField(
                                gridValues[hour] ?: "",
                                { gridValues[hour] = it },
                                Modifier.fillMaxWidth(),
                                placeholder = t.t("weightCalibration.timeGrid.placeholder"),
                                keyboardType = inputKeyboard,
                                role = FreshTitle,
                                background = HcColors.Page,
                                minHeight = 40.dp,
                            )
                        }
                        HcText(Units.weightUnitLabel(weightUnit), FreshBody, bold = true, color = HcColors.Black.copy(alpha = 0.6f))
                    }
                    ProfileLine(HcColors.TanDark)
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (status != "idle" && !saving) {
                    HcText(t.t("weightCalibration.status.$status"), FreshBody, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
                }
                HcButton(
                    if (saving) t.t("weightCalibration.saving") else t.t("weightCalibration.submit"),
                    onClick = ::save,
                    enabled = !saving,
                    modifier = Modifier.height(56.dp),
                )
            }
        }
    }
}
