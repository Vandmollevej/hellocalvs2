package dk.packroff.hellocal.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.LinkInteractionListener
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import dk.packroff.hellocal.api.HelloCalConfig
import dk.packroff.hellocal.nav.Navigator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style

/**
 * Opens a link from rendered text like the web's <a>/<Link>: an app path
 * ("/profile", or a full link to the app's own site) opens the screen; http(s),
 * mailto and tel open outside the app. Shared by [HcHtmlText] and OnbRichText.
 */
fun hcOpenHref(nav: Navigator, href: String) {
    val target = href.trim()
    when {
        target.startsWith("/") && !target.startsWith("//") -> nav.push(target)
        target.startsWith(HelloCalConfig.BASE_URL + "/") -> nav.push(target.removePrefix(HelloCalConfig.BASE_URL))
        target.startsWith("http://") || target.startsWith("https://") ||
            target.startsWith("mailto:") || target.startsWith("tel:") -> NativeHooks.openExternalUrl(target)
    }
}

/**
 * HTML from the server (e.g. a message body, web: dangerouslySetInnerHTML)
 * as one styled text: <b>/<strong> bold, <i>/<em> italic, <u> underline,
 * <a href> clickable links ([hcOpenHref]), <p>/<div>/<h1–6>/<li>/<tr> as lines,
 * <br> line breaks and <ul>/<ol> lists. Whitespace collapses like in a browser.
 *
 * Defaults are a normal document look; [linkUnderline] = false and
 * [listMarkers] = false give the Tailwind-preflight look the web app has
 * where it injects HTML without extra CSS (links inherit colour and have no
 * underline, lists have no bullets, paragraphs have no margin).
 */
@Composable
fun HcHtmlText(
    html: String,
    role: HcTypeRole = HcTypeRoles.Body,
    modifier: Modifier = Modifier,
    color: Color? = null,
    linkColor: Color? = null,
    linkUnderline: Boolean = true,
    listMarkers: Boolean = true,
    align: TextAlign? = null,
) {
    val nav = LocalNavigator.current
    val text = remember(html, linkColor, linkUnderline, listMarkers) {
        hcHtmlAnnotated(html, linkColor, linkUnderline, listMarkers) { href -> hcOpenHref(nav, href) }
    }
    Text(text = text, modifier = modifier, style = role.style(color), textAlign = align)
}

private val HC_HTML_BLOCK_TAGS = setOf(
    "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "tr", "table", "tbody", "thead",
    "blockquote", "section", "article", "header", "footer", "hr", "pre", "dl", "dt", "dd",
)

private val HC_HTML_HREF = Regex("""(?i)\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""")

private val HC_HTML_NAMED_ENTITIES = mapOf(
    "amp" to "&", "lt" to "<", "gt" to ">", "quot" to "\"", "apos" to "'", "nbsp" to " ",
    "ndash" to "–", "mdash" to "—", "hellip" to "…", "laquo" to "«", "raquo" to "»",
    "aelig" to "æ", "oslash" to "ø", "aring" to "å", "AElig" to "Æ", "Oslash" to "Ø", "Aring" to "Å",
)

/** &amp; &lt; &gt; &quot; &#39; &nbsp; … and numeric (&#123; / &#x1F;) character references. */
fun hcHtmlDecodeEntities(text: String): String {
    if (!text.contains('&')) return text
    val out = StringBuilder()
    var i = 0
    while (i < text.length) {
        val c = text[i]
        if (c == '&') {
            val end = text.indexOf(';', i + 1)
            if (end > i + 1 && end - i <= 12) {
                val name = text.substring(i + 1, end)
                val decoded: String? = when {
                    name.startsWith("#x") || name.startsWith("#X") -> name.substring(2).toIntOrNull(16)?.let { hcHtmlCodePoint(it) }
                    name.startsWith("#") -> name.substring(1).toIntOrNull()?.let { hcHtmlCodePoint(it) }
                    else -> HC_HTML_NAMED_ENTITIES[name]
                }
                if (decoded != null) {
                    out.append(decoded)
                    i = end + 1
                    continue
                }
            }
        }
        out.append(c)
        i++
    }
    return out.toString()
}

private fun hcHtmlCodePoint(cp: Int): String? = when {
    cp <= 0 || cp > 0x10FFFF -> null
    cp < 0x10000 -> cp.toChar().toString()
    else -> {
        val v = cp - 0x10000
        charArrayOf(((v shr 10) + 0xD800).toChar(), ((v and 0x3FF) + 0xDC00).toChar()).concatToString()
    }
}

/** HTML collapsible white space (not the no-break space). */
private fun hcHtmlIsSpace(c: Char): Boolean = c == ' ' || c == '\n' || c == '\t' || c == '\r' || c == '\u000C'

/** Builds the AnnotatedString for [HcHtmlText]; [onLink] gets the decoded href. */
fun hcHtmlAnnotated(
    html: String,
    linkColor: Color? = null,
    linkUnderline: Boolean = true,
    listMarkers: Boolean = true,
    onLink: (String) -> Unit,
): AnnotatedString {
    val builder = AnnotatedString.Builder()
    // Open inline tags and the builder index of the style/link they pushed.
    val open = mutableListOf<Pair<String, Int>>()
    // Lists: null = <ul>, else the next <ol> number.
    val lists = mutableListOf<IntArray?>()
    var hasContent = false
    var pendingSpace = false
    var pendingBreaks = 0

    fun emit(text: String) {
        if (text.isEmpty()) return
        if (pendingBreaks > 0) {
            repeat(pendingBreaks) { builder.append('\n') }
            pendingBreaks = 0
            pendingSpace = false
        } else if (pendingSpace) {
            builder.append(' ')
        }
        pendingSpace = false
        builder.append(text)
        hasContent = true
    }

    fun text(raw: String) {
        val decoded = hcHtmlDecodeEntities(raw)
        val word = StringBuilder()
        for (ch in decoded) {
            if (hcHtmlIsSpace(ch)) {
                if (word.isNotEmpty()) {
                    emit(word.toString())
                    word.clear()
                }
                if (hasContent && pendingBreaks == 0) pendingSpace = true
            } else {
                word.append(ch)
            }
        }
        if (word.isNotEmpty()) emit(word.toString())
    }

    fun blockBoundary() {
        pendingSpace = false
        if (hasContent && pendingBreaks == 0) pendingBreaks = 1
    }

    fun lineBreak() {
        pendingSpace = false
        if (hasContent) pendingBreaks += 1
    }

    fun closeInline(name: String) {
        val at = open.indexOfLast { it.first == name }
        if (at < 0) return
        builder.pop(open[at].second)
        while (open.size > at) open.removeAt(open.lastIndex)
    }

    var i = 0
    val n = html.length
    while (i < n) {
        val lt = html.indexOf('<', i)
        if (lt < 0) {
            text(html.substring(i))
            break
        }
        if (lt > i) text(html.substring(i, lt))
        // Comments.
        if (html.startsWith("<!--", lt)) {
            val end = html.indexOf("-->", lt + 4)
            i = if (end < 0) n else end + 3
            continue
        }
        // Find the end of the tag, skipping '>' inside quoted attribute values.
        var j = lt + 1
        var quote: Char? = null
        while (j < n) {
            val c = html[j]
            if (quote != null) {
                if (c == quote) quote = null
            } else if (c == '"' || c == '\'') {
                quote = c
            } else if (c == '>') {
                break
            }
            j++
        }
        if (j >= n) {
            // A lone "<" without a tag end is text.
            text(html.substring(lt))
            break
        }
        val inner = html.substring(lt + 1, j).trim()
        i = j + 1
        val closing = inner.startsWith("/")
        val name = inner.removePrefix("/").takeWhile { it.isLetterOrDigit() }.lowercase()
        if (name.isEmpty()) {
            // "<" followed by something that is not a tag (e.g. "a < b") is text.
            if (!inner.startsWith("!")) text(html.substring(lt, i))
            continue
        }
        // Skip the contents of <script>/<style>/<head>.
        if (!closing && (name == "script" || name == "style" || name == "head" || name == "title")) {
            val end = html.indexOf("</$name", i, ignoreCase = true)
            i = if (end < 0) n else (html.indexOf('>', end).takeIf { it >= 0 }?.plus(1) ?: n)
            continue
        }
        when {
            name == "br" -> lineBreak()
            name in HC_HTML_BLOCK_TAGS -> {
                blockBoundary()
                if (!closing) {
                    when (name) {
                        "ul" -> { lists.add(null) }
                        "ol" -> { lists.add(intArrayOf(1)) }
                        "li" -> {
                            if (listMarkers) {
                                val counter = lists.lastOrNull()
                                if (counter != null) {
                                    emit("${counter[0]}. ")
                                    counter[0] += 1
                                } else {
                                    emit("• ")
                                }
                            }
                        }
                        else -> Unit
                    }
                } else if ((name == "ul" || name == "ol") && lists.isNotEmpty()) {
                    lists.removeAt(lists.lastIndex)
                }
            }
            closing -> when (name) {
                "b", "strong", "i", "em", "u", "a" -> closeInline(name)
                else -> Unit
            }
            name == "b" || name == "strong" -> open.add(name to builder.pushStyle(SpanStyle(fontWeight = FontWeight.Bold)))
            name == "i" || name == "em" -> open.add(name to builder.pushStyle(SpanStyle(fontStyle = FontStyle.Italic)))
            name == "u" -> open.add(name to builder.pushStyle(SpanStyle(textDecoration = TextDecoration.Underline)))
            name == "a" -> {
                val match = HC_HTML_HREF.find(inner)
                val href = match?.groupValues?.drop(1)?.firstOrNull { it.isNotEmpty() }?.let { hcHtmlDecodeEntities(it) }
                if (href != null && !inner.endsWith("/")) {
                    val linkStyle = SpanStyle(
                        color = linkColor ?: Color.Unspecified,
                        textDecoration = if (linkUnderline) TextDecoration.Underline else null,
                    )
                    val index = builder.pushLink(
                        LinkAnnotation.Clickable(href, TextLinkStyles(style = linkStyle), LinkInteractionListener { onLink(href) }),
                    )
                    open.add(name to index)
                }
            }
            else -> Unit
        }
    }
    return builder.toAnnotatedString()
}
