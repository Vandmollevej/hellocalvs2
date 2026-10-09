package dk.packroff.hellocal.screens.statistics

import dk.packroff.hellocal.nav.ScreenRoute

/** Statistics & status — the web routes exactly as in native/parity/screens.json. */
object StatisticsRoutes {
    val routes = listOf(
        ScreenRoute("/statistics") { StatisticsScreen(it) },
        ScreenRoute("/statistics/sleep") { SleepStatisticsScreen(it) },
        ScreenRoute("/statistics/body-water") { BodyWaterStatisticsScreen(it) },
        ScreenRoute("/statistics/month-sinners") { MonthSinnersScreen(it) },
        ScreenRoute("/statistics/unused-cards") { UnusedStatCardsScreen(it) },
        ScreenRoute("/statistics/unused-charts") { UnusedStatChartsScreen(it) },
        ScreenRoute("/profile/status") { ProfileStatusScreen(it) },
    )
}
