package dk.packroff.hellocal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles

// src/components/hf/LegalDocument.tsx — building blocks of /betingelser and /privatlivspolitik.

/**
 * The "#fragment" of the legal page (web: location.hash) and where the
 * section with that id reports its position (y in root coordinates), so the
 * page can scroll to it like the browser does.
 */
class OnbLegalAnchor(val fragment: String?, val onTargetPositioned: (rootY: Float) -> Unit)

val LocalOnbLegalAnchor = staticCompositionLocalOf<OnbLegalAnchor?> { null }

/** LegalSection: section title, then the body paragraphs (hf-type-body, gap 8, opacity 90 %). [id] = the web's section id (anchor). */
@Composable
fun OnbLegalSection(title: String, modifier: Modifier = Modifier, id: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val anchor = LocalOnbLegalAnchor.current
    val target = anchor?.takeIf { id != null && it.fragment == id }
    Column(
        modifier
            .fillMaxWidth()
            .padding(top = 32.dp)
            .let { base -> if (target != null) base.onGloballyPositioned { coords -> target.onTargetPositioned(coords.positionInRoot().y) } else base },
    ) {
        HcSectionTitle(title)
        Column(
            Modifier.fillMaxWidth().padding(top = 8.dp).alpha(0.9f),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            content = content,
        )
    }
}

/** LegalSummary: the "Kort fortalt" card at the top. */
@Composable
fun OnbLegalSummary(title: String, items: List<String>, modifier: Modifier = Modifier) {
    HcCard(modifier.padding(top = 16.dp)) {
        HcSectionTitle(title)
        OnbBulletList(items, Modifier.padding(top = 8.dp), gap = 6.dp)
    }
}

/** LegalPromise: bold sentence with a 4 px green bar on the left. */
@Composable
fun OnbLegalPromise(text: String, modifier: Modifier = Modifier) {
    OnbRichText(
        text,
        HcTypeRoles.Body,
        modifier
            .fillMaxWidth()
            .drawBehind { drawRect(HcColors.Green, size = Size(4.dp.toPx(), size.height)) }
            .padding(start = 16.dp),
        bold = true,
    )
}
