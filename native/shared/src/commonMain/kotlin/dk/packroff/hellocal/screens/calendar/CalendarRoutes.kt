package dk.packroff.hellocal.screens.calendar

import dk.packroff.hellocal.nav.ScreenRoute

object CalendarRoutes {
    val routes = listOf(
        ScreenRoute("/calendar") { CalendarScreen(it) },
    )
}
