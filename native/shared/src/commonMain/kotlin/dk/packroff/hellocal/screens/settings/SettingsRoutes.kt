package dk.packroff.hellocal.screens.settings

import dk.packroff.hellocal.nav.ScreenRoute

object SettingsRoutes {
    val routes = listOf(
        ScreenRoute("/settings") { SettingsScreen(it) },
        ScreenRoute("/profile/settings") { ProfileSetupScreen(it) },
        ScreenRoute("/profile/settings/language-region") { LanguageRegionScreen(it) },
        ScreenRoute("/profile/settings/results") { ResultsDisplayScreen(it) },
        ScreenRoute("/settings/display") { DisplaySettingsScreen(it) },
        ScreenRoute("/settings/display/calendar-view") { CalendarViewSettingsScreen(it) },
        ScreenRoute("/settings/display/front-page") { FrontPageSettingsScreen(it) },
        ScreenRoute("/settings/display/limits") { RecommendedLimitsSettingsScreen(it) },
        ScreenRoute("/settings/display/menstrual-cycle") { MenstrualCycleSettingsScreen(it) },
        ScreenRoute("/settings/display/sleep-quality") { SleepQualitySettingsScreen(it) },
        ScreenRoute("/settings/display/tips") { TipsSettingsScreen(it) },
        ScreenRoute("/settings/display/uncertainty") { UncertaintySettingsScreen(it) },
        ScreenRoute("/settings/control-log") { SettingsControlLogScreen(it) },
        ScreenRoute("/settings/delete-permissions") { SettingsDeletePermissionsScreen(it) },
        ScreenRoute("/settings/import") { SettingsImportScreen(it) },
        // TODO: /settings/integrations and /settings/integrations/[app] (worker still writing them).
        ScreenRoute("/settings/payment") { SettingsPaymentScreen(it) },
        ScreenRoute("/settings/payment/mobilepay") { SettingsPaymentMobilePayScreen(it) },
        ScreenRoute("/settings/payment/stripe") { SettingsPaymentStripeScreen(it) },
        ScreenRoute("/settings/support") { SettingsSupportScreen(it) },
        ScreenRoute("/settings/support/contact") { SettingsSupportContactScreen(it) },
        ScreenRoute("/settings/support/requests") { SettingsSupportRequestsScreen(it) },
        ScreenRoute("/settings/support/requests/[id]") { SettingsSupportRequestThreadScreen(it) },
        ScreenRoute("/settings/hello-doc") { SettingsHelloDocScreen(it) },
        ScreenRoute("/settings/hello-doc/[id]") { SettingsHelloDocEditScreen(it) },
        ScreenRoute("/settings/hello-doc/invite") { SettingsHelloDocInviteScreen(it) },
        ScreenRoute("/settings/hello-doc/preview", fullScreen = true) { SettingsHelloDocPreviewScreen(it) },
    )
}
