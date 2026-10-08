package dk.packroff.hellocal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon

// Components used by the settings screens (src/components/hf/AccordionCard.tsx,
// src/components/knowledge/SearchField.tsx, src/components/icons/PaymentCard.tsx
// and the .hf-page layout from globals.css).

/** .hf-page (+ --sections / --list): 16 px top, gutter sides, 32 px bottom. */
val SettingsPagePadding = PaddingValues(start = HcDimens.Gutter, end = HcDimens.Gutter, top = HcDimens.SpaceBlock, bottom = HcDimens.SpaceSection)

/** The stacked column inside a .hf-page; `gap` = block (16), section (32) or inline (8). */
@Composable
fun SettingsPage(gap: Dp = HcDimens.SpaceBlock, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(gap), content = content)
}

/** src/components/hf/AccordionCard.tsx — tan card holding ChevronRows. */
@Composable
fun SettingsAccordionCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape), content = content)
}

/**
 * ChevronRow from AccordionCard.tsx — 48 px row: 20 px icon, label, optional
 * green unread badge, chevron; tan-dark divider below unless `divider = false`.
 */
@Composable
fun SettingsChevronRow(
    label: String,
    onClick: () -> Unit,
    icon: String? = null,
    divider: Boolean = true,
    badgeCount: Int? = null,
    iconContent: (@Composable () -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().height(48.dp).clickable(onClick = onClick).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                when {
                    iconContent != null -> iconContent()
                    icon != null -> HcIcon(icon, size = 20.dp, color = HcColors.Black)
                }
            }
            HcText(label, HcTypeRoles.Body, Modifier.weight(1f), maxLines = 1)
            if (badgeCount != null && badgeCount > 0) {
                Box(
                    Modifier.heightIn(min = 20.dp).widthIn(min = 20.dp).clip(CircleShape).background(HcColors.Brand).padding(horizontal = 4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    HcText(if (badgeCount > 99) "99+" else badgeCount.toString(), HcTypeRoles.Caption, color = HcColors.White, align = TextAlign.Center)
                }
            }
            HcChevron(color = HcColors.Black)
        }
        if (divider) HorizontalDivider(thickness = 1.dp, color = HcColors.TanDark)
    }
}

/** "hf-type-small hf-type-strong text-text-secondary uppercase" group label above a card. */
@Composable
fun SettingsGroupLabel(text: String, modifier: Modifier = Modifier) {
    HcText(text.uppercase(), HcTypeRoles.Small, modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary, bold = true)
}

/** src/components/knowledge/SearchField.tsx — rounded tan search pill. */
@Composable
fun SettingsSearchField(value: String, onChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(HcColors.Tan).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HcIcon("Search", size = 18.dp, color = HcColors.TextSecondary)
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = HcTypeRoles.Body.style(),
            cursorBrush = SolidColor(HcColors.Action),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Body, color = HcColors.Placeholder)
                    inner()
                }
            },
        )
    }
}

/**
 * src/components/icons/PaymentCard.tsx — card outline with one solid stripe at
 * the bottom (owner's rule 2026-10-02).
 */
@Composable
fun SettingsPaymentCardIcon(size: Dp = 24.dp, color: Color = HcColors.Black, stroke: Float = 2f) {
    Canvas(Modifier.size(size)) {
        val s = this.size.width / 24f
        drawRoundRect(
            color = color,
            topLeft = Offset(2f * s, 5f * s),
            size = Size(20f * s, 14f * s),
            cornerRadius = CornerRadius(2.5f * s, 2.5f * s),
            style = Stroke(width = stroke * s, join = StrokeJoin.Round),
        )
        drawRect(color = color, topLeft = Offset(3f * s, 13f * s), size = Size(18f * s, 3.5f * s))
    }
}

/** A plain list of toggle cards with 16 px between them (.flex-col.gap-4). */
@Composable
fun SettingsToggleList(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
}

/** Card with a tan background used for info boxes (.hf-card). */
@Composable
fun SettingsInfoText(text: String, modifier: Modifier = Modifier) {
    HcText(text, HcTypeRoles.Body, modifier.padding(horizontal = 4.dp), color = HcColors.TextSecondary)
}
