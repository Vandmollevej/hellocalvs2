package dk.packroff.hellocal.screens.food

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupPositionProvider
import androidx.compose.ui.window.PopupProperties
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodIcon
import dk.packroff.hellocal.ui.FoodIconSpec
import dk.packroff.hellocal.ui.FoodMaskIcon
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

// src/components/FooterArcEditor.tsx — editing the half circle's buttons
// (hold the finger still on it): a black, only slightly transparent window
// opens on top. Same grip as in the footer: drag a button down into the panel
// to remove it, tap (or drag up) a button in the panel to put it in the
// circle, and drag a button over another to swap places. "Alle" stays fixed
// in the middle. Only 1/2 circle is shown.

private const val EDITOR_MOVE_PX = 8f

private enum class ArcEditorSource { Active, Pool }

private data class ArcEditorDrag(
    val key: String,
    val source: ArcEditorSource,
    val start: Offset,
    val pos: Offset,
    val moved: Boolean,
    val overPanel: Boolean,
)

/** The web's refs (slotRefs, panelRef, userKeysRef) — read from the pointer handlers, not observed. */
private class ArcEditorRefs {
    var lastDown = Offset.Zero
    var userKeys: List<String> = emptyList()
    val slotBounds = HashMap<String, Rect>()
    var panelBounds: Rect? = null
}

/** createPortal(…, document.body) + "fixed inset-0": the overlay covers the whole window. */
private object ArcEditorWindowPosition : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset = IntOffset.Zero
}

/** Glyph: the Tabler icon, or the image (white = filter brightness(0) invert(1)). */
@Composable
private fun ArcEditorGlyph(spec: FoodIconSpec, white: Boolean) {
    when {
        white && spec is FoodIconSpec.Picture -> FoodMaskIcon(spec.src, ARC_ICON_SIZE.dp, HcColors.White)
        white && spec is FoodIconSpec.Mask -> FoodMaskIcon(spec.src, ARC_ICON_SIZE.dp, HcColors.White)
        else -> FoodIcon(spec, ARC_ICON_SIZE.dp, if (white) HcColors.White else HcColors.Black)
    }
}

/** border border-dashed (rounded; [corner] null = a circle). */
private fun Modifier.arcEditorDashedBorder(color: Color, width: Dp, corner: Dp?): Modifier = drawBehind {
    val w = width.toPx()
    val r = corner?.toPx() ?: (size.minDimension / 2)
    drawRoundRect(
        color,
        topLeft = Offset(w / 2, w / 2),
        size = Size(size.width - w, size.height - w),
        cornerRadius = CornerRadius(r, r),
        style = Stroke(width = w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3 * w, 3 * w))),
    )
}

/** The panel's "border border-b-0 rounded-t-2xl" (solid tan-dark, or dashed gray-dark while a button is over it). */
private fun Modifier.arcEditorPanelBorder(color: Color, dashed: Boolean, radius: Dp): Modifier = drawBehind {
    val w = 1.dp.toPx()
    val half = w / 2
    val r = radius.toPx()
    val d = 2 * (r - half)
    val path = Path().apply {
        moveTo(half, size.height)
        lineTo(half, r)
        arcTo(Rect(half, half, half + d, half + d), 180f, 90f, false)
        lineTo(size.width - r, half)
        arcTo(Rect(size.width - half - d, half, size.width - half, half + d), 270f, 90f, false)
        lineTo(size.width - half, size.height)
    }
    drawPath(
        path,
        color,
        style = Stroke(width = w, pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(3 * w, 3 * w)) else null),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun HomeFooterArcEditor(
    userSlots: List<ArcSlot>,
    listSlot: ArcSlot,
    poolKeys: List<String>,
    sex: String?,
    onChange: (List<String>) -> Unit,
    onClose: () -> Unit,
) {
    val t = LocalTranslator.current
    val density = LocalDensity.current.density
    val userKeys = userSlots.map { it.key }
    val refs = remember { ArcEditorRefs().also { it.userKeys = userKeys } }
    SideEffect { refs.userKeys = userKeys }
    val latestOnChange by rememberUpdatedState(onChange)
    var drag by remember { mutableStateOf<ArcEditorDrag?>(null) }
    var panelHeight by remember { mutableStateOf(180f) }

    // hf-nav-panel-in: 180 ms ease-out, from 12 px lower and transparent.
    val panelIn = remember { Animatable(0f) }
    LaunchedEffect(Unit) { panelIn.animateTo(1f, tween(180, easing = CubicBezierEasing(0f, 0f, 0.58f, 1f))) }
    // hf-nav-jiggle: ±1.4° every 0.16 s, ease-in-out.
    val jiggle by rememberInfiniteTransition(label = "arcEditorJiggle").animateFloat(
        initialValue = -1.4f,
        targetValue = 1.4f,
        animationSpec = infiniteRepeatable(tween(80, easing = CubicBezierEasing(0.42f, 0f, 0.58f, 1f)), RepeatMode.Reverse),
        label = "arcEditorJiggle",
    )

    val mid = listSlotIndex(userSlots.size)
    val fanSlots = userSlots.take(mid) + listSlot + userSlots.drop(mid)
    val angles = fanAngles(userSlots.size)

    fun change(keys: List<String>) {
        refs.userKeys = keys
        latestOnChange(keys)
    }

    fun overPanel(p: Offset): Boolean = refs.panelBounds?.contains(p) == true

    // Nearest place in the fan (not "alle") under the finger, else null: (key, fan index).
    fun nearestUserSlot(p: Offset, maxDistance: Float): Pair<String, Int>? {
        val keys = refs.userKeys
        val m = listSlotIndex(keys.size)
        val fanKeys: List<String?> = keys.take(m) + listOf<String?>(null) + keys.drop(m)
        var best: Pair<String, Int>? = null
        var bestDistance = Float.MAX_VALUE
        fanKeys.forEachIndexed { index, key ->
            if (key == null) return@forEachIndexed
            val bounds = refs.slotBounds[key] ?: return@forEachIndexed
            val distance = (p - bounds.center).getDistance()
            if (distance <= maxDistance && distance < bestDistance) {
                best = key to index
                bestDistance = distance
            }
        }
        return best
    }

    fun addAt(key: String, p: Offset?) {
        val current = refs.userKeys
        if (key in current || current.size >= ARC_MAX_USER_ACTIONS) return
        var position = current.size
        if (p != null) {
            val near = nearestUserSlot(p, Float.MAX_VALUE)
            val m = listSlotIndex(current.size)
            if (near != null) position = if (near.second > m) near.second - 1 else near.second
        }
        val next = current.toMutableList()
        next.add(min(position, next.size), key)
        change(next)
    }

    fun begin(key: String, source: ArcEditorSource) {
        drag = ArcEditorDrag(key, source, refs.lastDown, refs.lastDown, moved = false, overPanel = false)
    }

    fun onMove(p: Offset) {
        val current = drag ?: return
        val moved = current.moved || (p - current.start).getDistance() > EDITOR_MOVE_PX * density
        drag = current.copy(pos = p, moved = moved, overPanel = overPanel(p))
        if (moved && current.source == ArcEditorSource.Active) {
            val near = nearestUserSlot(p, ARC_ICON_CIRCLE * 0.7f * density)
            if (near != null && near.first != current.key) {
                val keys = refs.userKeys.toMutableList()
                val from = keys.indexOf(current.key)
                val to = keys.indexOf(near.first)
                if (from != -1 && to != -1) {
                    keys.removeAt(from)
                    keys.add(to, current.key)
                    change(keys)
                }
            }
        }
    }

    fun onUp(p: Offset) {
        val current = drag ?: return
        drag = null
        if (current.source == ArcEditorSource.Active) {
            if (current.moved && overPanel(p)) change(refs.userKeys.filter { it != current.key })
            return
        }
        if (!current.moved) addAt(current.key, null)
        else if (!overPanel(p)) addAt(current.key, p)
    }

    val currentDrag = drag
    val dragKey = if (currentDrag != null && currentDrag.moved) currentDrag.key else null
    val overPanelNow = currentDrag != null && currentDrag.moved && currentDrag.source == ArcEditorSource.Active && currentDrag.overPanel

    Popup(
        popupPositionProvider = ArcEditorWindowPosition,
        onDismissRequest = onClose,
        properties = PopupProperties(focusable = true),
    ) {
        BoxWithConstraints(
            Modifier
                .fillMaxSize()
                // window pointermove/pointerup while a button is being dragged.
                .pointerInput(Unit) {
                    awaitPointerEventScope {
                        while (true) {
                            val event = awaitPointerEvent(PointerEventPass.Initial)
                            val change = event.changes.firstOrNull() ?: continue
                            if (event.type == PointerEventType.Press) {
                                refs.lastDown = change.position
                                continue
                            }
                            if (drag == null) continue
                            if (change.pressed) onMove(change.position) else onUp(change.position)
                        }
                    }
                },
        ) {
            val w = maxWidth
            val h = maxHeight
            val centerX = w / 2
            val anchorY = h - (panelHeight + 36).dp

            // bg-hf-black/80; a tap closes.
            Box(
                Modifier
                    .fillMaxSize()
                    .background(HcColors.Black.copy(alpha = 0.8f))
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onClose() },
            )

            // The half circle with the buttons, above the panel.
            Canvas(
                Modifier
                    .offset(x = centerX - ARC_RADIUS.dp, y = anchorY - ARC_RADIUS.dp)
                    .size((ARC_RADIUS * 2).dp, ARC_RADIUS.dp),
            ) {
                drawArc(
                    HcColors.Green,
                    startAngle = 180f,
                    sweepAngle = 180f,
                    useCenter = true,
                    topLeft = Offset.Zero,
                    size = Size(size.width, size.width),
                )
            }
            fanSlots.forEachIndexed { index, slot ->
                key(slot.key) {
                    DisposableEffect(slot.key) { onDispose { refs.slotBounds.remove(slot.key) } }
                    val rad = angles[index] * PI / 180
                    val x = (ARC_ICON_RADIUS * sin(rad)).toFloat()
                    val y = (ARC_ICON_RADIUS * cos(rad)).toFloat()
                    val isList = slot.key == "list"
                    val placeholder = dragKey == slot.key
                    val jiggling = !isList && !placeholder
                    val removeLabel = t.t("footerArc.removeItem", "item" to slot.label)
                    Box(
                        Modifier
                            .offset(x = centerX + x.dp - 29.dp, y = anchorY - y.dp - 29.dp)
                            .size(58.dp)
                            .graphicsLayer { rotationZ = if (jiggling) jiggle else 0f },
                    ) {
                        Box(
                            Modifier
                                .align(Alignment.Center)
                                .size(ARC_ICON_CIRCLE.dp)
                                .onGloballyPositioned { refs.slotBounds[slot.key] = it.boundsInRoot() }
                                .semantics { contentDescription = slot.label }
                                .clip(CircleShape)
                                .then(
                                    if (placeholder) Modifier.arcEditorDashedBorder(HcColors.GrayDark, 1.dp, null)
                                    else Modifier.background(HcColors.Tan),
                                )
                                .let { m ->
                                    if (isList) m
                                    else m.pointerInput(slot.key) {
                                        awaitEachGesture {
                                            awaitFirstDown()
                                            begin(slot.key, ArcEditorSource.Active)
                                        }
                                    }
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            if (!placeholder) ArcEditorGlyph(slot.icon, white = false)
                        }
                        if (!isList && !placeholder) {
                            Box(
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .size(20.dp)
                                    .clip(CircleShape)
                                    .background(HcColors.Black)
                                    .semantics { contentDescription = removeLabel }
                                    .pointerInput(slot.key) {
                                        awaitEachGesture {
                                            val down = awaitFirstDown()
                                            down.consume()
                                            val up = waitForUpOrCancellation()
                                            if (up != null) {
                                                up.consume()
                                                change(refs.userKeys.filter { it != slot.key })
                                            }
                                        }
                                    },
                                contentAlignment = Alignment.Center,
                            ) { HcIcon("X", size = 13.dp, color = HcColors.Tan, stroke = 2.2f) }
                        }
                    }
                }
            }

            // The panel with the buttons that are not in the circle.
            val panelShape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
            Column(
                Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .onGloballyPositioned {
                        panelHeight = it.size.height / density
                        refs.panelBounds = it.boundsInRoot()
                    }
                    .graphicsLayer {
                        alpha = panelIn.value
                        translationY = (1f - panelIn.value) * 12.dp.toPx()
                    }
                    .clip(panelShape)
                    .background(HcColors.Card, panelShape)
                    .arcEditorPanelBorder(if (overPanelNow) HcColors.GrayDark else HcColors.TanDark, overPanelNow, 16.dp)
                    // The panel is not part of the scrim: taps on it do not close the window.
                    .pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } }
                    .navigationBarsPadding()
                    .padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 24.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HcText(t.t("footerArc.editHint"), HcTypeRoles.Small, Modifier.weight(1f), color = HcColors.Action, bold = true)
                    HcText(t.t("footerArc.done"), HcTypeRoles.Small, Modifier.clickable { onClose() }, color = HcColors.Brand, bold = true)
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    poolKeys.forEach { poolKey ->
                        val action = AddActions.byKey(poolKey, sex)
                        if (action != null) {
                            val label = t.t(action.labelKey)
                            val addLabel = t.t("footerArc.addItem", "item" to label)
                            val placeholder = dragKey == poolKey
                            val shape = RoundedCornerShape(12.dp)
                            Box(
                                Modifier
                                    .height(64.dp)
                                    .widthIn(min = 64.dp)
                                    .clip(shape)
                                    .then(
                                        if (placeholder) Modifier.arcEditorDashedBorder(HcColors.GrayDark, 1.dp, 12.dp)
                                        else Modifier.background(HcColors.TanDark, shape).border(1.dp, HcColors.TanDark, shape),
                                    )
                                    .semantics { contentDescription = addLabel }
                                    .pointerInput(poolKey) {
                                        awaitEachGesture {
                                            awaitFirstDown()
                                            begin(poolKey, ArcEditorSource.Pool)
                                        }
                                    }
                                    .padding(horizontal = 4.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Column(
                                    Modifier.alpha(if (placeholder) 0f else 1f),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    ArcEditorGlyph(action.icon, white = false)
                                    HcText(label, HcTypeRoles.Micro, color = HcColors.Action, align = TextAlign.Center, maxLines = 1)
                                }
                            }
                        }
                    }
                    if (poolKeys.isEmpty()) {
                        HcText(t.t("footerArc.allInUse"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    }
                }
            }

            // The button under the finger while dragging.
            if (currentDrag != null && currentDrag.moved) {
                val spec = fanSlots.firstOrNull { it.key == currentDrag.key }?.icon
                    ?: if (currentDrag.source == ArcEditorSource.Pool) AddActions.byKey(currentDrag.key, sex)?.icon else null
                if (spec != null) {
                    Column(
                        Modifier
                            .offset(x = (currentDrag.pos.x / density - 32).dp, y = (currentDrag.pos.y / density - 32).dp)
                            .width(64.dp)
                            .alpha(0.9f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) { ArcEditorGlyph(spec, white = true) }
                }
            }
        }
    }
}
