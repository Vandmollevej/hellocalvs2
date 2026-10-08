package dk.packroff.hellocal.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.icons.HcIcon

/** src/lib/terms-hints.ts TermsHint: the anchor in /betingelser and the sheet's paragraphs. */
data class ProfileTermsHint(val anchor: String, val paragraphs: List<String>)

/**
 * src/components/hf/TermsSheet.tsx — the "Vilkår og betingelser" bar; a tap
 * opens a bottom sheet with the page's own terms text and a link to the
 * matching section of /betingelser.
 */
@Composable
fun ProfileTermsSheet(hint: ProfileTermsHint, title: String = "Vilkår og betingelser", goTo: String = "Gå til vilkår og betingelser") {
    val nav = LocalNavigator.current
    var open by remember { mutableStateOf(false) }
    ProfileTermsBar(open = false, title = title, onToggle = { open = true })
    if (open) {
        HcBottomSheet(onDismiss = { open = false }) {
            ProfileTermsBar(open = true, title = title, onToggle = { open = false })
            Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp).padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                hint.paragraphs.forEach { HcText(it, HcTypeRoles.Small) }
            }
            HcText(
                goTo,
                HcTypeRoles.Small,
                Modifier.fillMaxWidth().padding(top = 8.dp).clickable {
                    open = false
                    nav.push("/betingelser#${hint.anchor}")
                },
                bold = true,
                color = HcColors.Black,
                align = TextAlign.End,
            )
        }
    }
}

@Composable
private fun ProfileTermsBar(open: Boolean, title: String, onToggle: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(48.dp).clickable(onClick = onToggle).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        HcIcon("FileText", size = 24.dp, stroke = 1.75f, color = HcColors.Black)
        HcText(title, HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black)
        Box(Modifier.size(32.dp).border(2.dp, HcColors.Black, CircleShape), contentAlignment = Alignment.Center) {
            HcChevron(if (open) ChevronDirection.Down else ChevronDirection.Up, compact = true, color = HcColors.Black)
        }
    }
}
