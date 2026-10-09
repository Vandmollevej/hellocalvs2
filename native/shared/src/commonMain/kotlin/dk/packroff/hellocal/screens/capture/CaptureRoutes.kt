package dk.packroff.hellocal.screens.capture

import dk.packroff.hellocal.nav.ScreenRoute

/** Capture & logging screens (water, weight, period, activity, camera, voice, chat, recipes, family). */
object CaptureRoutes {
    val routes = listOf(
        ScreenRoute("/water/create") { WaterCreateScreen(it) },
        ScreenRoute("/weight/create") { WeightCreateScreen(it) },
        ScreenRoute("/period/create") { PeriodCreateScreen(it) },
        ScreenRoute("/activity/create") { ActivityCreateScreen(it) },
        ScreenRoute("/weigh-reminders") { WeighRemindersScreen(it) },
        ScreenRoute("/camera") { CameraScreen(it) },
        ScreenRoute("/camera/create") { CameraCreateScreen(it) },
        ScreenRoute("/voice") { VoiceScreen(it) },
        ScreenRoute("/chat") { ChatScreen(it) },
        ScreenRoute("/profile/recipes") { RecipesScreen(it) },
        ScreenRoute("/profile/recipes/filters") { RecipeFiltersScreen(it) },
        ScreenRoute("/profile/recipes/[id]") { RecipeDetailScreen(it) },
        // RecipeViewScreen has no bottom navigation, like HelloFresh.
        ScreenRoute("/profile/recipes/hellofresh/[id]", fullScreen = true) { HelloFreshRecipeScreen(it) },
        ScreenRoute("/profile/family") { FamilyScreen(it) },
    )
}
