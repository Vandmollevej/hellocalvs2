package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileTextButton
import dk.packroff.hellocal.ui.formatNumber
import kotlin.math.abs

// src/components/EnergyBreakdown.tsx — "rest + everyday + exercise = need −
// goal = budget" (docs/ACTIVITY-PAL.md). Each line can unfold a "Hvorfor?",
// and every number is "ca." with a range.

private fun formatKcal(value: Double) = formatNumber(jsRound(value / 10) * 10, 0)

private fun formatPal(value: Double) = formatNumber(value, 2)

@Composable
private fun EnergyLine(label: String, value: String, sign: String? = null, why: String? = null, strong: Boolean = false) {
    val t = LocalTranslator.current
    var open by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HcText(sign ?: "", HcTypeRoles.Body, Modifier.width(16.dp), color = HcColors.TextSecondary, bold = strong)
            HcText(label, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black, bold = strong)
            HcText(value, HcTypeRoles.Body, color = HcColors.Black, bold = strong)
        }
        if (why != null) {
            Column(Modifier.padding(start = 24.dp)) {
                ProfileTextButton(t.t("energy.why"), onClick = { open = !open }, color = HcColors.TextSecondary)
                if (open) HcText(why, HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
        }
    }
}

@Composable
fun ProfileEnergyBreakdown(summary: EnergySummary) {
    val t = LocalTranslator.current
    val shape = RoundedCornerShape(12.dp)
    val daily = summary.daily
    val bmr = summary.bmr
    val pal = summary.pal
    if (daily == null || bmr == null || pal == null) {
        Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            HcText(t.t("energy.missingData"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            Column {
                summary.missing.forEach { field -> HcText("· ${t.t("energy.missing.$field")}", HcTypeRoles.Small, color = HcColors.TextSecondary) }
            }
        }
        return
    }
    val budget = summary.budget
    val calibration = summary.calibration
    val everydayKcal = daily.baselineKcal - bmr
    val goalDelta = budget?.deltaKcal ?: 0.0
    val needKcal = summary.needKcal
    val calibratedDelta = if (needKcal != null && calibration != null && calibration.reason == "OK" && calibration.weight > 0) needKcal - daily.kcal else 0.0
    val finalNeed = needKcal ?: daily.kcal
    val approx = t.t("energy.approx")

    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        EnergyLine(t.t("energy.rest"), "$approx ${formatKcal(bmr)}", why = t.t("energy.whyRest"))
        EnergyLine(
            t.t("energy.everyday"),
            formatKcal(everydayKcal),
            sign = "+",
            why = t.t("energy.whyEveryday", "pal" to formatPal(pal), "level" to (summary.level?.let { t.t("profile.activityLevel.$it.label") } ?: "")),
        )
        if (summary.trainingAllowanceKcal > 0) {
            EnergyLine(t.t("energy.training"), formatKcal(summary.trainingAllowanceKcal), sign = "+", why = t.t("energy.whyTraining"))
        }
        if (calibratedDelta != 0.0 && calibration != null) {
            EnergyLine(
                t.t("energy.calibrated"),
                formatKcal(abs(calibratedDelta)),
                sign = if (calibratedDelta < 0) "−" else "+",
                why = t.t(
                    "energy.whyCalibrated",
                    "days" to calibration.loggedDays,
                    "intake" to formatKcal(calibration.averageIntakeKcal ?: 0.0),
                    "slope" to formatNumber(calibration.slopeKgPerWeek ?: 0.0, 2, minDecimals = 0),
                    "learned" to formatKcal(calibration.learnedKcal ?: 0.0),
                    "weight" to jsRound(calibration.weight * 100).toLong(),
                ),
            )
        }
        EnergyLine(t.t("energy.need"), "$approx ${formatKcal(finalNeed)}", sign = "=", strong = true)
        HcText(
            t.t("energy.range", "low" to formatKcal(daily.low + calibratedDelta), "high" to formatKcal(daily.high + calibratedDelta)),
            HcTypeRoles.Small,
            color = HcColors.TextSecondary,
        )
        if (calibration != null && calibratedDelta == 0.0) {
            HcText(t.t("energy.calibrationStatus.${calibration.reason}"), HcTypeRoles.Small, color = HcColors.TextSecondary)
        }
        if (budget != null && goalDelta != 0.0) {
            EnergyLine(t.t("energy.goal"), formatKcal(abs(goalDelta)), sign = if (goalDelta < 0) "−" else "+", why = t.t("energy.whyGoal"))
            EnergyLine(t.t("energy.budget"), "$approx ${formatKcal(budget.budgetKcal)}", sign = "=", strong = true)
        }
        if (budget != null && budget.adjustments.isNotEmpty()) {
            val inner = RoundedCornerShape(8.dp)
            Column(Modifier.fillMaxWidth().clip(inner).background(HcColors.WarningBg, inner).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                budget.adjustments.forEach { code -> HcText(t.t("energy.adjustment.$code"), HcTypeRoles.Small, color = HcColors.Warning) }
            }
        }
        HcText(t.t("energy.disclaimer"), HcTypeRoles.Small, color = HcColors.TextSecondary)
    }
}
