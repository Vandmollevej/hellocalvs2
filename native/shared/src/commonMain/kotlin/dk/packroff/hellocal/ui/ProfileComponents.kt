package dk.packroff.hellocal.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.math.roundToInt

// Components the profile screens need (src/app/profile/**) that have no Hc
// counterpart yet. Each mirrors one web component or CSS class.

/** .hf-page: 16 px top/sides, 32 px bottom (use as HcScreen contentPadding). */
val ProfilePagePadding = PaddingValues(start = HcDimens.Gutter, top = HcDimens.SpaceBlock, end = HcDimens.Gutter, bottom = HcDimens.SpaceSection)

/** .hf-page content: a column with 16 px (or [gap]) between the blocks. */
@Composable
fun ProfilePage(gap: Dp = HcDimens.SpaceBlock, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(gap), content = content)
}

/** src/components/hf/AccordionCard.tsx — the shared HcAccordionCard. */
@Composable
fun ProfileAccordionCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) =
    HcAccordionCard(modifier, content)

/** ChevronRow from AccordionCard.tsx — the shared HcChevronRow with a drawn icon. */
@Composable
fun ProfileChevronRow(
    label: String,
    onClick: () -> Unit,
    icon: @Composable () -> Unit,
    divider: Boolean = true,
    badgeCount: Int = 0,
    wrapLabel: Boolean = false,
) = HcChevronRow(label, onClick, divider = divider, badgeCount = badgeCount, wrapLabel = wrapLabel, iconContent = icon)

/** src/components/hf/HfProgressStepper.tsx — dot per step, lines between, label under each dot. */
@Composable
fun ProfileProgressStepper(steps: List<String>, current: Int, progress: Float, modifier: Modifier = Modifier) {
    val last = steps.size - 1
    val fraction = progress.coerceIn(0f, 1f)
    Column(modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            steps.forEachIndexed { index, _ ->
                Box(Modifier.size(8.dp).clip(CircleShape).background(if (index <= current) HcColors.ProgressDark else HcColors.Inactive))
                if (index < last) {
                    val fill = when {
                        index < current -> 1f
                        index == current -> fraction
                        else -> 0f
                    }
                    Box(Modifier.weight(1f).height(3.dp).clip(RoundedCornerShape(50)).background(HcColors.Inactive)) {
                        if (fill > 0f) Box(Modifier.fillMaxHeight().fillMaxWidth(fill).clip(RoundedCornerShape(50)).background(HcColors.Progress))
                    }
                }
            }
        }
        Layout(
            content = {
                steps.forEachIndexed { index, step ->
                    HcText(step, if (index == current) HcTypeRoles.ProgressActive else HcTypeRoles.ProgressInactive, maxLines = 1)
                }
            },
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
        ) { measurables, constraints ->
            val placeables = measurables.map { it.measure(constraints.copy(minWidth = 0)) }
            val width = constraints.maxWidth
            val height = placeables.maxOfOrNull { it.height } ?: 0
            layout(width, height) {
                placeables.forEachIndexed { index, placeable ->
                    val x = when (index) {
                        0 -> 0
                        last -> width - placeable.width
                        else -> (width * index / last) - placeable.width / 2
                    }
                    placeable.place(x, 0)
                }
            }
        }
    }
}

enum class ProfileCircleTone { Appbar, Card, Brand }

/** "Peter Thomsen" → "PT" (src/lib/initials.ts). */
fun profileInitials(name: String?): String = initialsOf(name)

/** src/components/family/ProfileCircle.tsx — circle with the initials. */
@Composable
fun ProfileCircle(name: String?, size: Dp = 32.dp, tone: ProfileCircleTone = ProfileCircleTone.Appbar, outlined: Boolean = false) {
    val (bg, fg) = when (tone) {
        ProfileCircleTone.Brand -> HcColors.Green to HcColors.White
        ProfileCircleTone.Card -> HcColors.Cream to HcColors.Black
        ProfileCircleTone.Appbar -> HcColors.Tan to HcColors.Black
    }
    Box(
        Modifier.size(size)
            // .hf-avatar--outlined: a 1 px ring for light backgrounds (the front page).
            .let { if (outlined) it.border(1.dp, HcColors.TanDark, CircleShape) else it }
            .clip(CircleShape).background(bg)
            .let { if (tone == ProfileCircleTone.Card) it.border(1.dp, HcColors.GrayBorder, CircleShape) else it },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            profileInitials(name),
            style = HcTypeRoles.Body.style(fg).copy(fontSize = (size.value * 0.375f).roundToInt().sp, fontWeight = FontWeight.Bold, lineHeight = (size.value * 0.375f).roundToInt().sp),
        )
    }
}

/** Uppercase field caption: hf-type-small hf-type-strong text-text-secondary uppercase. */
@Composable
fun ProfileFieldLabel(text: String, modifier: Modifier = Modifier) {
    HcText(text.uppercase(), HcTypeRoles.Small, modifier, color = HcColors.TextSecondary, bold = true)
}

/**
 * Filled input (hf-field rounded-xl bg-hf-tan): 48 px, no border. [onCommit]
 * runs when the field loses focus or the keyboard's Done is pressed — the
 * web's onBlur.
 */
@Composable
fun ProfileFilledField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    enabled: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    suffix: String? = null,
    onCommit: (() -> Unit)? = null,
    role: HcTypeRole = HcTypeRoles.Body,
    background: Color = HcColors.Tan,
    borderColor: Color? = null,
    shape: RoundedCornerShape = RoundedCornerShape(12.dp),
    singleLine: Boolean = true,
    minHeight: Dp = HcDimens.ControlHeight,
    textAlign: TextAlign = TextAlign.Start,
) {
    val focusManager = LocalFocusManager.current
    var wasFocused by remember { mutableStateOf(false) }
    Row(
        modifier
            .heightIn(min = minHeight)
            .clip(shape)
            .background(background, shape)
            .let { if (borderColor != null) it.border(1.dp, borderColor, shape) else it }
            .alpha(if (enabled) 1f else 0.6f)
            .padding(horizontal = if (borderColor != null) 12.dp else 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = singleLine,
            textStyle = role.style(HcColors.Black).copy(textAlign = textAlign),
            cursorBrush = SolidColor(HcColors.Action),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = if (singleLine) ImeAction.Done else ImeAction.Default),
            keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
            modifier = Modifier.weight(1f).padding(vertical = 12.dp).onFocusChanged { state ->
                if (wasFocused && !state.isFocused) onCommit?.invoke()
                wasFocused = state.isFocused
            },
            decorationBox = { inner ->
                Box(contentAlignment = if (textAlign == TextAlign.End) Alignment.CenterEnd else Alignment.CenterStart) {
                    if (value.isEmpty() && placeholder.isNotEmpty()) {
                        HcText(placeholder, role, color = HcColors.Placeholder, maxLines = 1, align = textAlign)
                    }
                    inner()
                }
            },
        )
        if (suffix != null) HcText(suffix, HcTypeRoles.Body, color = HcColors.Black)
    }
}

/** A field-looking button (hf-field rounded-xl bg-hf-tan) that opens a picker or a page. */
@Composable
fun ProfileValueButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    dimmed: Boolean = false,
    leading: (@Composable () -> Unit)? = null,
) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier.fillMaxWidth().height(HcDimens.ControlHeight).clip(shape).background(HcColors.Tan, shape)
            .clickable(onClick = onClick).alpha(if (dimmed) 0.6f else 1f).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        leading?.invoke()
        HcText(text, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black, maxLines = 1)
    }
}

/** .hf-choice.hf-control — selectable chip (lime + dark ring when pressed). */
@Composable
fun ProfileChoiceChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) =
    HcChoiceChip(label, selected, onClick, modifier, enabled, height = HcDimens.ControlHeight)

/** .hf-card.hf-card--brand with one small white text. */
@Composable
fun ProfileBrandCard(text: String, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(modifier.fillMaxWidth().clip(shape).background(HcColors.Brand, shape).padding(HcDimens.SpaceBlock)) {
        HcText(text, HcTypeRoles.Small, color = HcColors.White)
    }
}

/** hf-control-row rounded-2xl bg-hf-tan: a tappable 48 px row on the tan colour. */
@Composable
fun ProfileTanRow(onClick: (() -> Unit)?, modifier: Modifier = Modifier, background: Color = HcColors.Tan, content: @Composable RowScope.() -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).clip(shape).background(background, shape)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

/** .hf-btn-text — 15 px bold underlined text button. */
@Composable
fun ProfileTextButton(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, color: Color = HcColors.Action, enabled: Boolean = true) {
    Box(modifier.heightIn(min = 44.dp).alpha(if (enabled) 1f else 0.5f).clickable(enabled = enabled, onClick = onClick), contentAlignment = Alignment.CenterStart) {
        HcText(label, HcTypeRoles.Body, bold = true, underline = true, color = color)
    }
}

/** Multi-line text area (textarea.hf-type-input with a field border on the page colour). */
@Composable
fun ProfileTextArea(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    minLines: Int = 3,
    maxLength: Int? = null,
    radius: Dp = 2.dp,
) {
    val shape = RoundedCornerShape(radius)
    BasicTextField(
        value = value,
        onValueChange = { next -> onValueChange(if (maxLength != null) next.take(maxLength) else next) },
        minLines = minLines,
        textStyle = HcTypeRoles.Input.style(),
        cursorBrush = SolidColor(HcColors.Action),
        modifier = modifier.fillMaxWidth().background(HcColors.Cream, shape).border(1.dp, HcColors.FieldBorder, shape),
        decorationBox = { inner ->
            Box(Modifier.padding(12.dp)) {
                if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Input, color = HcColors.Placeholder)
                inner()
            }
        },
    )
}

/**
 * src/components/hf/PointsPromoBanner.tsx — green card with a close X and
 * "*headline", plus the small "* Læs betingelser" link under it.
 */
@Composable
fun ProfilePointsPromoBanner(headline: String, onTermsClick: () -> Unit, subtext: String? = null, linkLabel: String = "Læs betingelser") {
    var dismissed by remember { mutableStateOf(false) }
    if (dismissed) return
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        val shape = RoundedCornerShape(HcDimens.RadiusCard)
        Box(Modifier.fillMaxWidth().clip(shape).background(HcColors.Brand, shape)) {
            Column(Modifier.fillMaxWidth().padding(16.dp).padding(end = 32.dp)) {
                HcText("*$headline", HcTypeRoles.Body, color = HcColors.White)
                if (subtext != null) HcText(subtext, HcTypeRoles.Caption, Modifier.padding(top = 4.dp), color = HcColors.White)
            }
            Box(
                Modifier.align(Alignment.TopEnd).padding(4.dp).size(44.dp).clip(CircleShape).clickable { dismissed = true },
                contentAlignment = Alignment.Center,
            ) { HcIcon("X", size = 20.dp, color = HcColors.White) }
        }
        HcText("* $linkLabel", HcTypeRoles.Caption, Modifier.clickable(onClick = onTermsClick))
    }
}

/** Section divider used on the communication page (border-t border-hf-line). */
@Composable
fun ProfileLine(color: Color = HcColors.Line) = HorizontalDivider(thickness = 1.dp, color = color)

/**
 * Swipe a row to the left to reveal the red "Slet" panel as in SwipeableRow (profile messages).
 * Only horizontal drags are caught; vertical scrolling passes through.
 */
@Composable
fun ProfileSwipeToDelete(label: String, onDelete: () -> Unit, content: @Composable () -> Unit) {
    val density = LocalDensity.current
    val revealPx = with(density) { 80.dp.toPx() }
    var dragX by remember { mutableFloatStateOf(0f) }
    var dragging by remember { mutableStateOf(false) }
    // Follows the finger while dragging, glides to the resting place afterwards (150 ms on the web).
    val animated by animateFloatAsState(dragX, label = "swipe")
    val shown = if (dragging) dragX else animated
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(Modifier.fillMaxWidth().clip(shape)) {
        Box(Modifier.matchParentSize(), contentAlignment = Alignment.CenterEnd) {
            Box(
                Modifier.fillMaxHeight().width(80.dp).background(HcColors.RedDark).clickable(onClick = onDelete),
                contentAlignment = Alignment.Center,
            ) { HcText(label, HcTypeRoles.Small, bold = true, color = HcColors.White) }
        }
        Box(
            Modifier.fillMaxWidth().offset { IntOffset(shown.roundToInt(), 0) }.pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragStart = { dragging = true },
                    onDragEnd = {
                        dragging = false
                        dragX = if (dragX < -revealPx / 2) -revealPx else 0f
                    },
                    onDragCancel = {
                        dragging = false
                        dragX = 0f
                    },
                ) { _, amount -> dragX = (dragX + amount).coerceIn(-revealPx, 0f) }
            },
        ) { content() }
    }
}

/** A white check box in a photo's top-right corner (PhotoSelectBox.tsx); shows the number when checked. */
@Composable
fun ProfilePhotoCheck(checked: Boolean, number: Int?, onToggle: () -> Unit, modifier: Modifier = Modifier) {
    Box(modifier.size(44.dp).clip(CircleShape).clickable(onClick = onToggle), contentAlignment = Alignment.Center) {
        val shape = RoundedCornerShape(6.dp)
        Box(
            Modifier.size(26.dp).clip(shape).background(if (checked) HcColors.White else HcColors.White.copy(alpha = 0.35f), shape).border(2.dp, HcColors.White, shape),
            contentAlignment = Alignment.Center,
        ) {
            if (checked) {
                if (number != null) HcText(number.toString(), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                else HcIcon("Check", size = 16.dp, color = HcColors.Black, stroke = 3f)
            }
        }
    }
}

/** Shared "Indlæser…/fejl" centred line (hf-type-body text-text-secondary p-4 text-center). */
@Composable
fun ProfileCenteredText(text: String, modifier: Modifier = Modifier) {
    HcText(text, HcTypeRoles.Body, modifier.fillMaxWidth().padding(16.dp), color = HcColors.TextSecondary, align = TextAlign.Center)
}

/** Truncating single-line text helper (Material Text with ellipsis). */
@Composable
fun ProfileEllipsisText(text: String, role: HcTypeRole, modifier: Modifier = Modifier, color: Color? = null, bold: Boolean = false) {
    var style = role.style(color)
    if (bold) style = style.copy(fontWeight = FontWeight.Bold)
    Text(text, modifier, style = style, maxLines = 1, overflow = TextOverflow.Ellipsis)
}
