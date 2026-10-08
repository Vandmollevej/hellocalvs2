package dk.packroff.hellocal.nav

import dk.packroff.hellocal.screens.auth.AuthRoutes

/** One line per feature area — add your area's list here. */
object RouteRegistry {
    val groups: List<List<ScreenRoute>> = listOf(
        AuthRoutes.routes,
    )
}
