package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Text
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.style

/** src/components/hf/ClampedText.tsx — højst tre linjer, "…Vis mere" på tredje linje. */
@Composable
fun HcClampedText(
    text: String,
    role: HcTypeRole,
    modifier: Modifier = Modifier,
    color: Color? = null,
    background: Color = HcColors.Card,
) {
    val t = LocalTranslator.current
    var expanded by remember(text) { mutableStateOf(false) }
    var overflowing by remember(text) { mutableStateOf(false) }
    Column(modifier) {
        Box {
            Text(
                text,
                style = role.style(color),
                maxLines = if (expanded) Int.MAX_VALUE else 3,
                onTextLayout = { if (!expanded) overflowing = it.hasVisualOverflow },
            )
            if (overflowing && !expanded) {
                Text(
                    "…" + t.t("addProduct.showMore"),
                    style = role.style(color).copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .background(background)
                        .padding(start = 12.dp)
                        .clickable { expanded = true },
                )
            }
        }
        if (expanded) {
            Text(
                t.t("addProduct.showLess"),
                style = role.style(color).copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
                modifier = Modifier.clickable { expanded = false },
            )
        }
    }
}
