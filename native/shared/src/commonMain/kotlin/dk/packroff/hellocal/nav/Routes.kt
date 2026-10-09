package dk.packroff.hellocal.nav

import androidx.compose.runtime.Composable

/** What a screen receives: path params from "[id]" segments, the query string and the "#fragment". */
class RouteArgs(val params: Map<String, String>, val query: Map<String, String>, val fragment: String? = null) {
    operator fun get(name: String): String = params[name] ?: query[name] ?: ""
    fun opt(name: String): String? = params[name] ?: query[name]
}

/**
 * One native screen for one web route. `pattern` is the web route exactly as in
 * native/parity/screens.json ("/profile/goals/[id]"), so the parity check can
 * tie the two together.
 */
class ScreenRoute(
    val pattern: String,
    /** Shown without the bottom navigation (login, full-screen flows). */
    val fullScreen: Boolean = false,
    /** Reachable without login. */
    val public: Boolean = false,
    val content: @Composable (RouteArgs) -> Unit,
) {
    private val segments = pattern.trim('/').split('/').filter { it.isNotEmpty() }

    fun match(path: String): Map<String, String>? {
        val parts = path.trim('/').split('/').filter { it.isNotEmpty() }
        if (parts.size != segments.size) return null
        val params = mutableMapOf<String, String>()
        for ((seg, part) in segments.zip(parts)) {
            if (seg.startsWith("[") && seg.endsWith("]")) params[seg.trim('[', ']')] = Location.decode(part)
            else if (seg != part) return null
        }
        return params
    }

    /** Static segments beat "[param]" segments ("/profile/goals/new" before "/profile/goals/[id]"). */
    val specificity: Int get() = segments.count { !it.startsWith("[") }
}

/**
 * All native screens. Each feature area keeps its own list (screens/<area>/…Routes.kt)
 * so parallel work does not collide in one file.
 */
object Routes {
    private val all: List<ScreenRoute> by lazy {
        RouteRegistry.groups.flatten().sortedByDescending { it.specificity }
    }

    fun resolve(path: String): Pair<ScreenRoute, Map<String, String>>? {
        for (route in all) {
            val params = route.match(path) ?: continue
            return route to params
        }
        return null
    }
}
