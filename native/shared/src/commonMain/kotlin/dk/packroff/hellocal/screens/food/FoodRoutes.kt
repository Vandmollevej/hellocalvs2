package dk.packroff.hellocal.screens.food

import dk.packroff.hellocal.nav.ScreenRoute

/** Food & registration screens (web routes exactly as in native/parity/screens.json). */
object FoodRoutes {
    val routes = listOf(
        ScreenRoute("/") { HomeScreen(it) },
        ScreenRoute("/add/menu") { AddMenuScreen(it) },
        ScreenRoute("/add/[id]") { AddProductScreen(it) },
        ScreenRoute("/add/[id]/update") { ProductUpdateScreen(it) },
        ScreenRoute("/add/[id]/photo-award") { PhotoAwardScreen(it) },
        ScreenRoute("/registration/[id]") { RegistrationScreen(it) },
        ScreenRoute("/registration/[id]/report-error") { ReportErrorScreen(it) },
        ScreenRoute("/search") { SearchScreen(it) },
        ScreenRoute("/favorites") { FavoritesScreen(it) },
        ScreenRoute("/my-scans") { MyScansScreen(it) },
        ScreenRoute("/foods") { FoodsScreen(it) },
        ScreenRoute("/foods/new") { FoodsNewScreen(it) },
        ScreenRoute("/drinks") { DrinksScreen(it) },
        ScreenRoute("/drinks/[id]") { DrinkDetailScreen(it) },
        ScreenRoute("/create-dish") { CreateDishScreen(it) },
        ScreenRoute("/product/create") { ProductCreateScreen(it) },
    )
}
