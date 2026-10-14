package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcTextField
import dk.packroff.hellocal.ui.ProfileChoiceChip
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant

// Native port of src/components/PregnancyFields.tsx + src/lib/pregnancy.ts
// (docs/DECISIONS.md 2026-10-14): same fields in the onboarding wizard and
// under Settings → Display → Pregnancy and breastfeeding. Saves at once.

/** src/lib/pregnancy.ts constants (EFSA 2013). */
object PregnancyRules {
    val STATUSES = listOf("PREGNANT", "BREASTFEEDING")
    const val MIN_PREGNANCY_WEEK = 1
    const val MAX_PREGNANCY_WEEK = 42
    const val MAX_BREASTFEEDING_WEEKS = 156
    const val BREASTFEEDING_FULL_WEEKS = 26
    private const val WEEK_MS = 7L * 24 * 60 * 60 * 1000

    fun trimesterForWeek(week: Int): Int = when {
        week <= 13 -> 1
        week <= 27 -> 2
        else -> 3
    }

    fun extraKcal(status: String, trimester: Int?, breastfeedingWeeks: Int?): Int = when (status) {
        "PREGNANT" -> when (trimester ?: 3) { 1 -> 70; 2 -> 260; else -> 500 }
        else -> if ((breastfeedingWeeks ?: 0) < BREASTFEEDING_FULL_WEEKS) 500 else 300
    }

    /** Whole weeks since the value was saved (never negative). */
    fun weeksSince(updatedAtIso: String?): Int {
        val at = updatedAtIso?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return 0
        val diff = Clock.System.now().toEpochMilliseconds() - at.toEpochMilliseconds()
        return maxOf(0L, diff / WEEK_MS).toInt()
    }

    fun currentPregnancyWeek(stored: Int?, updatedAtIso: String?): Int? =
        stored?.let { minOf(MAX_PREGNANCY_WEEK, maxOf(MIN_PREGNANCY_WEEK, it + weeksSince(updatedAtIso))) }

    fun currentBreastfeedingWeeks(stored: Int?, updatedAtIso: String?): Int =
        minOf(MAX_BREASTFEEDING_WEEKS, maxOf(0, stored ?: 0) + weeksSince(updatedAtIso))
}

data class PregnancyValue(val status: String? = null, val week: Int? = null, val breastfeedingWeeks: Int? = null)

private fun parseWeeks(raw: String, min: Int, max: Int): Int? {
    val n = raw.trim().toIntOrNull() ?: return null
    return n.coerceIn(min, max)
}

/**
 * [onChange] gets only the changed fields (null = clear), like the web PATCH body.
 * Keys: pregnancyStatus, pregnancyWeek, breastfeedingWeeks.
 */
@Composable
fun PregnancyFields(value: PregnancyValue, question: String, onChange: (Map<String, Any?>) -> Unit) {
    val t = LocalTranslator.current
    val status = value.status
    val trimester = value.week?.let { PregnancyRules.trimesterForWeek(it) }
    val extraKcal = if (status == null) 0 else PregnancyRules.extraKcal(status, trimester, value.breastfeedingWeeks ?: 0)
    // Text fields keep what the user typed; the parsed value goes to onChange.
    var weekText by remember(status) { mutableStateOf(value.week?.toString() ?: "") }
    var bfText by remember(status) { mutableStateOf(value.breastfeedingWeeks?.toString() ?: "") }

    fun pick(next: String?) {
        if (next == status) return
        onChange(mapOf("pregnancyStatus" to next, "pregnancyWeek" to null, "breastfeedingWeeks" to null))
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        HcText(question, HcTypeRoles.BodyLg, bold = true, color = HcColors.Black)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ProfileChoiceChip(t.t("pregnancy.none"), status == null, { pick(null) }, Modifier.weight(1f))
            PregnancyRules.STATUSES.forEach { option ->
                ProfileChoiceChip(t.t("pregnancy.status.$option"), status == option, { pick(option) }, Modifier.weight(1f))
            }
        }
        if (status == "PREGNANT") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcTextField(
                    value = weekText,
                    onValueChange = {
                        weekText = it
                        onChange(mapOf("pregnancyWeek" to parseWeeks(it, PregnancyRules.MIN_PREGNANCY_WEEK, PregnancyRules.MAX_PREGNANCY_WEEK)))
                    },
                    label = t.t("pregnancy.weekLabel"),
                    placeholder = t.t("pregnancy.weekPlaceholder"),
                    keyboardType = KeyboardType.Number,
                    standard = true,
                )
                if (trimester != null) {
                    HcText("${t.t("pregnancy.trimester", "trimester" to trimester)} · ${t.t("pregnancy.extraKcal", "kcal" to extraKcal)}", HcTypeRoles.Small, color = HcColors.Black)
                }
                HcText(t.t("pregnancy.weekHint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
        }
        if (status == "BREASTFEEDING") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcTextField(
                    value = bfText,
                    onValueChange = {
                        bfText = it
                        onChange(mapOf("breastfeedingWeeks" to parseWeeks(it, 0, PregnancyRules.MAX_BREASTFEEDING_WEEKS)))
                    },
                    label = t.t("pregnancy.breastfeedingWeeksLabel"),
                    placeholder = t.t("pregnancy.breastfeedingWeeksPlaceholder"),
                    keyboardType = KeyboardType.Number,
                    standard = true,
                )
                HcText(t.t("pregnancy.extraKcal", "kcal" to extraKcal), HcTypeRoles.Small, color = HcColors.Black)
                HcText(t.t("pregnancy.breastfeedingHint"), HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
        }
        if (status != null) HcText(t.t("pregnancy.noDeficit"), HcTypeRoles.Small, color = HcColors.TextSecondary)
    }
}
