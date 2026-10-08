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
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcDurations
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.toLocalDateTime

// Small building blocks the statistics module (screens/statistics) needs and
// that have no Hc counterpart yet. Each mirrors one web class/component.

/**
 * A (dashed) outline drawn on top of the content, like the web's
 * `border-[1.5px] border-dashed` in edit mode. `dashed = false` draws a solid line.
 */
fun Modifier.statsOutline(
    color: Color,
    width: Dp = 1.5.dp,
    radius: Dp = HcDimens.RadiusCard,
    dashed: Boolean = true,
): Modifier = this.drawWithContent {
    drawContent()
    val stroke = width.toPx()
    val inset = stroke / 2f
    drawRoundRect(
        color = color,
        topLeft = Offset(inset, inset),
        size = Size(size.width - stroke, size.height - stroke),
        cornerRadius = CornerRadius(radius.toPx(), radius.toPx()),
        style = Stroke(
            width = stroke,
            pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(3f * stroke, 2f * stroke), 0f) else null,
        ),
    )
}

/** `.hf-selected` / `.hf-selected-open[aria-expanded=true]`: accent fill with a 2 px inset black frame. */
fun Modifier.statsSelected(selected: Boolean, radius: Dp = HcDimens.RadiusCard): Modifier =
    if (!selected) this else this
        .background(HcColors.SelectedBg, RoundedCornerShape(radius))
        .statsOutline(HcColors.SelectedBorder, width = 2.dp, radius = radius, dashed = false)

/** `.hf-choice` — filter/period/segment button; selected = accent fill + black frame (aria-pressed). */
@Composable
fun StatsChoiceChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leading: (@Composable () -> Unit)? = null,
) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(
        modifier
            .heightIn(min = 40.dp)
            .clip(shape)
            .background(if (selected) HcColors.SelectedBg else HcColors.Card, shape)
            .let { if (selected) it.statsOutline(HcColors.SelectedBorder, width = 2.dp, dashed = false) else it }
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke()
        HcText(label, HcTypeRoles.Small, bold = true, color = if (selected) HcColors.SelectedText else HcColors.Text, align = TextAlign.Center)
    }
}

/** A coloured dot in front of a chart legend entry (`inline-block size-2 rounded-full`). */
@Composable
fun StatsLegendDot(color: Color) {
    Box(Modifier.size(8.dp).background(color, CircleShape))
}

/** src/components/hf/Skeleton.tsx — a shimmering placeholder surface (design.md §6.14). */
@Composable
fun StatsSkeleton(modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(HcDimens.RadiusCard)) {
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
 * src/components/hf/AccordionSection.tsx — tan header row (accent + frame
 * while open) over a cream body. Several may be open at once.
 */
@Composable
fun StatsAccordionSection(
    title: String,
    count: Int? = null,
    defaultOpen: Boolean = false,
    bodyPadding: PaddingValues = PaddingValues(12.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    var open by remember { mutableStateOf(defaultOpen) }
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = HcDimens.ControlHeight)
                .statsSelected(open)
                .clickable { open = !open }
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            HcText(title, HcTypeRoles.Body, Modifier.weight(1f), bold = true)
            if (count != null) HcText(count.toString(), HcTypeRoles.Small, color = HcColors.TextSecondary)
            HcChevron(if (open) ChevronDirection.Down else ChevronDirection.Right)
        }
        if (open) {
            Column(Modifier.fillMaxWidth().background(HcColors.Cream).padding(bodyPadding), content = content)
        }
    }
}

/** src/components/hf/DropdownSection.tsx — collapsible row with an optional detail text. */
@Composable
fun StatsDropdownSection(
    title: String,
    detail: String? = null,
    defaultOpen: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    var open by remember { mutableStateOf(defaultOpen) }
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = HcDimens.ControlHeight)
                .clickable { open = !open }
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            HcText(title, HcTypeRoles.Body, Modifier.weight(1f), bold = true, color = HcColors.Black, maxLines = 1)
            if (detail != null) HcText(detail, HcTypeRoles.Small, color = HcColors.Black, maxLines = 1)
            HcChevron(if (open) ChevronDirection.Down else ChevronDirection.Right, color = HcColors.Black)
        }
        if (open) {
            Column(Modifier.fillMaxWidth().background(HcColors.Cream).padding(16.dp), content = content)
        }
    }
}

/** `.hf-search` — 48 px search field with a 16 px magnifier. */
@Composable
fun StatsSearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(
        modifier
            .fillMaxWidth()
            .height(HcDimens.ControlHeight)
            .clip(shape)
            .background(HcColors.Surface, shape)
            .border(1.dp, HcColors.Line, shape)
            .padding(horizontal = HcDimens.SpaceBlock),
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
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Input, color = HcColors.Black.copy(alpha = 0.5f), maxLines = 1)
                    inner()
                }
            },
        )
    }
}

/**
 * src/components/ui/RemoveCircleButton.tsx — the black remove circle shown on
 * items while a layout is edited. The caller positions it (top-right corner).
 */
@Composable
fun StatsRemoveCircle(onRemove: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(30.dp)
            .clip(CircleShape)
            .clickable(onClick = onRemove),
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(20.dp).background(HcColors.Black, CircleShape), contentAlignment = Alignment.Center) {
            HcIcon("X", size = 13.dp, stroke = 2.2f, color = HcColors.Tan)
        }
    }
}

/**
 * src/components/ui/UncertaintyTilde.tsx — the green uncertainty "~" in front
 * of an estimated value: ~2.4 × the text size (2.6 × when [small]), bold,
 * without growing the line.
 */
@Composable
fun StatsUncertaintyTilde(textSize: Float, small: Boolean = false) {
    val factor = if (small) 2.6f else 2.4f
    Box(Modifier.height(textSize.dp).padding(end = 4.dp), contentAlignment = Alignment.Center) {
        androidx.compose.material3.Text(
            "~",
            modifier = Modifier.wrapContentHeight(unbounded = true),
            style = androidx.compose.ui.text.TextStyle(
                fontSize = (textSize * factor).sp,
                lineHeight = textSize.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                color = HcColors.Green,
            ),
        )
    }
}

/** `.hf-bottom-sheet__dots` — page dots in a bottom sheet. */
@Composable
fun StatsSheetDots(count: Int, active: Int, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(count) { index ->
            Box(Modifier.size(8.dp).background(if (index == active) HcColors.Brand else HcColors.Gray, CircleShape))
        }
    }
}

private val STATS_SHORT_MONTHS = listOf("jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec.")

/** "8. okt. 2026" — how the web's <input type="date"> shows a date in Danish. */
fun statsFieldDate(date: LocalDate): String = "${date.dayOfMonth}. ${STATS_SHORT_MONTHS[date.monthNumber - 1]} ${date.year}"

/**
 * The web's `<input type="date">`: shows the chosen date in a field
 * (rounded, tan border, cream fill) and opens the platform-neutral Material
 * date picker on tap.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsDateField(value: LocalDate, onValueChange: (LocalDate) -> Unit, modifier: Modifier = Modifier, confirmLabel: String = "OK") {
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(
        modifier
            .heightIn(min = HcDimens.ControlHeight)
            .clip(shape)
            .background(HcColors.Cream, shape)
            .border(1.dp, HcColors.TanDark, shape)
            .clickable { open = true }
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        HcText(statsFieldDate(value), HcTypeRoles.Body, maxLines = 1)
    }
    if (open) {
        val state = rememberDatePickerState(initialSelectedDateMillis = value.atStartOfDayIn(TimeZone.UTC).toEpochMilliseconds())
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                Box(
                    Modifier.heightIn(min = 44.dp).clickable {
                        state.selectedDateMillis?.let { millis ->
                            onValueChange(Instant.fromEpochMilliseconds(millis).toLocalDateTime(TimeZone.UTC).date)
                        }
                        open = false
                    }.padding(horizontal = 16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    HcText(confirmLabel, HcTypeRoles.Button)
                }
            },
        ) {
            DatePicker(state = state)
        }
    }
}
