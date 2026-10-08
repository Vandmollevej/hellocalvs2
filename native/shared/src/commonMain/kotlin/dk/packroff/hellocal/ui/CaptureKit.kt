package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.math.roundToInt

// Components used by the capture & logging screens (water, weight, period,
// activity, camera, voice, chat, recipes, family). Each mirrors one web class
// or component so the look stays identical to the web.

/** .hf-card.hf-card--brand — green info card with white small text. */
@Composable
fun CaptureBrandCard(text: String, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(modifier.fillMaxWidth().clip(shape).background(HcColors.Brand, shape).padding(HcDimens.SpaceBlock)) {
        HcText(text, HcTypeRoles.Small, color = HcColors.White)
    }
}

/** .hf-card.hf-card--form — card with 16 px between its children. */
@Composable
fun CaptureFormCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        modifier.fillMaxWidth().clip(shape).background(HcColors.Card, shape).padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceBlock),
        content = content,
    )
}

/** "Saved" line: hf-type-small hf-type-strong text-hf-green, centred. */
@Composable
fun CaptureSuccess(text: String?, modifier: Modifier = Modifier) {
    if (text != null) HcText(text, HcTypeRoles.Small, modifier.fillMaxWidth(), color = HcColors.Green, bold = true, align = TextAlign.Center)
}

/** Error line centred (hf-type-caption text-center). */
@Composable
fun CaptureCenteredError(text: String?, modifier: Modifier = Modifier) {
    if (text != null) HcText(text, HcTypeRoles.Caption, modifier.fillMaxWidth(), color = HcColors.Danger, align = TextAlign.Center)
}

/** src/components/hf/HfSlider.tsx — one-value slider: tan track, green fill, round 18 px knob. */
@Composable
fun CaptureSlider(value: Int, min: Int, max: Int, step: Int = 1, onChange: (Int) -> Unit, modifier: Modifier = Modifier) {
    val currentValue by rememberUpdatedState(value)
    val currentOnChange by rememberUpdatedState(onChange)
    val pct = if (max > min) ((value - min).toFloat() / (max - min)).coerceIn(0f, 1f) else 0f
    fun clamp(next: Float): Int {
        val snapped = ((next - min) / step).roundToInt() * step + min
        return snapped.coerceIn(min, max)
    }
    BoxWithConstraints(modifier.fillMaxWidth().height(28.dp)) {
        val widthPx = constraints.maxWidth.toFloat().coerceAtLeast(1f)
        val trackWidth = maxWidth
        fun update(x: Float) {
            val ratio = (x / widthPx).coerceIn(0f, 1f)
            val next = clamp(min + ratio * (max - min))
            if (next != currentValue) currentOnChange(next)
        }
        Box(
            Modifier.fillMaxWidth().fillMaxHeight()
                .pointerInput(min, max, step, widthPx) { detectTapGestures { update(it.x) } }
                .pointerInput(min, max, step, widthPx) {
                    detectDragGestures(onDragStart = { update(it.x) }) { change, _ -> update(change.position.x) }
                },
            contentAlignment = Alignment.CenterStart,
        ) {
            Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(HcColors.TanDark))
            Box(Modifier.fillMaxWidth(pct).height(4.dp).clip(RoundedCornerShape(2.dp)).background(HcColors.Green))
            Box(
                Modifier.offset(x = trackWidth * pct - 9.dp).size(18.dp).clip(CircleShape).background(HcColors.White)
                    .border(2.dp, HcColors.Green, CircleShape),
            )
        }
    }
}

/** src/components/FoodRow.tsx — 44 px tan thumbnail, title, optional subtitle and right slot. */
@Composable
fun CaptureFoodRow(
    title: String,
    modifier: Modifier = Modifier,
    image: String? = null,
    thumbnail: (@Composable () -> Unit)? = null,
    overline: (@Composable () -> Unit)? = null,
    subtitle: (@Composable () -> Unit)? = null,
    right: (@Composable RowScope.() -> Unit)? = null,
) {
    Row(modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)).background(HcColors.Tan), contentAlignment = Alignment.Center) {
            if (thumbnail != null) thumbnail()
            else if (image != null) HcRemoteImage(image, Modifier.fillMaxWidth().padding(4.dp), contentScale = ContentScale.Fit)
        }
        Column(Modifier.weight(1f)) {
            overline?.invoke()
            HcText(title, HcTypeRoles.Body, color = HcColors.Black, maxLines = 2)
            subtitle?.invoke()
        }
        if (right != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), content = right)
    }
}

/** .hf-control-row rounded-2xl bg-hf-tan px-4 — a 48 px tan row (recent entries). */
@Composable
fun CaptureTanRow(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable RowScope.() -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(shape).background(HcColors.Tan, shape)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

/** .hf-choice — 40 px choice chip; selected = lime with a 2 px dark ring (.hf-selected). */
@Composable
fun CaptureChoice(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    fill: Boolean = false,
    align: TextAlign = TextAlign.Center,
    height: Dp = 40.dp,
) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(
        modifier.let { if (fill) it.fillMaxWidth() else it }.heightIn(min = height).clip(shape)
            .background(if (selected) HcColors.SelectedBg else HcColors.Card, shape)
            .let { if (selected) it.border(2.dp, HcColors.SelectedBorder, shape) else it }
            .alpha(if (enabled) 1f else 0.4f)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp),
        contentAlignment = if (align == TextAlign.Start) Alignment.CenterStart else Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Small, color = if (selected) HcColors.SelectedText else HcColors.Text, bold = true, align = align)
    }
}

/** .hf-search — 48 px white search field with a magnifier. */
@Composable
fun CaptureSearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
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
            textStyle = HcTypeRoles.Input.style(),
            cursorBrush = SolidColor(HcColors.Action),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Input, color = HcColors.Black.copy(alpha = 0.5f))
                    inner()
                }
            },
        )
    }
}

/** src/components/hf/AccordionCard.tsx — tan card holding ChevronRows. */
@Composable
fun CaptureAccordionCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape), content = content)
}

/** ChevronRow from AccordionCard.tsx — 48 px: icon, label, chevron; optional divider. */
@Composable
fun CaptureChevronRow(label: String, onClick: (() -> Unit)?, icon: String? = null, divider: Boolean = true, iconContent: (@Composable () -> Unit)? = null) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().height(48.dp).let { if (onClick != null) it.clickable(onClick = onClick) else it }.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
                if (iconContent != null) iconContent() else if (icon != null) HcIcon(icon, size = 20.dp, color = HcColors.Black)
            }
            HcText(label, HcTypeRoles.Body, Modifier.weight(1f), maxLines = 1)
            HcChevron(color = HcColors.Black)
        }
        if (divider) Box(Modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
    }
}

/**
 * Icons the web draws from a PNG with a CSS mask (src/components/icons/WaterGlass.tsx,
 * BathroomScale.tsx …): the same PNG tinted in [color].
 */
@Composable
fun CaptureMaskIcon(src: String, size: Dp = 24.dp, color: Color = HcColors.Black, modifier: Modifier = Modifier) {
    AsyncImage(
        model = Api.absoluteUrl(src),
        contentDescription = null,
        modifier = modifier.size(size),
        contentScale = ContentScale.Fit,
        colorFilter = ColorFilter.tint(color),
    )
}

/** Field like the web's FIELD class: 48 px, rounded-xl, tan or white background, no border. */
@Composable
fun CaptureFilledField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboardType: KeyboardType = KeyboardType.Text,
    background: Color = HcColors.Tan,
    singleLine: Boolean = true,
    minHeight: Dp = HcDimens.ControlHeight,
) {
    val shape = RoundedCornerShape(12.dp)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = singleLine,
        textStyle = HcTypeRoles.Body.style(HcColors.Black),
        cursorBrush = SolidColor(HcColors.Action),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = modifier.fillMaxWidth().heightIn(min = minHeight).clip(shape).background(background, shape),
        decorationBox = { inner ->
            Box(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Body, color = HcColors.Placeholder)
                inner()
            }
        },
    )
}

/** A tappable value that looks like a field (date/time pickers open a sheet). */
@Composable
fun CaptureValueField(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, background: Color = HcColors.Tan) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier.fillMaxWidth().height(HcDimens.ControlHeight).clip(shape).background(background, shape).clickable(onClick = onClick)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        HcText(text, HcTypeRoles.Body, color = HcColors.Black, maxLines = 1)
    }
}

/** Small round dark pill button (hf-type-small hf-type-strong rounded-full bg-hf-black text-white). */
@Composable
fun CapturePillButton(label: String, onClick: () -> Unit, enabled: Boolean = true, modifier: Modifier = Modifier) {
    Box(
        modifier.clip(RoundedCornerShape(50)).background(HcColors.Black).alpha(if (enabled) 1f else 0.4f)
            .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        HcText(label, HcTypeRoles.Small, color = HcColors.White, bold = true)
    }
}

/** IntegrationIcon.tsx — logo, or a white tile with the first letter. */
@Composable
fun CaptureIntegrationIcon(icon: String?, label: String, size: Dp = 32.dp) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    if (icon != null) {
        HcRemoteImage(icon, Modifier.size(size).clip(shape))
    } else {
        Box(Modifier.size(size).clip(shape).background(HcColors.White), contentAlignment = Alignment.Center) {
            HcText(label.take(1).uppercase(), HcTypeRoles.Body, bold = true, color = HcColors.Black)
        }
    }
}

/** A thin tan-dark line (border-b border-hf-tan-dark). */
@Composable
fun CaptureLine(modifier: Modifier = Modifier, color: Color = HcColors.TanDark) {
    Box(modifier.fillMaxWidth().height(1.dp).background(color))
}
