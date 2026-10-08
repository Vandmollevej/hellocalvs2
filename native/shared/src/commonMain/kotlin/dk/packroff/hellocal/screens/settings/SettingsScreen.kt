package dk.packroff.hellocal.screens.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.api.Session
import dk.packroff.hellocal.i18n.Locale
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.SettingsAccordionCard
import dk.packroff.hellocal.ui.SettingsChevronRow
import dk.packroff.hellocal.ui.SettingsGroupLabel
import dk.packroff.hellocal.ui.SettingsPage
import dk.packroff.hellocal.ui.SettingsPagePadding
import dk.packroff.hellocal.ui.SettingsPaymentCardIcon
import dk.packroff.hellocal.ui.SettingsSearchField
import kotlinx.coroutines.launch

/** helpPagePath() in src/i18n/index.ts — static help page in public/. */
internal fun settingsHelpPagePath(locale: Locale): String = if (locale == Locale.Da) "/hjaelp.html" else "/help-${locale.code}.html"

/** resetOnboardingProgress() in src/app/settings/page.tsx. */
internal suspend fun settingsResetOnboardingProgress() {
    settingsPatchProfile(
        mapOf(
            "onboardingStep" to 0,
            "onboardingCompletedAt" to null,
            "onboardingRemindLaterAt" to null,
            "onboardingDismissed" to false,
        ),
    )
}

/** The green "~" used as the row icon for Usikkerhed. */
@Composable
internal fun SettingsTildeRowIcon() {
    HcText(
        "~",
        HcTypeRole(HcTypeRoles.PageTitle.size, FontWeight.Bold, HcTypeRoles.PageTitle.size, true, HcColors.Green),
        Modifier.wrapContentHeight(),
        align = TextAlign.Center,
    )
}

private class SettingsSearchItem(val icon: String?, val label: String, val onClick: () -> Unit, val customIcon: (@Composable () -> Unit)? = null)

/** Native port of src/app/settings/page.tsx. */
@Composable
fun SettingsScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    var isFemale by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    val family = rememberFamilyStatus()

    // Kontrol-loggen vises for den, der er med i en andens familie (docs/FAMILY.md).
    val familyInfo = family?.family
    val myId = family?.me?.id
    val isControlled = familyInfo != null && !familyInfo.isOwner
    // Familie kun med familieabonnement eller medlemskab (docs/DECISIONS.md 2026-10-02).
    val showFamily = family?.hasFamilyPlan == true || familyInfo != null
    // Sletteret vises for den, der har oprettet (eller styrer) andre profiler.
    val controlsOthers = myId != null && familyInfo?.members?.any { it.controllerId == myId && it.userId != myId } == true

    // "Lær appen at kende": nulstil fremdriften og vis guiden.
    // TODO(parity): the web opens OnboardingWizard as a sheet on this page; the
    // native wizard is not ported yet, so the front page (which shows the
    // wizard while onboarding is unfinished) is opened instead.
    fun startOnboarding() {
        scope.launch {
            settingsResetOnboardingProgress()
            nav.resetTo("/")
        }
    }

    // Hjælpecenterets "Start guiden" linker til /settings?guide=1.
    LaunchedEffect(Unit) {
        if (args.opt("guide") == "1") {
            nav.replace("/settings")
            startOnboarding()
        }
    }

    LaunchedEffect(Unit) {
        runCatching { settingsLoadProfile() }.getOrNull()?.let { isFemale = it.settingsStr("sex") == "FEMALE" }
    }

    fun openHelp() = NativeHooks.openExternalUrl(HelloCalConfig.BASE_URL + settingsHelpPagePath(t.locale))

    val paymentIcon: @Composable () -> Unit = { SettingsPaymentCardIcon(20.dp) }
    val searchItems = buildList {
        add(SettingsSearchItem("World", t.t("settings.languageAndRegion"), { nav.push("/profile/settings/language-region") }))
        if (showFamily) add(SettingsSearchItem("Users", t.t("family.title"), { nav.push("/profile/family") }))
        add(SettingsSearchItem("CreditCard", t.t("profile.row.subscription"), { nav.push("/profile/subscription") }))
        add(SettingsSearchItem(null, t.t("settings.payment"), { nav.push("/settings/payment") }, paymentIcon))
        add(SettingsSearchItem("Adjustments", t.t("settings.setupTitle"), { nav.push("/profile/settings") }))
        add(SettingsSearchItem("Refresh", t.t("settings.learnTheApp"), { startOnboarding() }))
        add(SettingsSearchItem("PlugConnected", t.t("settings.integrations"), { nav.push("/settings/integrations") }))
        add(SettingsSearchItem("Bell", t.t("settings.notifications"), { nav.push("/profile/notifications") }))
        add(SettingsSearchItem("Home2", t.t("settings.frontPage"), { nav.push("/settings/display/front-page") }))
        add(SettingsSearchItem("Eye", t.t("settings.resultsDisplay"), { nav.push("/profile/settings/results") }))
        add(SettingsSearchItem("AlertTriangle", t.t("settings.recommendedLimits"), { nav.push("/settings/display/limits") }))
        add(SettingsSearchItem("Adjustments", t.t("displaySettings.uncertainty"), { nav.push("/settings/display/uncertainty") }))
        add(SettingsSearchItem("CalendarWeek", t.t("settings.calendarView"), { nav.push("/settings/display/calendar-view") }))
        add(SettingsSearchItem("Moon", t.t("settings.sleepQuality"), { nav.push("/settings/display/sleep-quality") }))
        add(SettingsSearchItem("Bulb", t.t("settings.tipsTitle"), { nav.push("/settings/display/tips") }))
        if (isFemale) add(SettingsSearchItem("CalendarHeart", t.t("settings.menstrualCycle"), { nav.push("/settings/display/menstrual-cycle") }))
        add(SettingsSearchItem("Help", t.t("settings.helpCenter"), { openHelp() }))
        add(SettingsSearchItem("Bug", t.t("profile.row.reportBug"), { nav.push("/profile/report-bug") }))
        add(SettingsSearchItem("Lifebuoy", t.t("settings.contactSupport"), { nav.push("/settings/support") }))
        add(SettingsSearchItem("FileText", t.t("settings.terms"), { nav.push("/betingelser") }))
        add(SettingsSearchItem("FileText", t.t("settings.privacyPolicy"), { nav.push("/privatlivspolitik") }))
        add(SettingsSearchItem("FileText", t.t("settings.dataTracking"), { nav.push("/privatlivspolitik#datasporing") }))
    }
    val normalized = query.trim().lowercase()
    val results = if (normalized.isNotEmpty()) searchItems.filter { it.label.lowercase().contains(normalized) } else null

    HcScreen(title = t.t("settings.title"), back = nav.showBack, contentPadding = SettingsPagePadding) {
        SettingsPage(gap = HcDimens.SpaceSection) {
            SettingsSearchField(query, { query = it }, placeholder = t.t("settings.search"))
            if (results != null) {
                if (results.isNotEmpty()) {
                    SettingsAccordionCard {
                        results.forEachIndexed { index, item ->
                            SettingsChevronRow(item.label, item.onClick, icon = item.icon, divider = index < results.lastIndex, iconContent = item.customIcon)
                        }
                    }
                } else {
                    HcText(t.t("settings.searchNoResults"), HcTypeRoles.Body, Modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary)
                }
            } else {
                SettingsAccordionCard {
                    SettingsChevronRow(t.t("settings.languageAndRegion"), { nav.push("/profile/settings/language-region") }, icon = "World", divider = false)
                }

                SettingsAccordionCard {
                    if (showFamily) {
                        SettingsChevronRow(t.t("family.title"), { nav.push("/profile/family") }, icon = "Users")
                        if (controlsOthers) {
                            SettingsChevronRow(t.t("family.deletePermissions.title"), { nav.push("/settings/delete-permissions") }, icon = "TrashOff")
                        }
                        if (isControlled) {
                            SettingsChevronRow(t.t("family.log.title"), { nav.push("/settings/control-log") }, icon = "History", badgeCount = family?.unseenCount)
                        }
                    }
                    SettingsChevronRow(t.t("profile.row.subscription"), { nav.push("/profile/subscription") }, icon = "CreditCard")
                    SettingsChevronRow(t.t("settings.payment"), { nav.push("/settings/payment") }, divider = false, iconContent = paymentIcon)
                }

                SettingsAccordionCard {
                    SettingsChevronRow(t.t("settings.setupTitle"), { nav.push("/profile/settings") }, icon = "Adjustments", divider = false)
                }

                SettingsAccordionCard {
                    SettingsChevronRow(t.t("settings.learnTheApp"), { startOnboarding() }, icon = "Refresh", divider = false)
                }

                SettingsAccordionCard {
                    SettingsChevronRow(t.t("settings.integrations"), { nav.push("/settings/integrations") }, icon = "PlugConnected", divider = false)
                }

                // Beskeder ligger på Profil (ejerens valg 2026-10-03).
                SettingsAccordionCard {
                    SettingsChevronRow(t.t("settings.notifications"), { nav.push("/profile/notifications") }, icon = "Bell", divider = false)
                }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SettingsGroupLabel(t.t("settings.display"))
                    SettingsDisplayRows(isFemale)
                }

                SettingsAccordionCard {
                    // Statisk hjælpeside i public/ — åbnes uden for appen.
                    SettingsChevronRow(t.t("settings.helpCenter"), { openHelp() }, icon = "Help")
                    SettingsChevronRow(t.t("profile.row.reportBug"), { nav.push("/profile/report-bug") }, icon = "Bug")
                    SettingsChevronRow(t.t("settings.contactSupport"), { nav.push("/settings/support") }, icon = "Lifebuoy")
                    SettingsChevronRow(t.t("settings.terms"), { nav.push("/betingelser") }, icon = "FileText")
                    SettingsChevronRow(t.t("settings.privacyPolicy"), { nav.push("/privatlivspolitik") }, icon = "FileText")
                    SettingsChevronRow(t.t("settings.dataTracking"), { nav.push("/privatlivspolitik#datasporing") }, icon = "FileText", divider = false)
                }
            }

            HcText(
                t.t("settings.logOut"),
                HcTypeRoles.Body,
                Modifier.fillMaxWidth().height(48.dp).clickable {
                    scope.launch {
                        Session.logout()
                        nav.resetTo("/login")
                    }
                }.padding(horizontal = 16.dp).wrapContentHeight(Alignment.CenterVertically),
            )
        }
    }
}

/** The "Visning" card — shared by /settings and /settings/display. */
@Composable
internal fun SettingsDisplayRows(isFemale: Boolean, includeResults: Boolean = true) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    SettingsAccordionCard {
        SettingsChevronRow(t.t("settings.frontPage"), { nav.push("/settings/display/front-page") }, icon = "Home2")
        // Resultatvisning hører under Visning (ejerens valg 2026-10-03).
        if (includeResults) SettingsChevronRow(t.t("settings.resultsDisplay"), { nav.push("/profile/settings/results") }, icon = "Eye")
        SettingsChevronRow(t.t("settings.recommendedLimits"), { nav.push("/settings/display/limits") }, icon = "AlertTriangle")
        SettingsChevronRow(t.t("displaySettings.uncertainty"), { nav.push("/settings/display/uncertainty") }, iconContent = { SettingsTildeRowIcon() })
        SettingsChevronRow(t.t("settings.calendarView"), { nav.push("/settings/display/calendar-view") }, icon = "CalendarWeek")
        SettingsChevronRow(t.t("settings.sleepQuality"), { nav.push("/settings/display/sleep-quality") }, icon = "Moon")
        SettingsChevronRow(t.t("settings.tipsTitle"), { nav.push("/settings/display/tips") }, icon = "Bulb", divider = isFemale)
        if (isFemale) {
            SettingsChevronRow(t.t("settings.menstrualCycle"), { nav.push("/settings/display/menstrual-cycle") }, icon = "CalendarHeart", divider = false)
        }
    }
}
