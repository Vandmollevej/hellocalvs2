package dk.packroff.hellocal.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import coil3.compose.AsyncImage
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcDurations
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.math.roundToInt

// Components the food/registration screens share (src/components/FoodRow.tsx,
// ProductResultRow.tsx, SwipeableRow.tsx, hf/HfSlider.tsx, hf/MacroSliderBar.tsx,
// hf/Skeleton.tsx, hf/EntryDetailsSheet.tsx, family/ProfileCircle.tsx …).

/**
 * An image from the server, a full URL or a "data:" URL (photos the user just
 * took are kept as data URLs, exactly like the web).
 */
@OptIn(ExperimentalEncodingApi::class)
@Composable
fun FoodImage(
    src: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
    colorFilter: ColorFilter? = null,
    contentDescription: String? = null,
) {
    val model: Any? = remember(src) {
        when {
            src.isNullOrBlank() -> null
            src.startsWith("data:") -> runCatching { Base64.Default.decode(src.substringAfter(",")) }.getOrNull()
            else -> Api.absoluteUrl(src)
        }
    }
    if (model == null) return
    AsyncImage(model = model, contentDescription = contentDescription, modifier = modifier, contentScale = contentScale, colorFilter = colorFilter)
}

/**
 * The user's own PNG artwork used as a colour mask (CSS `mask` on the web):
 * public/icons/favorite.png, gryde.png, bathroom-scale.png … tinted like a
 * Tabler icon.
 */
@Composable
fun FoodMaskIcon(src: String, size: Dp = 24.dp, color: Color = HcColors.Action, modifier: Modifier = Modifier) {
    FoodImage(src, modifier.size(size), contentScale = ContentScale.Fit, colorFilter = ColorFilter.tint(color))
}

/** src/components/icons/Favorite.tsx — bookmark outline / filled. */
@Composable
fun FoodFavoriteIcon(filled: Boolean, size: Dp = 24.dp, color: Color = HcColors.Action) {
    FoodMaskIcon(if (filled) "/icons/favorite-filled.png" else "/icons/favorite.png", size, color)
}

/** src/components/icons/Drumstick.tsx — two-coloured chicken leg (meat + white bone). */
@Composable
fun FoodDrumstickIcon(size: Dp = 24.dp) {
    Canvas(Modifier.size(size)) {
        val s = this.size.width / 24f
        fun p(x: Float, y: Float) = Offset(x * s, y * s)
        // Bone outline in meat colour, then the white bone on top.
        drawLine(HcColors.Meat, p(14f, 10f), p(19f, 5f), strokeWidth = 5.4f * s, cap = androidx.compose.ui.graphics.StrokeCap.Round)
        drawCircle(HcColors.Meat, radius = 3.1f * s, center = p(18.9f, 3.1f))
        drawCircle(HcColors.Meat, radius = 3.1f * s, center = p(20.9f, 5.1f))
        drawLine(HcColors.White, p(14f, 10f), p(19f, 5f), strokeWidth = 3.2f * s, cap = androidx.compose.ui.graphics.StrokeCap.Round)
        drawCircle(HcColors.White, radius = 1.9f * s, center = p(18.9f, 3.1f))
        drawCircle(HcColors.White, radius = 1.9f * s, center = p(20.9f, 5.1f))
        val meat = androidx.compose.ui.graphics.Path().apply {
            moveTo(14.6f * s, 9.4f * s)
            cubicTo(16.8f * s, 12.3f * s, 14.9f * s, 17.8f * s, 10.7f * s, 20.4f * s)
            cubicTo(6.2f * s, 23.2f * s, 1.4f * s, 19.6f * s, 2.3f * s, 14.4f * s)
            cubicTo(3.2f * s, 9.2f * s, 10f * s, 6.6f * s, 14.6f * s, 9.4f * s)
            close()
        }
        drawPath(meat, HcColors.Meat)
    }
}

/**
 * One icon of the add actions / stat rows: a Tabler name, a PNG mask, a full
 * colour image or the drumstick.
 */
sealed interface FoodIconSpec {
    data class Tabler(val name: String) : FoodIconSpec
    data class Mask(val src: String) : FoodIconSpec
    data class Picture(val src: String) : FoodIconSpec
    data object Drumstick : FoodIconSpec
}

@Composable
fun FoodIcon(spec: FoodIconSpec, size: Dp = 24.dp, color: Color = HcColors.Action, stroke: Float = 2f) {
    when (spec) {
        is FoodIconSpec.Tabler -> HcIcon(spec.name, size = size, color = color, stroke = stroke)
        is FoodIconSpec.Mask -> FoodMaskIcon(spec.src, size, color)
        is FoodIconSpec.Picture -> FoodImage(spec.src, Modifier.size(size))
        FoodIconSpec.Drumstick -> FoodDrumstickIcon(size)
    }
}

/** src/components/FoodRow.tsx — 44 px tan thumbnail, optional overline, title, subtitle, right slot. */
@Composable
fun FoodRow(
    title: String,
    modifier: Modifier = Modifier,
    image: String? = null,
    thumbnail: (@Composable () -> Unit)? = null,
    overline: (@Composable () -> Unit)? = null,
    subtitle: (@Composable () -> Unit)? = null,
    right: (@Composable RowScope.() -> Unit)? = null,
) {
    Row(modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)).background(HcColors.Tan),
            contentAlignment = Alignment.Center,
        ) {
            if (thumbnail != null) thumbnail()
            else if (!image.isNullOrBlank()) FoodImage(image, Modifier.size(44.dp).padding(4.dp))
        }
        Column(Modifier.weight(1f)) {
            overline?.invoke()
            HcText(title, HcTypeRoles.Body, color = HcColors.Black, maxLines = 2)
            subtitle?.invoke()
        }
        if (right != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), content = right)
    }
}

/** A product as in the search list (src/components/ProductResultRow.tsx). */
data class FoodProductResult(
    val id: String,
    val title: String,
    val image: String? = null,
    val brand: String? = null,
    val kcal: Double? = null,
    val macrosEstimated: Boolean = false,
)

/** The green uncertainty "~" (src/components/ui/UncertaintyTilde.tsx). */
@Composable
fun FoodUncertaintyTilde(small: Boolean = false) {
    Text(
        "~",
        style = HcTypeRoles.Body.style(HcColors.Green).copy(fontWeight = FontWeight.Bold, fontSize = if (small) 26.sp else 24.sp, lineHeight = 14.sp),
        modifier = Modifier.padding(end = 4.dp),
    )
}

/** src/components/ProductResultRow.tsx — the whole row opens the product; bookmark toggles favourite. */
@Composable
fun FoodProductResultRow(
    result: FoodProductResult,
    kcalText: String?,
    isFavorite: Boolean,
    favoriteLabel: String,
    onOpen: (String) -> Unit,
    onToggleFavorite: (String, Boolean) -> Unit,
    divider: Boolean,
) {
    Column(Modifier.fillMaxWidth().clickable { onOpen(result.id) }) {
        FoodRow(
            title = result.title,
            image = result.image,
            modifier = Modifier.padding(horizontal = 16.dp),
            subtitle = if (kcalText != null) {
                {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (!result.brand.isNullOrBlank()) HcText("${result.brand} · ", HcTypeRoles.Small, color = HcColors.TextSecondary, maxLines = 1)
                        if (result.macrosEstimated) FoodUncertaintyTilde()
                        HcText(kcalText, HcTypeRoles.Small, color = HcColors.TextSecondary, maxLines = 1)
                    }
                }
            } else null,
            right = {
                Box(
                    Modifier.padding(end = 8.dp).size(32.dp).clip(CircleShape).clickable { onToggleFavorite(result.id, !isFavorite) },
                    contentAlignment = Alignment.Center,
                ) { FoodFavoriteIcon(isFavorite, 20.dp, HcColors.Green) }
            },
        )
        if (divider) FoodDivider()
    }
}

/** 1 px border-hf-tan-dark divider between list rows. */
@Composable
fun FoodDivider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(HcColors.TanDark))
}

/** Tan list card (overflow-hidden bg-hf-tan rounded-card). */
@Composable
fun FoodListCard(modifier: Modifier = Modifier, radius: Dp = HcDimens.RadiusCard, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(radius)).background(HcColors.Tan), content = content)
}

/** .hf-search — 48 px search field with the magnifier (design.md §6.5). */
@Composable
fun FoodSearchField(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Row(
        modifier.fillMaxWidth().height(HcDimens.ControlHeight).clip(shape).background(HcColors.Surface, shape).border(1.dp, HcColors.Line, shape)
            .padding(horizontal = HcDimens.SpaceBlock),
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

/** Pill input on tan (Opret ret's name field and similar). */
@Composable
fun FoodPillField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    background: Color = HcColors.Tan,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    minHeight: Dp = HcDimens.ControlHeight,
    shape: Shape = RoundedCornerShape(50),
    textAlign: TextAlign? = null,
    bold: Boolean = false,
) {
    var style = HcTypeRoles.Body.style(HcColors.Black)
    if (textAlign != null) style = style.copy(textAlign = textAlign)
    if (bold) style = style.copy(fontWeight = FontWeight.Bold)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = singleLine,
        textStyle = style,
        cursorBrush = SolidColor(HcColors.Action),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = modifier.heightIn(min = minHeight).clip(shape).background(background, shape),
        decorationBox = { inner ->
            Box(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), contentAlignment = if (textAlign == TextAlign.Center) Alignment.Center else Alignment.CenterStart) {
                if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Body, color = HcColors.Placeholder, align = textAlign)
                inner()
            }
        },
    )
}

/** Multi-line field (textarea .hf-type-input border-hf-field-border). */
@Composable
fun FoodTextArea(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    label: String? = null,
    minLines: Int = 3,
    background: Color = HcColors.Cream,
    border: Boolean = true,
    radius: Dp = HcDimens.RadiusCard,
) {
    val shape = RoundedCornerShape(radius)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (label != null) HcText(label, HcTypeRoles.Label)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = false,
            minLines = minLines,
            textStyle = HcTypeRoles.Input.style(HcColors.Black),
            cursorBrush = SolidColor(HcColors.Action),
            modifier = Modifier.fillMaxWidth().clip(shape).background(background, shape)
                .let { if (border) it.border(1.dp, HcColors.FieldBorder, shape) else it },
            decorationBox = { inner ->
                Box(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
                    if (value.isEmpty()) HcText(placeholder, HcTypeRoles.Input, color = HcColors.Placeholder)
                    inner()
                }
            },
        )
    }
}

/** src/components/hf/Skeleton.tsx — a pulsing skeleton surface (design.md §6.14). */
@Composable
fun FoodSkeleton(modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(6.dp)) {
    val transition = rememberInfiniteTransition()
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(HcDurations.SkeletonDurationMs, easing = LinearEasing), RepeatMode.Reverse),
    )
    Box(modifier.clip(shape).background(lerp(HcColors.Skeleton, HcColors.SkeletonHighlight, phase)))
}

/** SkeletonMediaRows — rows with a 44 px tile and two text lines. */
@Composable
fun FoodSkeletonMediaRows(rows: Int, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth()) {
        repeat(rows) {
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FoodSkeleton(Modifier.size(44.dp), RoundedCornerShape(8.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    FoodSkeleton(Modifier.fillMaxWidth(0.7f).height(14.dp))
                    FoodSkeleton(Modifier.fillMaxWidth(0.4f).height(12.dp))
                }
            }
        }
    }
}

/** SkeletonCards — tan cards of a fixed height. */
@Composable
fun FoodSkeletonCards(count: Int, height: Dp, radius: Dp = HcDimens.RadiusCard) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(count) { FoodSkeleton(Modifier.fillMaxWidth().height(height), RoundedCornerShape(radius)) }
    }
}

/** src/components/hf/HfSlider.tsx — the one slider design: 4 px track, green fill, 18 px knob. */
@Composable
fun FoodSlider(
    value: Double,
    min: Double,
    max: Double,
    onChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
    step: Double = 1.0,
    enabled: Boolean = true,
) {
    fun clamp(next: Double): Double {
        val stepped = kotlin.math.round((next - min) / step) * step + min
        return stepped.coerceIn(min, max)
    }
    val fraction = if (max > min) ((value - min) / (max - min)).coerceIn(0.0, 1.0).toFloat() else 0f
    BoxWithConstraints(modifier.fillMaxWidth().height(20.dp)) {
        val widthPx = constraints.maxWidth.toFloat().coerceAtLeast(1f)
        val trackWidth = maxWidth
        val track = Modifier.fillMaxWidth().height(20.dp).let { base ->
            if (!enabled) base else base
                .pointerInput(min, max, step) {
                    detectTapGestures { offset -> onChange(clamp(min + (offset.x / widthPx).coerceIn(0f, 1f) * (max - min))) }
                }
                .pointerInput(min, max, step) {
                    androidx.compose.foundation.gestures.detectDragGestures { change: androidx.compose.ui.input.pointer.PointerInputChange, _: androidx.compose.ui.geometry.Offset ->
                        change.consume()
                        onChange(clamp(min + (change.position.x / widthPx).coerceIn(0f, 1f) * (max - min)))
                    }
                }
        }
        Box(track, contentAlignment = Alignment.CenterStart) {
            Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(HcColors.TanDark))
            Box(Modifier.fillMaxWidth(fraction).height(4.dp).clip(RoundedCornerShape(2.dp)).background(HcColors.Green))
            Box(
                Modifier.offset(x = trackWidth * fraction - 9.dp).size(18.dp).clip(CircleShape).background(HcColors.White).border(2.dp, HcColors.Green, CircleShape),
            )
        }
    }
}

/**
 * src/components/hf/MacroSliderBar.tsx — label, value (tap to type), slider.
 * Disabled = read-only display.
 */
@Composable
fun FoodMacroSliderBar(label: String, grams: Double, max: Double, onChange: (Double) -> Unit, disabled: Boolean = false) {
    var editing by remember { mutableStateOf(false) }
    var editValue by remember { mutableStateOf("") }
    val gramsText = "${formatNumber(grams, 1)} g"
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            HcText(label, HcTypeRoles.Small, Modifier.weight(1f), color = HcColors.TextSecondary)
            when {
                disabled -> HcText(gramsText, HcTypeRoles.Body, Modifier.widthIn(min = 36.dp), color = HcColors.Black, bold = true, align = TextAlign.End)
                editing -> Row(
                    Modifier.clip(RoundedCornerShape(4.dp)).background(HcColors.White).padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    BasicTextField(
                        value = editValue,
                        onValueChange = { editValue = it },
                        singleLine = true,
                        textStyle = HcTypeRoles.Body.style(HcColors.Black).copy(fontWeight = FontWeight.Bold, textAlign = TextAlign.End),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = {
                            editValue.replace(",", ".").toDoubleOrNull()?.let { onChange(kotlin.math.max(0.0, it.roundToInt().toDouble())) }
                            editing = false
                        }),
                        modifier = Modifier.width(48.dp),
                    )
                    HcText(" g", HcTypeRoles.Body, color = HcColors.Black, bold = true)
                    HcText(" ✓", HcTypeRoles.Body, Modifier.clickable {
                        editValue.replace(",", ".").toDoubleOrNull()?.let { onChange(kotlin.math.max(0.0, it.roundToInt().toDouble())) }
                        editing = false
                    }, color = HcColors.Green, bold = true)
                }
                else -> HcText(gramsText, HcTypeRoles.Body, Modifier.widthIn(min = 36.dp).clickable {
                    editValue = formatNumber(grams, 1)
                    editing = true
                }, color = HcColors.Black, bold = true, align = TextAlign.End)
            }
        }
        FoodSlider(
            value = grams.coerceAtMost(max),
            min = 0.0,
            max = max,
            onChange = { onChange(it.roundToInt().toDouble()) },
            enabled = !disabled,
        )
    }
}

/** src/components/family/ProfileCircle.tsx — initials in a circle. */
enum class FoodProfileTone { Appbar, Card, Brand }

fun foodInitialsOf(name: String?): String {
    val parts = (name ?: "").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (parts.isEmpty()) return "?"
    val first = parts.first().take(1)
    val last = if (parts.size > 1) parts.last().take(1) else ""
    return (first + last).uppercase()
}

@Composable
fun FoodProfileCircle(name: String, size: Dp = 32.dp, tone: FoodProfileTone = FoodProfileTone.Appbar, outlined: Boolean = false) {
    val (bg, fg) = when (tone) {
        FoodProfileTone.Brand -> HcColors.Green to HcColors.White
        FoodProfileTone.Card -> HcColors.Cream to HcColors.Black
        FoodProfileTone.Appbar -> HcColors.Tan to HcColors.Black
    }
    Box(
        Modifier.size(size)
            .let { if (outlined) it.border(1.dp, HcColors.TanDark, CircleShape) else it }
            .let { if (tone == FoodProfileTone.Card) it.border(1.dp, HcColors.GrayBorder, CircleShape) else it }
            .clip(CircleShape).background(bg),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            foodInitialsOf(name),
            style = HcTypeRoles.Body.style(fg).copy(fontWeight = FontWeight.Bold, fontSize = (size.value * 0.375f).sp, lineHeight = (size.value * 0.375f).sp),
            maxLines = 1,
            overflow = TextOverflow.Clip,
        )
    }
}

/** BottomSheetDots — page dots for slides (active = brand green). */
@Composable
fun FoodSheetDots(count: Int, active: Int, onSelect: ((Int) -> Unit)? = null) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(count) { index ->
            Box(
                Modifier.size(8.dp).clip(CircleShape).background(if (index == active) HcColors.Brand else HcColors.Gray)
                    .let { if (onSelect != null) it.clickable { onSelect(index) } else it },
            )
        }
    }
}

/** .hf-bottom-sheet__skip — text button under the primary button in a sheet. */
@Composable
fun FoodSheetSkipButton(label: String, onClick: () -> Unit, enabled: Boolean = true) {
    Box(
        Modifier.fillMaxWidth().height(HcDimens.ControlHeight).clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { HcText(label, HcTypeRoles.Button, color = HcColors.Text) }
}

/** A row of the tan detail table (label left, bold value right). */
data class FoodDetailRow(val label: String, val value: String)

/**
 * src/components/hf/EntryDetailsSheet.tsx — info sheet for a registration; with
 * onDelete it is a delete warning with a red Slet button.
 */
@Composable
fun FoodEntryDetailsSheet(
    title: String,
    subtitle: String?,
    rows: List<FoodDetailRow>,
    deleteLabel: String,
    cancelLabel: String,
    closeLabel: String,
    deleteWarning: String,
    onDelete: (() -> Unit)?,
    onClose: () -> Unit,
) {
    HcBottomSheet(onDismiss = onClose, title = title) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (subtitle != null) HcText(subtitle, HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            if (rows.isNotEmpty()) {
                FoodListCard {
                    rows.forEachIndexed { index, row ->
                        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                            HcText(row.label, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                            HcText(row.value, HcTypeRoles.Body, color = HcColors.Black, bold = true, align = TextAlign.End)
                        }
                        if (index < rows.lastIndex) FoodDivider()
                    }
                }
            }
            if (onDelete != null) HcText(deleteWarning, HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
            if (onDelete != null) {
                HcButton(deleteLabel, onClick = { onDelete(); onClose() }, kind = HcButtonKind.Danger)
                FoodSheetSkipButton(cancelLabel, onClose)
            } else {
                HcButton(closeLabel, onClick = onClose)
            }
        }
    }
}

/** Small pill button (hf-btn-primary / hf-btn-secondary px-4 py-1.5). */
@Composable
fun FoodPillButton(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Box(
        modifier.clip(shape)
            .background(if (selected) HcColors.Action else Color.Transparent, shape)
            .border(1.5.dp, HcColors.Action, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) { HcText(label, HcTypeRoles.Button, color = if (selected) HcColors.White else HcColors.Action) }
}

/** A tile button: icon over a bold small label on tan (rounded-2xl bg-hf-tan py-3). */
@Composable
fun FoodTileButton(label: String, icon: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier.clip(RoundedCornerShape(16.dp)).background(HcColors.Tan).clickable(onClick = onClick).padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HcIcon(icon, size = 20.dp, color = HcColors.Black)
        HcText(label, HcTypeRoles.Small, color = HcColors.Black, bold = true, align = TextAlign.Center)
    }
}

/** Round white × button used on image tiles and list rows. */
@Composable
fun FoodRemoveButton(onClick: () -> Unit, size: Dp = 28.dp, background: Color = HcColors.White) {
    Box(Modifier.size(size).clip(CircleShape).background(background).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        HcIcon("X", size = (size.value / 2).dp, color = HcColors.Black)
    }
}

/** Toast-like dark notice (DailyList "Kopieret til …"). */
@Composable
fun FoodNotice(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Black).padding(horizontal = 16.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
        HcText(text, HcTypeRoles.Body, color = HcColors.White, align = TextAlign.Center)
    }
}

/** Card with a 2 px brand border (hf-card border-2 border-hf-green). */
@Composable
fun FoodOutlinedCard(modifier: Modifier = Modifier, borderColor: Color = HcColors.Green, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(HcDimens.RadiusCard)
    Column(
        modifier.fillMaxWidth().clip(shape).background(HcColors.Card, shape).border(2.dp, borderColor, shape).padding(HcDimens.SpaceBlock),
        verticalArrangement = Arrangement.spacedBy(HcDimens.SpaceInline),
        content = content,
    )
}

/** Selected chip state (.hf-selected): lime background + 2 px dark inset border. */
fun Modifier.foodSelected(selected: Boolean, shape: Shape, unselected: Color = HcColors.Tan): Modifier =
    if (selected) this.background(HcColors.SelectedBg, shape).border(2.dp, HcColors.SelectedBorder, shape)
    else this.background(unselected, shape)

/** HcBottomSheet whose content scrolls when it is taller than the screen. */
@Composable
fun FoodScrollSheet(onDismiss: () -> Unit, title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    HcBottomSheet(onDismiss = onDismiss, title = title) {
        Column(Modifier.fillMaxWidth().verticalScroll(androidx.compose.foundation.rememberScrollState()), content = content)
    }
}
