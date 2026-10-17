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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.screens.profile.ProfileDates
import dk.packroff.hellocal.ui.ProfileChoiceChip
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject

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
private fun rememberProfileFlag(field: String, default: Boolean = false): Pair<SettingsProfileFlag, (Boolean) -> Unit> {
    val scope = rememberCoroutineScope()
    val flag = remember { SettingsProfileFlag(initialLoading = true) }
    LaunchedEffect(field) {
        flag.value = runCatching { settingsLoadProfile() }.getOrNull()?.let { it.settingsBool(field) ?: default }
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

/**
 * Native port of src/app/settings/display/pregnancy/page.tsx (User.pregnancyStatus,
 * pregnancyWeek, breastfeedingWeeks): the stored week is counted forward to today,
 * and every change applies from today again (pregnancyStatusUpdatedAt on the server).
 */
@Composable
fun PregnancySettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var value by remember { mutableStateOf<PregnancyValue?>(null) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        value = runCatching { settingsLoadProfile() }.getOrNull()?.let { user ->
            val status = user.settingsStr("pregnancyStatus")
            val updatedAt = user.settingsStr("pregnancyStatusUpdatedAt")
            PregnancyValue(
                status = status,
                week = if (status == "PREGNANT") PregnancyRules.currentPregnancyWeek(user.settingsInt("pregnancyWeek"), updatedAt) else null,
                breastfeedingWeeks = if (status == "BREASTFEEDING") PregnancyRules.currentBreastfeedingWeeks(user.settingsInt("breastfeedingWeeks"), updatedAt) else null,
            )
        }
        loading = false
    }
    HcScreen(title = t.t("settings.pregnancy"), contentPadding = SettingsPagePadding) {
        SettingsPage {
            SettingsBrandCard(t.t("pregnancySettings.intro"))
            val current = value
            if (loading || current == null) {
                HcLoader()
            } else {
                PregnancyFields(current, t.t("pregnancySettings.question")) { patch ->
                    value = current.copy(
                        status = if ("pregnancyStatus" in patch) patch["pregnancyStatus"] as String? else current.status,
                        week = if ("pregnancyWeek" in patch) patch["pregnancyWeek"] as Int? else current.week,
                        breastfeedingWeeks = if ("breastfeedingWeeks" in patch) patch["breastfeedingWeeks"] as Int? else current.breastfeedingWeeks,
                    )
                    scope.launch { runCatching { settingsPatchProfile(patch) } }
                }
            }
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
 * Native port of src/app/settings/display/sleep-quality/page.tsx: on/off at the
 * top (User.sleepQualityPromptEnabled), how often to ask (sleepQualityFrequency),
 * "Vis i kalenderen" (sleepQualityShowInCalendar) and today's 1–5 rating.
 * `?focus=toggle` (from "Slå fra" in the sleep question) gives the toggle a thin green ring.
 */
@Composable
fun SleepQualitySettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    val focusToggle = args.opt("focus") == "toggle"
    var loaded by remember { mutableStateOf(false) }
    var enabled by remember { mutableStateOf(true) }
    var frequency by remember { mutableStateOf("DAILY") }
    var showInCalendar by remember { mutableStateOf(true) }
    var todayRating by remember { mutableStateOf<Int?>(null) }
    val today = ProfileDates.todayIso()
    LaunchedEffect(Unit) {
        runCatching { settingsLoadProfile() }.getOrNull()?.let { user ->
            enabled = user.settingsBool("sleepQualityPromptEnabled") ?: true
            frequency = user.settingsStr("sleepQualityFrequency")?.takeIf { it in SleepFrequencies } ?: "DAILY"
            showInCalendar = user.settingsBool("sleepQualityShowInCalendar") != false
            loaded = true
        }
        todayRating = runCatching { Api.get("/api/sleep-quality?from=$today&to=$today") }.getOrNull()
            ?.jsonObject?.get("entries")?.let { it as? JsonArray }?.firstOrNull()?.jsonObject?.get("rating")
            ?.let { it as? JsonPrimitive }?.intOrNull
    }
    fun save(field: String, value: Any) {
        scope.launch { settingsPatchProfile(mapOf(field to value)) }
    }
    HcScreen(title = t.t("settings.sleepQuality"), contentPadding = SettingsDisplayP4) {
        SettingsPage {
            if (!loaded) {
                HcLoader()
            } else {
                val ring = if (focusToggle) Modifier.border(2.dp, HcColors.Green, RoundedCornerShape(12.dp)) else Modifier
                Column(ring) {
                    HcToggle(
                        checked = enabled,
                        onChange = { enabled = it; save("sleepQualityPromptEnabled", it) },
                        label = t.t("sleepQualitySettings.toggleLabel"),
                        description = t.t("sleepQualitySettings.toggleDescription"),
                    )
                }
                Column(Modifier.alpha(if (enabled) 1f else 0.5f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    HcText(t.t("screenings.frequencyTitle"), HcTypeRoles.SectionTitle)
                    SleepFrequencies.forEach { key ->
                        ProfileChoiceChip(
                            t.t("screenings.frequency.$key"),
                            frequency == key,
                            { frequency = key; save("sleepQualityFrequency", key) },
                            Modifier.fillMaxWidth(),
                            enabled = enabled,
                        )
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    HcText(t.t("screenings.calendarTitle"), HcTypeRoles.SectionTitle)
                    HcToggle(
                        checked = showInCalendar,
                        onChange = { showInCalendar = it; save("sleepQualityShowInCalendar", it) },
                        label = t.t("screenings.calendarLabel"),
                        description = t.t("sleepQualitySettings.calendarDesc"),
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    HcText(t.t("sleepQualitySettings.todayTitle"), HcTypeRoles.SectionTitle)
                    HcText(t.t("sleepQuality.question"), HcTypeRoles.Body, color = HcColors.TextSecondary)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        (1..5).forEach { rating ->
                            val selected = todayRating == rating
                            Box(
                                Modifier.size(48.dp).clip(CircleShape)
                                    .background(if (selected) HcColors.Green else HcColors.Tan)
                                    .clickable {
                                        todayRating = rating
                                        scope.launch { runCatching { Api.put("/api/sleep-quality", mapOf("date" to today, "rating" to rating)) } }
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                HcText(rating.toString(), HcTypeRoles.SectionTitle, color = if (selected) HcColors.White else HcColors.Black)
                            }
                        }
                    }
                }
            }
        }
    }
}

private val SleepFrequencies = listOf("DAILY", "WEEKLY", "MONTHLY", "MANUAL")

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

/** Native port of src/app/settings/display/translation/page.tsx (User.translateForeignText, DECISIONS 2026-10-15). */
@Composable
fun TranslationSettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val (flag, save) = rememberProfileFlag("translateForeignText", default = true)
    HcScreen(title = t.t("settings.translation"), contentPadding = SettingsDisplayP4) {
        val value = flag.value
        when {
            flag.loading -> HcLoader()
            value == null -> SettingsLoadErrorText(t.t("settings.loadError"))
            else -> SettingsPage {
                HcToggle(
                    checked = value,
                    onChange = save,
                    label = t.t("displaySettings.translateForeignText"),
                    description = t.t("displaySettings.translateForeignTextDescription"),
                )
            }
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
