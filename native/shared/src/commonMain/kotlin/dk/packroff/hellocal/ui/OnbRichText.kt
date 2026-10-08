package dk.packroff.hellocal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style

/**
 * A paragraph with inline markup, for long hard-coded web texts (legal pages,
 * info pages) that mix plain text with <b>, links and placeholders:
 *  - `**bold**`
 *  - `[[Firmanavn]]` → the web's <Placeholder> (bold "[Firmanavn]" on warning-bg)
 *  - `{label|href}` → underlined link; "/path" opens the screen, "mailto:"/"https:" opens outside the app.
 */
@Composable
fun OnbRichText(
    markup: String,
    role: HcTypeRole = HcTypeRoles.Body,
    modifier: Modifier = Modifier,
    color: Color? = null,
    bold: Boolean = false,
    align: TextAlign? = null,
    linkColor: Color? = null,
) {
    val nav = LocalNavigator.current
    val text = remember(markup, linkColor) {
        onbRichAnnotated(markup, linkColor) { href ->
            if (href.startsWith("/")) nav.push(href) else NativeHooks.openExternalUrl(href)
        }
    }
    var style = role.style(color)
    if (bold) style = style.copy(fontWeight = FontWeight.Bold)
    Text(text = text, modifier = modifier, style = style, textAlign = align)
}

private val RICH_TOKEN = Regex("""\*\*(.+?)\*\*|\[\[(.+?)\]\]|\{([^|{}]+)\|([^{}]+)\}""")

fun onbRichAnnotated(markup: String, linkColor: Color? = null, onLink: (String) -> Unit): AnnotatedString = buildAnnotatedString {
    var last = 0
    for (match in RICH_TOKEN.findAll(markup)) {
        append(markup.substring(last, match.range.first))
        val groups = match.groupValues
        when {
            groups[1].isNotEmpty() -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(groups[1]) }
            groups[2].isNotEmpty() -> withStyle(SpanStyle(fontWeight = FontWeight.Bold, background = HcColors.WarningBg)) {
                append("[" + groups[2] + "]")
            }
            else -> {
                val href = groups[4]
                val linkStyle = SpanStyle(
                    textDecoration = TextDecoration.Underline,
                    color = linkColor ?: Color.Unspecified,
                )
                withLink(LinkAnnotation.Clickable(href, TextLinkStyles(style = linkStyle), LinkInteractionListener { onLink(href) })) {
                    append(groups[3])
                }
            }
        }
        last = match.range.last + 1
    }
    append(markup.substring(last))
}

/** <ul className="list-disc pl-5"> with rich-text items. */
@Composable
fun OnbBulletList(items: List<String>, modifier: Modifier = Modifier, role: HcTypeRole = HcTypeRoles.Body, gap: androidx.compose.ui.unit.Dp = 0.dp) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(gap)) {
        for (item in items) {
            Row(Modifier.fillMaxWidth().padding(start = 6.dp)) {
                HcText("•", role, Modifier.width(14.dp))
                OnbRichText(item, role, Modifier.weight(1f))
            }
        }
    }
}
