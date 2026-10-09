package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.icons.HcIcon

/** One <option> of a web <select>. */
data class SettingsOption(val value: String, val label: String)

/**
 * A native <select>: shows [anchor] and opens a dropdown with [options].
 * The web uses a plain <select> wherever one of several values is chosen.
 */
@Composable
fun SettingsDropdown(
    value: String,
    options: List<SettingsOption>,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    anchor: @Composable (selectedLabel: String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val selected = options.firstOrNull { it.value == value }?.label ?: value
    Box(modifier) {
        Box(Modifier.clickable { open = true }) { anchor(selected) }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }, modifier = Modifier.background(HcColors.Surface)) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { HcText(option.label, HcTypeRoles.Body, bold = option.value == value) },
                    onClick = {
                        open = false
                        if (option.value != value) onChange(option.value)
                    },
                )
            }
        }
    }
}

/**
 * src/components/hf/SetupSelectCard.tsx — .hf-card row with bold label and
 * small description on the left, a white rounded select on the right.
 */
@Composable
fun SettingsSelectCard(
    label: String,
    description: String,
    value: String,
    options: List<SettingsOption>,
    onChange: (String) -> Unit,
) {
    HcCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                HcText(label, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                HcText(description, HcTypeRoles.Small, color = HcColors.TextSecondary)
            }
            SettingsDropdown(value, options, onChange) { selectedLabel ->
                val shape = RoundedCornerShape(12.dp)
                Row(
                    Modifier.heightIn(min = HcDimens.ControlHeight).clip(shape).background(HcColors.White, shape)
                        .border(1.dp, HcColors.TanDark, shape).padding(start = 12.dp, end = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    HcText(selectedLabel, HcTypeRoles.Body, color = HcColors.Black, maxLines = 1)
                    HcIcon("ChevronDown", size = 14.dp, stroke = 2.5f, color = HcColors.Black)
                }
            }
        }
    }
}

/** Inline select inside a row (Kalendervisning): bold green value text. */
@Composable
fun SettingsInlineSelect(value: String, options: List<SettingsOption>, onChange: (String) -> Unit, color: Color = HcColors.Green) {
    SettingsDropdown(value, options, onChange) { selectedLabel ->
        HcText(selectedLabel, HcTypeRoles.Body, bold = true, color = color)
    }
}
