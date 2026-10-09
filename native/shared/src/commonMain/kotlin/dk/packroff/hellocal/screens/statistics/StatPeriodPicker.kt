package dk.packroff.hellocal.screens.statistics

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcButton
import dk.packroff.hellocal.ui.HcDivider
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.StatsDateField
import dk.packroff.hellocal.ui.VSpace
import dk.packroff.hellocal.ui.icons.HcIcon
import dk.packroff.hellocal.ui.statsSelected

/**
 * src/components/StatPeriodPicker.tsx — one period for the whole statistics
 * page: quick presets plus a from–to range. The panel opens under the "Vis:"
 * button over the content and spans the full content width.
 */
@Composable
internal fun StatPeriodPicker(selection: StatPeriodSelection, onChange: (StatPeriodSelection) -> Unit) {
    val t = LocalTranslator.current
    val density = LocalDensity.current
    var open by remember { mutableStateOf(false) }
    var widthPx by remember { mutableIntStateOf(0) }
    val range = remember { selectionRange(selection) }
    var customFrom by remember { mutableStateOf(range.start) }
    var customTo by remember { mutableStateOf(range.end.plusDays(-1)) }

    fun applyCustomRange() {
        val end = customTo.plusDays(1)
        if (customFrom >= end) return
        onChange(StatPeriodSelection.Custom(customFrom, end))
        open = false
    }

    Box(Modifier.fillMaxWidth().onGloballyPositioned { widthPx = it.size.width }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            HcText(t.t("statPeriodPicker.showLabel"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
            Row(
                Modifier
                    .heightIn(min = 36.dp)
                    .clickable { open = !open }
                    .drawBehind {
                        val y = size.height - 0.5.dp.toPx()
                        drawLine(HcColors.Black, Offset(0f, y), Offset(size.width, y), strokeWidth = 1.dp.toPx())
                    },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                HcText(selectionLabel(selection), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                HcIcon("ChevronDown", Modifier.rotate(if (open) 180f else 0f), size = 16.dp, stroke = 2.5f, color = HcColors.Black)
            }
        }

        if (open) {
            val shape = RoundedCornerShape(HcDimens.RadiusCard)
            Popup(
                alignment = Alignment.TopStart,
                offset = IntOffset(0, with(density) { 44.dp.roundToPx() }),
                onDismissRequest = { open = false },
                properties = PopupProperties(focusable = true),
            ) {
                Column(
                    Modifier
                        .width(with(density) { widthPx.toDp() })
                        .shadow(12.dp, shape)
                        .clip(shape)
                        .background(HcColors.White, shape)
                        .border(1.dp, HcColors.TanDark, shape)
                        .padding(16.dp),
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        StatPeriodKey.entries.forEach { key ->
                            val active = selection is StatPeriodSelection.Preset && selection.key == key
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 36.dp)
                                    .clip(shape)
                                    .statsSelected(active)
                                    .clickable {
                                        onChange(StatPeriodSelection.Preset(key))
                                        open = false
                                    }
                                    .padding(horizontal = 12.dp),
                                contentAlignment = Alignment.CenterStart,
                            ) {
                                HcText(key.label, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                            }
                        }
                    }
                    VSpace(8.dp)
                    HcDivider()
                    VSpace(8.dp)
                    HcText(t.t("statPeriodPicker.selectPeriod").uppercase(), HcTypeRoles.Small, Modifier.padding(bottom = 8.dp), bold = true, color = HcColors.TextSecondary)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatsDateField(customFrom, { customFrom = it }, Modifier.weight(1f))
                        HcText(t.t("statPeriodPicker.to"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                        StatsDateField(customTo, { customTo = it }, Modifier.weight(1f))
                    }
                    VSpace(8.dp)
                    HcButton(t.t("statPeriodPicker.usePeriod"), onClick = ::applyCustomRange)
                }
            }
        }
    }
}
