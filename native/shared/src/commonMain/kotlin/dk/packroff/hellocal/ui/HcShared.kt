package dk.packroff.hellocal.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcDurations
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon

// The one shared version of small web building blocks that several areas had
// copied (each area's copy looked and behaved the same).

/**
 * The user's own PNG artwork (public/icons/…) drawn in one colour — the web
 * draws these with a CSS mask that takes `currentColor` (WaterGlass,
 * BathroomScale, Favorite, PartyPopper, WaistMeasure …). Also takes a "data:" URL.
 */
@Composable
fun HcMaskIcon(src: String, size: Dp = 24.dp, color: Color = HcColors.Black, modifier: Modifier = Modifier) {
    FoodImage(src, modifier.size(size), contentScale = ContentScale.Fit, colorFilter = ColorFilter.tint(color))
}

/** src/lib/initials.ts initialsOf(): "Peter Thomsen" → "PT", "Emma" → "E", nothing → "?". */
fun initialsOf(name: String?): String {
    val parts = (name ?: "").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (parts.isEmpty()) return "?"
    val first = parts.first().take(1)
    val last = if (parts.size > 1) parts.last().take(1) else ""
    return (first + last).uppercase()
}

/** src/components/hf/AccordionCard.tsx — tan card holding chevron rows. */
@Composable
fun HcAccordionCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape), content = content)
}

/**
 * ChevronRow from AccordionCard.tsx — 48 px row: 20 px icon (Tabler [icon] or
 * [iconContent]), label, optional green unread badge, chevron; a tan-dark line
 * below unless [divider] is false. [wrapLabel] lets a long label wrap.
 */
@Composable
fun HcChevronRow(
    label: String,
    onClick: (() -> Unit)?,
    icon: String? = null,
    divider: Boolean = true,
    badgeCount: Int = 0,
    wrapLabel: Boolean = false,
    iconContent: (@Composable () -> Unit)? = null,
    centerText: String? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight)
                .let { if (onClick != null) it.clickable(onClick = onClick) else it }
                .padding(horizontal = 16.dp, vertical = if (wrapLabel) 12.dp else 0.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                if (iconContent != null) iconContent() else if (icon != null) HcIcon(icon, size = 20.dp, color = HcColors.Black)
            }
            HcText(label, HcTypeRoles.Body, if (centerText != null) Modifier else Modifier.weight(1f), maxLines = if (wrapLabel) Int.MAX_VALUE else 1)
            if (centerText != null) HcText(centerText, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Brand, align = TextAlign.Center)
            if (badgeCount > 0) {
                Box(
                    Modifier.heightIn(min = 20.dp).widthIn(min = 20.dp).clip(CircleShape).background(HcColors.Brand).padding(horizontal = 4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    HcText(if (badgeCount > 99) "99+" else badgeCount.toString(), HcTypeRoles.Caption, color = HcColors.White, align = TextAlign.Center)
                }
            }
            HcChevron(color = HcColors.Black)
            trailing?.invoke()
        }
        if (divider) HcLine()
    }
}

/** A 1 px divider line (border-b border-hf-tan-dark by default). */
@Composable
fun HcLine(modifier: Modifier = Modifier, color: Color = HcColors.TanDark) {
    Box(modifier.fillMaxWidth().height(1.dp).background(color))
}

/** .hf-search — 48 px white search field with a 16 px magnifier (design.md §6.5). */
@Composable
fun HcSearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier, onFocus: () -> Unit = {}, trailing: (@Composable () -> Unit)? = null) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(
        modifier.fillMaxWidth().height(HcDimens.ControlHeight).clip(shape).background(HcColors.Surface, shape)
            .border(1.dp, HcColors.Line, shape).padding(horizontal = HcDimens.SpaceBlock),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        HcIcon("Search", size = 16.dp, color = HcColors.Black)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = HcTypeRoles.Input.style(HcColors.Action),
            cursorBrush = SolidColor(HcColors.Action),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.weight(1f).onFocusChanged { if (it.isFocused) onFocus() },
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Input, color = HcColors.Black.copy(alpha = 0.5f), maxLines = 1)
                    inner()
                }
            },
        )
        trailing?.invoke()
    }
}

/** src/components/knowledge/SearchField.tsx — pill-shaped tan search field with an 18 px magnifier. */
@Composable
fun HcPillSearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
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

/**
 * src/components/hf/Skeleton.tsx (.hf-skeleton) — the shimmering placeholder
 * surface: a light band sweeps across every --hf-skeleton-duration.
 */
@Composable
fun HcSkeleton(modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(HcDimens.RadiusCard)) {
    val transition = rememberInfiniteTransition()
    val phase by transition.animateFloat(
        initialValue = 1f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(HcDurations.SkeletonDurationMs, easing = LinearEasing), RepeatMode.Restart),
    )
    Box(
        modifier
            .clip(shape)
            .drawBehind {
                val w = size.width.coerceAtLeast(1f)
                val start = -w + 2f * w * phase
                drawRect(
                    Brush.linearGradient(
                        colors = listOf(HcColors.Skeleton, HcColors.SkeletonHighlight, HcColors.Skeleton),
                        start = Offset(start, 0f),
                        end = Offset(start + w, 0f),
                    ),
                )
            },
    )
}

/**
 * .hf-choice — choice chip: card colour, or lime with a 2 px dark ring when
 * selected (.hf-selected). [height] 40 px (48 with .hf-control), optional
 * [leading] icon, [fill] = full width, [align] Start for left-aligned labels.
 */
@Composable
fun HcChoiceChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    height: Dp = 40.dp,
    fill: Boolean = false,
    align: TextAlign = TextAlign.Center,
    maxLines: Int = 2,
    leading: (@Composable () -> Unit)? = null,
) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(
        modifier.let { if (fill) it.fillMaxWidth() else it }.heightIn(min = height).clip(shape)
            .background(if (selected) HcColors.SelectedBg else HcColors.Card, shape)
            .let { if (selected) it.border(2.dp, HcColors.SelectedBorder, shape) else it }
            .alpha(if (enabled) 1f else 0.4f)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = if (align == TextAlign.Start) Arrangement.spacedBy(6.dp) else Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke()
        HcText(label, HcTypeRoles.Small, bold = true, color = if (selected) HcColors.SelectedText else HcColors.Text, align = align, maxLines = maxLines)
    }
}
