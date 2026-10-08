package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon

/** src/components/knowledge/SearchField.tsx — pill-shaped tan search field with a search icon. */
@Composable
fun OnbSearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(HcColors.Tan).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HcIcon("Search", size = 18.dp, color = HcColors.TextSecondary)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = HcTypeRoles.Body.style(),
            cursorBrush = SolidColor(HcColors.Action),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Body, color = HcColors.Placeholder, maxLines = 1)
                    inner()
                }
            },
        )
    }
}

/** One row of src/components/knowledge/KnowledgeRows.tsx. */
data class OnbRow(val key: String, val label: String, val href: String)

/**
 * KnowledgeRows = AccordionCard + ChevronRow (src/components/hf/AccordionCard.tsx):
 * tan card, 48 px rows with icon, label and the HfChevron, divider between rows.
 */
@Composable
fun OnbChevronRows(rows: List<OnbRow>, icon: String, onOpen: (OnbRow) -> Unit, modifier: Modifier = Modifier, empty: String = "Ingen resultater.") {
    if (rows.isEmpty()) {
        HcText(empty, HcTypeRoles.Body, modifier, color = HcColors.TextSecondary)
        return
    }
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Tan)) {
        rows.forEachIndexed { index, row ->
            Row(
                Modifier.fillMaxWidth().height(48.dp).clickable { onOpen(row) }.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) { HcIcon(icon, size = 20.dp, color = HcColors.Black) }
                HcText(row.label, HcTypeRoles.Body, Modifier.weight(1f), maxLines = 1)
                HcChevron(color = HcColors.Black)
            }
            if (index < rows.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
        }
    }
}
