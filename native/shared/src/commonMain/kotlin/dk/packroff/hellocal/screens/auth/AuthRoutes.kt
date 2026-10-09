package dk.packroff.hellocal.screens.auth

import dk.packroff.hellocal.nav.ScreenRoute

object AuthRoutes {
    val routes = listOf(
        ScreenRoute("/login", fullScreen = true, public = true) { LoginScreen(it) },
    )
}
