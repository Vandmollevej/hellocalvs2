package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcLoader
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.HcToggle
import dk.packroff.hellocal.ui.SettingsOption
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.SettingsProgressStepper
import dk.packroff.hellocal.ui.SettingsSelectCard
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

/** "p-4 + gap-4" pages (flex flex-col gap-4 p-4). */
private val SettingsP4 = PaddingValues(16.dp)

/** Native port of src/app/profile/settings/page.tsx ("Opsætning" — setup progress). */
@Composable
fun ProfileSetupScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    var weightSet by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        runCatching { settingsLoadProfile() }.getOrNull()?.let { user ->
            weightSet = (user.settingsNum("weightKg") ?: 0.0) != 0.0
        }
        loading = false
    }

    HcScreen(title = t.t("settings.setupTitle"), contentPadding = SettingsP4) {
        if (!loading) {
            // Same "Step X of Y" pattern as the onboarding (design.md §12).
            val steps = listOf(
                t.t("settings.setupProgressStepRegion"),
                t.t("settings.setupProgressStepAllergens"),
                t.t("settings.setupProgressStepWeight"),
            )
            val doneCount = if (weightSet) steps.size else steps.size - 1
            Column(Modifier.padding(start = 4.dp, end = 4.dp, bottom = 4.dp)) {
                SettingsProgressStepper(steps, current = minOf(doneCount, steps.size - 1), progress = if (weightSet) 1f else 0f)
                if (!weightSet) {
                    HcText(t.t("settings.setupProgressHint"), HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
                }
            }
        }
    }
}

/** src/lib/regions.ts REGIONS (code + Danish label; labels are not translated on the web either). */
internal val SETTINGS_REGIONS = listOf(
    "DK" to "Danmark", "SE" to "Sverige", "NO" to "Norge", "DE" to "Tyskland", "AT" to "Østrig",
    "CH" to "Schweiz", "NL" to "Holland", "BE" to "Belgien", "FR" to "Frankrig", "IT" to "Italien",
    "ES" to "Spanien", "GB" to "Storbritannien", "IE" to "Irland", "US" to "USA", "CA" to "Canada",
    "AU" to "Australien", "NZ" to "New Zealand",
)

/** Native port of src/app/profile/settings/language-region/page.tsx. */
@Composable
fun LanguageRegionScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var region by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    // Recompose when a unit preference is saved.
    @Suppress("UNUSED_VARIABLE") val prefsVersion = SettingsLocalPrefs.version
    val (weightUnit, heightUnit) = SettingsLocalPrefs.units()

    LaunchedEffect(Unit) {
        runCatching { settingsLoadProfile() }.getOrNull()?.let { user ->
            region = user.settingsStr("region")
            SettingsLocalPrefs.setUnitsRegion(user.settingsStr("region"))
        }
        loading = false
    }

    fun updateRegion(next: String) {
        region = next
        SettingsLocalPrefs.setUnitsRegion(next)
        scope.launch { settingsPatchProfile(mapOf("region" to next)) }
    }

    // LocaleProvider.setLocale: saved on the profile (appLocale) so it follows the
    // user; Session.refresh() makes the app switch dictionary at once.
    fun updateLocale(code: String) {
        val next = Locale.entries.firstOrNull { it.code == code } ?: Locale.Default
        scope.launch {
            settingsPatchProfile(mapOf("appLocale" to next.code))
            Session.refresh()
        }
    }

    fun unitLabel(unit: String) = t.t("settings.unit${unit.substring(0, 1).uppercase()}${unit.substring(1, 2)}")

    HcScreen(title = t.t("settings.languageAndRegion"), contentPadding = SettingsP4) {
        val currentRegion = region
        when {
            loading -> HcLoader()
            currentRegion == null -> HcText(
                t.t("settings.loadError"),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().padding(8.dp),
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
            else -> SettingsPage(gap = HcDimens.SpaceBlock) {
                SettingsSelectCard(
                    label = t.t("settings.regionLabel"),
                    description = t.t("settings.regionDescription"),
                    value = currentRegion,
                    options = SETTINGS_REGIONS.map { SettingsOption(it.first, it.second) },
                    onChange = ::updateRegion,
                )
                // Language names are shown in their own language, so they are not translated.
                SettingsSelectCard(
                    label = t.t("settings.languageLabel"),
                    description = t.t("settings.languageDescription"),
                    value = t.locale.code,
                    options = Locale.entries.map { SettingsOption(it.code, it.displayName) },
                    onChange = ::updateLocale,
                )
                SettingsSelectCard(
                    label = t.t("settings.unitsWeightLabel"),
                    description = t.t("settings.unitsWeightDescription"),
                    value = weightUnit,
                    options = SettingsLocalPrefs.WEIGHT_UNITS.map { SettingsOption(it, unitLabel(it)) },
                    onChange = { SettingsLocalPrefs.saveUnits(weight = it) },
                )
                SettingsSelectCard(
                    label = t.t("settings.unitsHeightLabel"),
                    description = t.t("settings.unitsHeightDescription"),
                    value = heightUnit,
                    options = SettingsLocalPrefs.HEIGHT_UNITS.map { SettingsOption(it, unitLabel(it)) },
                    onChange = { SettingsLocalPrefs.saveUnits(height = it) },
                )
            }
        }
    }
}

/** src/lib/allergens.ts ALLERGEN_CATALOG (key + Danish label, as on the web). */
internal val SETTINGS_ALLERGENS = listOf(
    "gluten" to "Gluten", "crustaceans" to "Skaldyr", "eggs" to "Æg", "fish" to "Fisk",
    "peanuts" to "Jordnødder", "soybeans" to "Soja", "milk" to "Mælk", "nuts" to "Nødder",
    "celery" to "Selleri", "mustard" to "Sennep", "sesame-seeds" to "Sesamfrø",
    "sulphur-dioxide-and-sulphites" to "Svovldioxid og sulfitter", "lupin" to "Lupin", "molluscs" to "Bløddyr",
)

private data class SettingsResultsUser(
    val showAllergens: Boolean,
    val allergenVisibility: Map<String, Boolean>?,
    val showExtendedNutrition: Boolean,
    val showAdditives: Boolean,
    val showToxins: Boolean,
)

/** Native port of src/app/profile/settings/results/page.tsx ("Resultatvisning"). */
@Composable
fun ResultsDisplayScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val scope = rememberCoroutineScope()
    var user by remember { mutableStateOf<SettingsResultsUser?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        user = runCatching { settingsLoadProfile() }.getOrNull()?.let { u ->
            SettingsResultsUser(
                showAllergens = u.settingsBool("showAllergens") ?: false,
                allergenVisibility = u.settingsObj("allergenVisibility")?.let { obj: JsonObject ->
                    obj.mapNotNull { (k, v) -> (v as? JsonPrimitive)?.booleanOrNull?.let { k to it } }.toMap()
                },
                showExtendedNutrition = u.settingsBool("showExtendedNutrition") ?: false,
                showAdditives = u.settingsBool("showAdditives") ?: false,
                showToxins = u.settingsBool("showToxins") ?: false,
            )
        }
        loading = false
    }

    fun patch(body: Map<String, Any?>) {
        scope.launch { settingsPatchProfile(body) }
    }

    HcScreen(title = t.t("settings.resultsDisplay"), contentPadding = SettingsPagePadding) {
        val current = user
        when {
            loading -> HcLoader()
            current == null -> HcText(
                t.t("settings.loadError"),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().padding(8.dp),
                color = HcColors.TextSecondary,
                align = TextAlign.Center,
            )
            else -> SettingsPage(gap = HcDimens.SpaceBlock) {
                val shape = RoundedCornerShape(16.dp)
                Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Column(Modifier.weight(1f)) {
                            HcText(t.t("settings.showAllergens"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                            HorizontalDivider(Modifier.padding(top = 8.dp), thickness = 1.dp, color = HcColors.TanDark)
                            HcText(t.t("settings.showAllergensDescription"), HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
                        }
                        Row(Modifier.padding(top = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            HcText(t.t("settings.showAllergensSelectAll"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                            HcToggle(current.showAllergens, { value ->
                                user = current.copy(showAllergens = value)
                                patch(mapOf("showAllergens" to value))
                            })
                        }
                    }
                    if (current.showAllergens) {
                        HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
                        SETTINGS_ALLERGENS.forEachIndexed { index, (key, label) ->
                            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                HcText(label, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                                HcToggle(current.allergenVisibility?.get(key) != false, { value ->
                                    val next = (current.allergenVisibility ?: emptyMap()) + (key to value)
                                    user = current.copy(allergenVisibility = next)
                                    patch(mapOf("allergenVisibility" to next))
                                })
                            }
                            if (index < SETTINGS_ALLERGENS.lastIndex) HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
                        }
                    }
                }

                HcToggle(
                    checked = current.showExtendedNutrition,
                    onChange = { value ->
                        user = current.copy(showExtendedNutrition = value)
                        patch(mapOf("showExtendedNutrition" to value))
                    },
                    label = t.t("settings.showExtendedNutrition"),
                    description = t.t("settings.showExtendedNutritionDescription"),
                )
                HcToggle(
                    checked = current.showAdditives,
                    onChange = { value ->
                        user = current.copy(showAdditives = value)
                        patch(mapOf("showAdditives" to value))
                    },
                    label = t.t("settings.showAdditives"),
                    description = t.t("settings.showAdditivesDescription"),
                )
                HcToggle(
                    checked = current.showToxins,
                    onChange = { value ->
                        user = current.copy(showToxins = value)
                        patch(mapOf("showToxins" to value))
                    },
                    label = t.t("settings.showToxins"),
                    description = t.t("settings.showToxinsDescription"),
                )
                HcText(t.t("settings.thirdPartyDisclaimer"), HcTypeRoles.Small, Modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary)
            }
        }
    }
}
