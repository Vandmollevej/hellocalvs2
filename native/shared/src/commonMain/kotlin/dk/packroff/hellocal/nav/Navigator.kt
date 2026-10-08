package dk.packroff.hellocal.nav

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue

/**
 * Screens are addressed by the SAME paths as the web app ("/profile/goals/42",
 * "/camera?mode=product"), so links, deep links (hellocal://<path>) and the
 * parity manifest (native/parity/screens.json) all line up 1:1 with the web.
 */
data class Location(
    val path: String,
    val query: Map<String, String> = emptyMap(),
    /** The "#anchor" part (web: location.hash without "#"), e.g. /viden/vitaminer#vitamin-c. */
    val fragment: String? = null,
) {
    val full: String
        get() = buildString {
            append(path)
            if (query.isNotEmpty()) append("?").append(query.entries.joinToString("&") { "${it.key}=${it.value}" })
            if (!fragment.isNullOrEmpty()) append("#").append(fragment)
        }

    companion object {
        fun parse(href: String): Location {
            val withoutScheme = href
                .removePrefix("hellocal://").let { if (it.startsWith("/")) it else "/$it" }
            val clean = withoutScheme.substringBefore('#')
            val fragment = withoutScheme.substringAfter('#', "").ifEmpty { null }?.let { decode(it) }
            val path = clean.substringBefore('?').trimEnd('/').ifEmpty { "/" }
            val query = clean.substringAfter('?', "").split('&').filter { it.contains('=') }.associate {
                decode(it.substringBefore('=')) to decode(it.substringAfter('='))
            }
            return Location(path, query, fragment)
        }

        /** URL-decodes a query component (UTF-8 percent escapes, '+' = space). */
        fun decode(s: String): String {
            val bytes = mutableListOf<Byte>()
            var i = 0
            while (i < s.length) {
                val c = s[i]
                if (c == '%' && i + 2 <= s.lastIndex) {
                    val b = s.substring(i + 1, i + 3).toIntOrNull(16)
                    if (b != null) {
                        bytes += b.toByte()
                        i += 3
                        continue
                    }
                }
                (if (c == '+') " " else c.toString()).encodeToByteArray().forEach { bytes += it }
                i++
            }
            return bytes.toByteArray().decodeToString()
        }

        fun encode(s: String): String = buildString {
            for (b in s.encodeToByteArray()) {
                val c = b.toInt().toChar()
                if (c.isLetterOrDigit() && b >= 0 || c in "-_.~") append(c)
                else append('%').append(((b.toInt() and 0xFF) + 0x100).toString(16).substring(1).uppercase())
            }
        }
    }
}

class Navigator(start: Location) {
    val stack = mutableStateListOf(start)
    val current: Location get() = stack.last()
    var tabRoot by mutableStateOf(start.path)
        private set

    fun push(href: String) = push(Location.parse(href))

    /** web: router.push(href) */
    fun push(location: Location) {
        if (stack.last() != location) stack.add(location)
    }

    /** Footer roots show no back arrow (docs/DECISIONS.md 2026-09-22). */
    val showBack: Boolean get() = stack.size > 1 && current.path !in TAB_ROOTS

    /** The current page is one of the icons in the bottom bar (web isMainFooterRoute). */
    val isTabRoot: Boolean get() = current.path in TAB_ROOTS

    /** ScreenHeader.handleBack: back, or the front page when the page was opened directly. */
    fun backOrHome() {
        if (!back()) replace("/")
    }

    /** Replaces the current screen (web: router.replace). */
    fun replace(href: String) {
        val location = Location.parse(href)
        stack[stack.lastIndex] = location
    }

    fun back(): Boolean {
        if (stack.size <= 1) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    /** Bottom-navigation tabs reset the stack to the tab root, like the web tab bar. */
    fun switchTab(location: Location) {
        tabRoot = location.path
        stack.clear()
        stack.add(location)
    }

    fun resetTo(href: String) = switchTab(Location.parse(href))

    companion object {
        /** Footer roots (useFooterRootHrefs): the hrefs of the icons the user has in the bottom bar. */
        val TAB_ROOTS: Set<String> get() = dk.packroff.hellocal.app.BottomNavLayout.activeHrefs
    }
}

val LocalNavigator = compositionLocalOf<Navigator> { error("No Navigator") }

/** Deep links can arrive before the UI exists (cold start from a widget). */
object DeepLinks {
    var pending by mutableStateOf<String?>(null)
        private set

    fun open(url: String) {
        pending = url
    }

    fun consume(): String? = pending.also { pending = null }
}
