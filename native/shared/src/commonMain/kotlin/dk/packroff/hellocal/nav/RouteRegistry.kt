package dk.packroff.hellocal.nav

import dk.packroff.hellocal.screens.auth.AuthRoutes
import dk.packroff.hellocal.screens.calendar.CalendarRoutes
import dk.packroff.hellocal.screens.capture.CaptureRoutes
import dk.packroff.hellocal.screens.food.FoodRoutes
import dk.packroff.hellocal.screens.profile.ProfileRoutes
import dk.packroff.hellocal.screens.onboarding.OnboardingRoutes
import dk.packroff.hellocal.screens.settings.SettingsRoutes
import dk.packroff.hellocal.screens.statistics.StatisticsRoutes

/** One line per feature area — add your area's list here. */
object RouteRegistry {
    val groups: List<List<ScreenRoute>> = listOf(
        AuthRoutes.routes,
        SettingsRoutes.routes,
        OnboardingRoutes.routes,
        CalendarRoutes.routes,
        CaptureRoutes.routes,
        FoodRoutes.routes,
        ProfileRoutes.routes,
        StatisticsRoutes.routes,
    )
}
