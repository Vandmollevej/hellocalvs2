package dk.packroff.hellocal.screens.settings

import androidx.compose.runtime.mutableIntStateOf
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.platform.NativeHooks
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * Per-device preferences that the web keeps in localStorage (same keys), kept
 * in NativeHooks.secureStorage here (PORTING.md rule 7):
 * - src/lib/calendar-view-pref.ts hellocal.kalender.defaultView
 * - src/lib/frontpage-layout.ts  hellocal.frontpage.fabSide
 * - src/lib/add-actions.ts       hellocal.frontpage.wheelActions
 * - src/lib/frontpage-stats.ts   hellocal.frontpage.statKeys
 * - src/lib/help-prefs.ts        hellocal.help.showTooltips / showStartupTips / showGoalTips
 *
 * Reading [version] inside a composable makes it recompose after any save
 * (the web's useSyncExternalStore listeners).
 */
object SettingsLocalPrefs {
    private val versionState = mutableIntStateOf(0)
    val version: Int get() = versionState.intValue

    private fun read(key: String): String? = runCatching { NativeHooks.secureStorage.get(key) }.getOrNull()

    private fun write(key: String, value: String?) {
        runCatching { NativeHooks.secureStorage.set(key, value) }
        versionState.intValue++
    }

    // Units (src/lib/units.ts) live in the shared module ui/Units.kt.

    // ---- Calendar default view (src/lib/calendar-view-pref.ts) ----

    val CALENDAR_VIEWS = listOf("list", "month", "week", "day")
    const val DEFAULT_CALENDAR_VIEW = "month"
    private const val CALENDAR_VIEW_KEY = "hellocal.kalender.defaultView"

    fun calendarView(): String = read(CALENDAR_VIEW_KEY)?.takeIf { it in CALENDAR_VIEWS } ?: DEFAULT_CALENDAR_VIEW
    fun saveCalendarView(view: String) = write(CALENDAR_VIEW_KEY, view)

    // ---- Front page FAB side (src/lib/frontpage-layout.ts) ----

    private const val FAB_SIDE_KEY = "hellocal.frontpage.fabSide"
    fun fabSide(): String = read(FAB_SIDE_KEY)?.takeIf { it == "left" || it == "right" } ?: "left"
    fun saveFabSide(side: String) = write(FAB_SIDE_KEY, side)
    fun oppositeSide(side: String): String = if (side == "left") "right" else "left"

    // ---- Wheel actions (src/lib/add-actions.ts) ----

    const val MAX_WHEEL_ACTIONS = 5
    val DEFAULT_WHEEL_ACTION_KEYS = listOf("ownDishes", "search", "weight", "water", "camera")
    private const val WHEEL_ACTIONS_KEY = "hellocal.frontpage.wheelActions"

    private fun readStringList(key: String): List<String>? = read(key)?.let { raw ->
        runCatching { (ApiJson.parseToJsonElement(raw) as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } }.getOrNull()
    }

    private fun writeStringList(key: String, list: List<String>) = write(key, JsonArray(list.map { JsonPrimitive(it) }).toString())

    fun wheelActionKeys(): List<String> {
        val keys = readStringList(WHEEL_ACTIONS_KEY)?.filter { key -> SETTINGS_ADD_ACTIONS.any { it.key == key } }?.take(MAX_WHEEL_ACTIONS)
        return if (keys.isNullOrEmpty()) DEFAULT_WHEEL_ACTION_KEYS else keys
    }

    fun saveWheelActionKeys(keys: List<String>) = writeStringList(WHEEL_ACTIONS_KEY, keys.take(MAX_WHEEL_ACTIONS))

    // ---- Front page number slider (src/lib/frontpage-stats.ts) ----

    val DEFAULT_FRONTPAGE_STAT_KEYS = listOf("calories", "kcalRemaining", "burned", "steps", "distanceKm")
    private const val FRONTPAGE_STATS_KEY = "hellocal.frontpage.statKeys"

    fun frontpageStatKeys(): List<String> {
        val keys = readStringList(FRONTPAGE_STATS_KEY)?.filter { key -> SETTINGS_FRONTPAGE_STATS.any { it.key == key } }
        return if (keys.isNullOrEmpty()) DEFAULT_FRONTPAGE_STAT_KEYS else keys
    }

    fun saveFrontpageStatKeys(keys: List<String>) = writeStringList(FRONTPAGE_STATS_KEY, keys)

    // ---- Help preferences (src/lib/help-prefs.ts) — default on, "0" = off ----

    private const val TOOLTIPS_KEY = "hellocal.help.showTooltips"
    private const val STARTUP_TIPS_KEY = "hellocal.help.showStartupTips"
    private const val GOAL_TIPS_KEY = "hellocal.help.showGoalTips"

    fun showTooltips(): Boolean = read(TOOLTIPS_KEY) != "0"
    fun saveShowTooltips(value: Boolean) = write(TOOLTIPS_KEY, if (value) "1" else "0")
    fun showStartupTips(): Boolean = read(STARTUP_TIPS_KEY) != "0"
    fun saveShowStartupTips(value: Boolean) = write(STARTUP_TIPS_KEY, if (value) "1" else "0")
    fun showGoalTips(): Boolean = read(GOAL_TIPS_KEY) != "0"
    fun saveShowGoalTips(value: Boolean) = write(GOAL_TIPS_KEY, if (value) "1" else "0")
}

/** One entry of ADD_ACTIONS in src/lib/add-actions.ts. Icon: Tabler name or a public/ PNG. */
data class SettingsAddAction(
    val key: String,
    val href: String,
    val labelKey: String,
    val icon: String? = null,
    val imageSrc: String? = null,
    val requiresCycleTracking: Boolean = false,
)

val SETTINGS_ADD_ACTIONS = listOf(
    SettingsAddAction("microphone", "/voice", "addButton.microphone", icon = "Microphone"),
    SettingsAddAction("ownDishes", "/create-dish", "addButton.ownDishes", imageSrc = "/icons/gryde.png"),
    SettingsAddAction("search", "/search", "addButton.search", icon = "Search"),
    SettingsAddAction("weight", "/weight/create", "addButton.weight", imageSrc = "/icons/bathroom-scale.png"),
    SettingsAddAction("water", "/water/create", "addButton.water", imageSrc = "/icons/water-glass.png"),
    SettingsAddAction("activity", "/activity/create", "addButton.activity", imageSrc = "/icons/activity-3d.png"),
    SettingsAddAction("camera", "/camera?mode=product", "addButton.camera", icon = "Camera"),
    SettingsAddAction("targetWeight", "/profile/goals", "profile.actions.target", imageSrc = "/icons/party-popper.png"),
    SettingsAddAction("bodyMeasurements", "/profile/body-measurements", "profile.row.bodyMeasurements", imageSrc = "/icons/body-measurements/waist-male.png"),
    SettingsAddAction("menstrualCycle", "/period/create", "addButton.menstrualCycle", icon = "CalendarHeart", requiresCycleTracking = true),
    SettingsAddAction("drinks", "/drinks", "addButton.drinks", icon = "GlassCocktail"),
)

/** visibleAddActions(): menstrual cycle only for FEMALE + cycle tracking; female waist figure for women. */
fun settingsVisibleAddActions(sex: String?, cycleTrackingEnabled: Boolean): List<SettingsAddAction> =
    SETTINGS_ADD_ACTIONS
        .filter { !it.requiresCycleTracking || (sex == "FEMALE" && cycleTrackingEnabled) }
        .map { if (it.key == "bodyMeasurements" && sex == "FEMALE") it.copy(imageSrc = "/icons/body-measurements/waist-female.png") else it }

/** FRONTPAGE_STAT_DEFS in src/lib/frontpage-stats.ts (key, label, icon). "Drumstick"/"WaterGlass" are custom icons. */
data class SettingsFrontpageStat(val key: String, val labelKey: String, val icon: String)

val SETTINGS_FRONTPAGE_STATS = listOf(
    SettingsFrontpageStat("calories", "frontPageStats.calories", "Drumstick"),
    SettingsFrontpageStat("kcalRemaining", "frontPageStats.kcalRemaining", "Drumstick"),
    SettingsFrontpageStat("protein", "frontPageStats.protein", "Egg"),
    SettingsFrontpageStat("carbs", "frontPageStats.carbs", "ToolsKitchen2"),
    SettingsFrontpageStat("fat", "frontPageStats.fat", "Droplet"),
    SettingsFrontpageStat("sugar", "frontPageStats.sugar", "Candy"),
    SettingsFrontpageStat("fiber", "frontPageStats.fiber", "Leaf"),
    SettingsFrontpageStat("salt", "frontPageStats.salt", "Salt"),
    SettingsFrontpageStat("potassium", "frontPageStats.potassium", "Apple"),
    SettingsFrontpageStat("calcium", "frontPageStats.calcium", "Bone"),
    SettingsFrontpageStat("iron", "frontPageStats.iron", "Atom2"),
    SettingsFrontpageStat("saturatedFat", "frontPageStats.saturatedFat", "Droplet"),
    SettingsFrontpageStat("unsaturatedFat", "frontPageStats.unsaturatedFat", "Droplet"),
    SettingsFrontpageStat("transFat", "frontPageStats.transFat", "Droplet"),
    SettingsFrontpageStat("cholesterol", "frontPageStats.cholesterol", "Heartbeat"),
    SettingsFrontpageStat("vitaminA", "frontPageStats.vitaminA", "Apple"),
    SettingsFrontpageStat("vitaminC", "frontPageStats.vitaminC", "Lemon2"),
    SettingsFrontpageStat("water", "frontPageStats.water", "WaterGlass"),
    SettingsFrontpageStat("burned", "frontPageStats.burned", "Flame"),
    SettingsFrontpageStat("steps", "frontPageStats.steps", "Footsteps"),
    SettingsFrontpageStat("distanceKm", "frontPageStats.distanceKm", "Route"),
)
