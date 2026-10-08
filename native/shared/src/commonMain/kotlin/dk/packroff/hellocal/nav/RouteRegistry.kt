package dk.packroff.hellocal.nav

import dk.packroff.hellocal.screens.auth.AuthRoutes
import dk.packroff.hellocal.screens.calendar.CalendarRoutes
import dk.packroff.hellocal.screens.capture.CaptureRoutes
import dk.packroff.hellocal.screens.onboarding.OnboardingRoutes
import dk.packroff.hellocal.screens.settings.SettingsRoutes

/** One line per feature area — add your area's list here. */
object RouteRegistry {
    val groups: List<List<ScreenRoute>> = listOf(
        AuthRoutes.routes,
        SettingsRoutes.routes,
        OnboardingRoutes.routes,
        CalendarRoutes.routes,
        CaptureRoutes.routes,
    )
}
