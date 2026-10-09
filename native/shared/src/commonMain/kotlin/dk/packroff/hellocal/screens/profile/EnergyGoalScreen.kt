package dk.packroff.hellocal.screens.profile

import dk.packroff.hellocal.ui.Units
import dk.packroff.hellocal.ui.WeightUnit
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileChoiceChip
import dk.packroff.hellocal.ui.ProfileFilledField
import dk.packroff.hellocal.ui.ProfilePage
import dk.packroff.hellocal.ui.ProfilePagePadding
import dk.packroff.hellocal.ui.formatNumber
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.plus
import kotlin.math.ceil
import kotlin.math.min

// Kaloriemål (docs/ACTIVITY-PAL.md "Kaloriemål"): goal mode, pace and target
// weight. The health limits live on the server (src/lib/energy-budget.ts) —
// here we only show what they mean. Saves at once (no Save button).

private val GOAL_MODES = listOf("MAINTAIN", "LOSE", "GAIN")
private val LOSS_PACES = listOf(0.25, 0.5, 0.75)
private val GAIN_PACES = listOf(0.1, 0.25)

/** src/components/EnergyGoalEditor.tsx EnergyGoalUser. */
data class EnergyGoalUser(
    val goalMode: String?,
    val goalPaceKgPerWeek: Double?,
    val targetWeightKg: Double?,
    val weightKg: Double?,
    val heightCm: Double?,
) {
    companion object {
        fun from(user: ProfileUser) = EnergyGoalUser(user.goalMode, user.goalPaceKgPerWeek, user.targetWeightKg, user.weightKg, user.heightCm)
    }
}

/** src/lib/energy-budget.ts maxLossPace — the highest healthy pace (kg/week) for this person. */
private fun maxLossPace(weightKg: Double?, heightCm: Double?): Double {
    val bmi = if (weightKg != null && weightKg != 0.0 && heightCm != null && heightCm != 0.0) weightKg / ((heightCm / 100) * (heightCm / 100)) else null
    var cap = if (bmi != null && bmi >= 30) 0.75 else 0.5
    if (bmi != null && bmi < 25) cap = min(cap, 0.25)
    if (weightKg != null && weightKg != 0.0) cap = min(cap, weightKg * 0.01)
    return cap
}

/** The weekly pace in kg or pounds (stones are too coarse for a pace). */
private fun formatPace(kg: Double, unit: WeightUnit): String =
    if (unit == WeightUnit.Kg) "${formatNumber(kg, 2, minDecimals = 0)} kg" else "${formatNumber(Units.kgToLb(kg), 1, minDecimals = 0)} lb"

/** src/components/EnergyGoalEditor.tsx */
@Composable
fun ProfileEnergyGoalEditor(user: EnergyGoalUser, summary: EnergySummary?, onChange: (EnergyGoalUser, EnergySummary?) -> Unit) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val units = remember { Units.current() }
    var targetInput by remember { mutableStateOf(user.targetWeightKg?.let { Units.weightToInputValue(it, units.weight) } ?: "") }
    val mode = user.goalMode ?: "MAINTAIN"
    val paceCap = maxLossPace(user.weightKg, user.heightCm)

    fun save(patch: Map<String, Any?>, next: EnergyGoalUser) {
        onChange(next, summary)
        scope.launch {
            // Network error: the choice stays in the UI and is saved with the next change.
            runCatching {
                ProfileApi.patch(patch)
                ProfileApi.loadEnergySummary()?.let { onChange(next, it) }
            }
        }
    }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HcText(t.t("energyGoal.mode"), HcTypeRoles.Label, color = HcColors.TextSecondary)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GOAL_MODES.forEach { key ->
                    ProfileChoiceChip(t.t("energyGoal.modes.$key"), selected = mode == key, onClick = {
                        val pace = if (key == "MAINTAIN") null else user.goalPaceKgPerWeek
                        save(mapOf("goalMode" to key, "goalPaceKgPerWeek" to pace), user.copy(goalMode = key, goalPaceKgPerWeek = pace))
                    }, modifier = Modifier.weight(1f))
                }
            }
        }

        if (mode != "MAINTAIN") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcText(t.t("energyGoal.pace"), HcTypeRoles.Label, color = HcColors.TextSecondary)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (if (mode == "LOSE") LOSS_PACES else GAIN_PACES).forEach { pace ->
                        val blocked = mode == "LOSE" && pace > paceCap + 1e-9
                        ProfileChoiceChip(
                            t.t("energyGoal.paceValue", "value" to formatPace(pace, units.weight)),
                            selected = (user.goalPaceKgPerWeek ?: 0.0) == pace,
                            enabled = !blocked,
                            onClick = { save(mapOf("goalPaceKgPerWeek" to pace), user.copy(goalPaceKgPerWeek = pace)) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    // The web grid always has three columns.
                    if (mode == "GAIN") androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                }
                HcText(
                    if (mode == "LOSE") t.t("energyGoal.paceHintLose", "value" to formatPace(paceCap, units.weight)) else t.t("energyGoal.paceHintGain"),
                    HcTypeRoles.Small,
                    color = HcColors.TextSecondary,
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                HcText(t.t("energyGoal.targetWeight"), HcTypeRoles.Label, color = HcColors.TextSecondary)
                ProfileFilledField(
                    targetInput,
                    { targetInput = it },
                    Modifier.fillMaxWidth(),
                    placeholder = Units.weightUnitLabel(units.weight),
                    keyboardType = if (units.weight == WeightUnit.St) KeyboardType.Text else KeyboardType.Decimal,
                    onCommit = {
                        val kg = Units.parseWeightInput(targetInput, units.weight)?.let { round1(it) }
                        save(mapOf("targetWeightKg" to kg), user.copy(targetWeightKg = kg))
                    },
                )
                val raised = summary?.budget?.targetWeightKg
                if (raised != null && user.targetWeightKg != null && raised != user.targetWeightKg) {
                    HcText(t.t("energyGoal.targetRaised", "value" to Units.formatWeight(raised, units.weight)), HcTypeRoles.Small, color = HcColors.Warning)
                }
            }

            val weeks = summary?.budget?.weeksToTarget
            if (weeks != null && weeks > 0) {
                val today = ProfileDates.today()
                val early = today.plus(jsRound(weeks * 0.8).toInt() * 7, DateTimeUnit.DAY)
                val late = today.plus(ceil(weeks * 1.25).toInt() * 7, DateTimeUnit.DAY)
                HcText(
                    t.t("energyGoal.eta", "weeks" to jsNumber(weeks), "from" to ProfileDates.dayMonthYear(early), "to" to ProfileDates.dayMonthYear(late)),
                    HcTypeRoles.Body,
                    color = HcColors.Black,
                )
            }
        }

        summary?.let { ProfileEnergyBreakdown(it) }
        HcText(t.t("energyGoal.disclaimer"), HcTypeRoles.Small, color = HcColors.TextSecondary)
    }
}

/** src/components/EnergyGoalPanel.tsx — intro + editor. */
@Composable
fun ProfileEnergyGoalPanel() {
    val t = LocalTranslator.current
    var user by remember { mutableStateOf<EnergyGoalUser?>(null) }
    var summary by remember { mutableStateOf<EnergySummary?>(null) }
    LaunchedEffect(Unit) {
        coroutineScope {
            val profile = async { runCatching { ProfileApi.loadUser() }.getOrNull() }
            val activity = async { runCatching { ProfileApi.loadEnergySummary() }.getOrNull() }
            profile.await()?.let { user = EnergyGoalUser.from(it) }
            activity.await()?.let { summary = it }
        }
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        HcText(t.t("energyGoal.intro"), HcTypeRoles.Body, color = HcColors.TextSecondary)
        val current = user
        if (current != null) {
            ProfileEnergyGoalEditor(current, summary) { nextUser, nextSummary ->
                user = nextUser
                if (nextSummary != null) summary = nextSummary
            }
        } else {
            HcLoader()
        }
    }
}

/** Native port of src/app/profile/energy-goal/page.tsx (mobile page; desktop uses a dropdown on Målsætning). */
@Composable
fun EnergyGoalScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    HcScreen(title = t.t("energyGoal.title"), contentPadding = ProfilePagePadding) {
        ProfilePage { ProfileEnergyGoalPanel() }
    }
}
