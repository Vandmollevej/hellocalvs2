package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.SettingsInlineSelect
import dk.packroff.hellocal.ui.SettingsOption
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.SettingsUncertaintyTilde
import dk.packroff.hellocal.ui.formatNumber
import kotlinx.coroutines.launch

private val SettingsDisplayP4 = PaddingValues(16.dp)

/** .hf-card.hf-card--brand — green card with white small text. */
@Composable
internal fun SettingsBrandCard(text: String) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Brand, shape).padding(HcDimens.SpaceBlock)) {
        HcText(text, HcTypeRoles.Small, color = HcColors.White)
    }
}

@Composable
private fun SettingsLoadErrorText(text: String) {
    HcText(text, HcTypeRoles.Body, Modifier.fillMaxWidth().padding(8.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
}

/**
 * Loads one boolean field of /api/profile and saves it on change (PATCH).
 * `null` while loading or after an error.
 */
private class SettingsProfileFlag(initialLoading: Boolean) {
    var value by mutableStateOf<Boolean?>(null)
    var loading by mutableStateOf(initialLoading)
}

@Composable
private fun rememberProfileFlag(field: String): Pair<SettingsProfileFlag, (Boolean) -> Unit> {
    val scope = rememberCoroutineScope()
    val flag = remember { SettingsProfileFlag(initialLoading = true) }
    LaunchedEffect(field) {
        flag.value = runCatching { settingsLoadProfile() }.getOrNull()?.let { it.settingsBool(field) ?: false }
        flag.loading = false
    }
    val save: (Boolean) -> Unit = { next ->
        flag.value = next
        scope.launch { settingsPatchProfile(mapOf(field to next)) }
    }
    return flag to save
}

/** Native port of src/app/settings/display/page.tsx ("Visning" overview). */
@Composable
fun DisplaySettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    var isFemale by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        runCatching { settingsLoadProfile() }.getOrNull()?.let { isFemale = it.settingsStr("sex") == "FEMALE" }
    }
    HcScreen(title = t.t("settings.display"), contentPadding = SettingsPagePadding) {
        SettingsPage {
            SettingsDisplayRows(isFemale, includeResults = false)
        }
    }
}

/** Native port of src/app/settings/display/calendar-view/page.tsx. */
@Composable
fun CalendarViewSettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    @Suppress("UNUSED_VARIABLE") val prefsVersion = SettingsLocalPrefs.version
    val selected = SettingsLocalPrefs.calendarView()
    val options = listOf(
        SettingsOption("list", t.t("calendarViewSettings.optionList")),
        SettingsOption("month", t.t("calendarViewSettings.optionMonth")),
        SettingsOption("week", t.t("calendarViewSettings.optionWeek")),
        SettingsOption("day", t.t("calendarViewSettings.optionDay")),
    )
    HcScreen(title = t.t("calendarViewSettings.title"), contentPadding = SettingsPagePadding) {
        SettingsPage {
            HcText(t.t("calendarViewSettings.intro"), HcTypeRoles.Small, Modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary)
            // Én af flere værdier kan ikke være til/fra — derfor en dropdown.
            val shape = RoundedCornerShape(16.dp)
            Row(
                Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).heightIn(min = HcDimens.ControlHeight).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                HcText(t.t("calendarViewSettings.title"), HcTypeRoles.Body, Modifier.weight(1f))
                SettingsInlineSelect(selected, options, { SettingsLocalPrefs.saveCalendarView(it) })
            }
        }
    }
}

/** Native port of src/app/settings/display/limits/page.tsx (User.warnOnRecommendedLimits). */
@Composable
fun RecommendedLimitsSettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val (flag, save) = rememberProfileFlag("warnOnRecommendedLimits")
    HcScreen(title = t.t("settings.recommendedLimits"), contentPadding = SettingsPagePadding) {
        val value = flag.value
        when {
            flag.loading -> HcLoader()
            value == null -> SettingsLoadErrorText(t.t("settings.loadError"))
            else -> SettingsPage {
                HcToggle(
                    checked = value,
                    onChange = save,
                    label = t.t("displaySettings.warnOnRecommendedLimits"),
                    description = t.t("displaySettings.warnOnRecommendedLimitsDescription"),
                )
            }
        }
    }
}

/** Native port of src/app/settings/display/menstrual-cycle/page.tsx (User.cycleTrackingEnabled). */
@Composable
fun MenstrualCycleSettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val (flag, save) = rememberProfileFlag("cycleTrackingEnabled")
    HcScreen(title = t.t("settings.menstrualCycle"), contentPadding = SettingsPagePadding) {
        SettingsPage {
            SettingsBrandCard(t.t("menstrualCycleSettings.intro"))
            val value = flag.value
            // Like the web, the placeholder stays when the profile can't be loaded.
            if (value == null) {
                HcLoader()
            } else {
                HcToggle(
                    checked = value,
                    onChange = save,
                    label = t.t("menstrualCycleSettings.toggleLabel"),
                    description = t.t("menstrualCycleSettings.toggleDescription"),
                )
            }
        }
    }
}

/**
 * Native port of src/app/settings/display/sleep-quality/page.tsx
 * (User.sleepQualityPromptEnabled). `?focus=toggle` (from "Slå fra" in the sleep
 * question) gives the toggle a thin green ring.
 */
@Composable
fun SleepQualitySettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val (flag, save) = rememberProfileFlag("sleepQualityPromptEnabled")
    val focusToggle = args.opt("focus") == "toggle"
    HcScreen(title = t.t("settings.sleepQuality"), contentPadding = SettingsDisplayP4) {
        SettingsPage {
            val value = flag.value
            if (value == null) {
                HcLoader()
            } else {
                val ring = if (focusToggle) Modifier.border(2.dp, HcColors.Green, RoundedCornerShape(12.dp)) else Modifier
                Column(ring) {
                    HcToggle(
                        checked = value,
                        onChange = save,
                        label = t.t("sleepQualitySettings.toggleLabel"),
                        description = t.t("sleepQualitySettings.toggleDescription"),
                    )
                }
            }
        }
    }
}

/** src/components/hf/HelpTip.tsx — small help text, only while "Vis tooltips" is on. */
@Composable
internal fun SettingsHelpTip(text: String, modifier: Modifier = Modifier) {
    @Suppress("UNUSED_VARIABLE") val prefsVersion = SettingsLocalPrefs.version
    if (!SettingsLocalPrefs.showTooltips()) return
    HcText(text, HcTypeRoles.Small, modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary)
}

/** Native port of src/app/settings/display/tips/page.tsx (per-device help preferences). */
@Composable
fun TipsSettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    @Suppress("UNUSED_VARIABLE") val prefsVersion = SettingsLocalPrefs.version
    HcScreen(title = t.t("settings.tipsTitle"), contentPadding = SettingsDisplayP4) {
        SettingsPage {
            SettingsHelpTip(t.t("settings.displayHelpTip"))
            HcToggle(
                checked = SettingsLocalPrefs.showTooltips(),
                onChange = { SettingsLocalPrefs.saveShowTooltips(it) },
                label = t.t("settings.showTooltips"),
                description = t.t("settings.showTooltipsDescription"),
            )
            HcToggle(
                checked = SettingsLocalPrefs.showStartupTips(),
                onChange = { SettingsLocalPrefs.saveShowStartupTips(it) },
                label = t.t("settings.showStartupTips"),
                description = t.t("settings.showStartupTipsDescription"),
            )
            HcToggle(
                checked = SettingsLocalPrefs.showGoalTips(),
                onChange = { SettingsLocalPrefs.saveShowGoalTips(it) },
                label = "Tips til at nå dine mål",
                description = "Foreslår fx en gåtur eller flere gulerødder, hvis du plejer at spise mere end dagens mål.",
            )
        }
    }
}

/** Native port of src/app/settings/display/uncertainty/page.tsx (User.autoExpandUncertainty). */
@Composable
fun UncertaintySettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val (flag, save) = rememberProfileFlag("autoExpandUncertainty")
    HcScreen(title = t.t("displaySettings.uncertainty"), contentPadding = SettingsDisplayP4) {
        val value = flag.value
        when {
            flag.loading -> HcLoader()
            value == null -> SettingsLoadErrorText(t.t("settings.loadError"))
            else -> SettingsPage {
                HcToggle(
                    checked = value,
                    onChange = save,
                    label = t.t("displaySettings.autoExpandUncertainty"),
                    description = t.t("displaySettings.autoExpandUncertaintyDescription"),
                )
                // Lille eksempel, så brugeren kan se hvad kontakten styrer.
                SettingsUncertaintyExample(expanded = value)
            }
        }
    }
}

@Composable
private fun ColumnScope.SettingsUncertaintyExample(expanded: Boolean) {
    val t = LocalTranslator.current
    val shape = RoundedCornerShape(16.dp)
    val value = formatNumber(2.1, 1, t.locale)
    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(horizontal = 16.dp, vertical = 12.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            HcText(t.t("addProduct.nutrient.iron"), HcTypeRoles.Small, Modifier.weight(1f).alpha(0.7f), color = HcColors.Black)
            Row(verticalAlignment = Alignment.CenterVertically) {
                SettingsUncertaintyTilde(HcTypeRoles.Small)
                HcText("$value mg", HcTypeRoles.Small, bold = true, color = HcColors.Black)
            }
        }
        // UncertaintyLine: grey line with the estimated part ("~ 2,1 mg").
        if (expanded) {
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                SettingsUncertaintyTilde(HcTypeRoles.Small, small = true)
                HcText(" $value mg", HcTypeRoles.Small, color = HcColors.Black.copy(alpha = 0.6f))
            }
        }
    }
}
