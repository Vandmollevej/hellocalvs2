package dk.packroff.hellocal.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.OnbSearchField
import dk.packroff.hellocal.ui.icons.HcIcon

// Shared frame of the stand-alone reference pages (/mad-paa-latin, /vitaminer, /e-numre):
// white page, sticky header with an arrow back to "/", title and a search field.

@Composable
internal fun DirectoryHeader(
    title: String,
    query: String,
    onQuery: (String) -> Unit,
    placeholder: String,
    trailing: String? = null,
    below: (@Composable ColumnScope.() -> Unit)? = null,
) {
    val nav = LocalNavigator.current
    Column(Modifier.fillMaxWidth().background(HcColors.White).statusBarsPadding()) {
        Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.size(32.dp).clip(CircleShape).clickable { nav.backOrHome() }, contentAlignment = Alignment.Center) {
                    HcIcon("ArrowLeft", size = 20.dp, color = HcColors.Black)
                }
                HcText(title, HcTypeRoles.Title)
                if (trailing != null) {
                    Spacer(Modifier.weight(1f))
                    HcText(trailing, HcTypeRoles.Small, color = HcColors.TextSecondary)
                }
            }
            OnbSearchField(query, onQuery, placeholder)
            below?.invoke(this)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
    }
}

/** "rounded-2xl border p-4" entry card; green border when it is the linked/active one. */
@Composable
internal fun DirectoryCard(active: Boolean, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        Modifier.fillMaxWidth().clip(shape).border(1.dp, if (active) HcColors.Green else HcColors.Black.copy(alpha = 0.1f), shape).padding(16.dp),
        content = content,
    )
}

/** Uppercase small grey heading ("hf-type-small hf-heading uppercase text-text-secondary"). */
@Composable
internal fun SmallCapsLabel(text: String, modifier: Modifier = Modifier) {
    HcText(text.uppercase(), HcTypeRoles.Small, modifier, color = HcColors.TextSecondary, bold = true)
}
