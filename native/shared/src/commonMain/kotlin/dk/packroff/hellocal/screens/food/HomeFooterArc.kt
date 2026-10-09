package dk.packroff.hellocal.screens.food

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.FoodIcon
import dk.packroff.hellocal.ui.FoodIconSpec
import dk.packroff.hellocal.ui.FoodMaskIcon
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

// src/components/FooterArc.tsx + src/lib/footer-arc.ts — the small half circle
// over the bottom navigation: tap or push up to fan out the add actions
// ("alle" always in the middle), slide sideways to move it. Holding the finger
// still for LONG_PRESS_MS (Seriøs only, like the footer's rearranging) opens
// the editor (FooterArcEditor.tsx → HomeFooterArcEditor).

/** Same hold time as the footer (FooterArc.tsx LONG_PRESS_MS). */
private const val ARC_LONG_PRESS_MS = 550L

internal const val ARC_RADIUS = 83f
private const val ARC_REST_HEIGHT = 40f
internal const val ARC_ICON_CIRCLE = 46f
// Same geometry as the left circle (AddButton): icons 78 dp outside the circle (room for the finger), unselected
// ones 8 dp closer, the highlighted one 14 dp further out, angles spread evenly over -75..75.
private const val ARC_BASE_RADIUS = ARC_RADIUS + 78 + ARC_ICON_CIRCLE / 2
internal const val ARC_ICON_RADIUS = ARC_BASE_RADIUS - 8
internal const val ARC_ICON_RADIUS_ACTIVE = ARC_BASE_RADIUS + 14
private const val ARC_MAX_ANGLE_DEG = 75.0
internal const val ARC_MAX_USER_ACTIONS = 4
private const val ARC_BULGE_MAX = 18f
private const val ARC_BULGE_SPREAD_DEG = 50.0
private const val ARC_BULGE_SAMPLES = 40
private const val ARC_MOVE_PX = 8f
private const val ARC_DEAD_ZONE = 34f
private const val ARC_HIGHLIGHT_SCALE = 1.35f
internal const val ARC_ICON_SIZE = 26f
private const val ARC_OFFSET_X_KEY = "hellocal.frontpage.arcOffsetX"
/** Smallest distance from a button's centre to the screen edge. */
private const val ARC_EDGE_MARGIN = ARC_ICON_CIRCLE / 2 + 8

internal fun fanAngles(userCount: Int): List<Double> {
    val total = userCount + 1
    if (total <= 1) return listOf(0.0)
    val step = ARC_MAX_ANGLE_DEG * 2 / (total - 1)
    return List(total) { -ARC_MAX_ANGLE_DEG + it * step }
}

internal fun listSlotIndex(userCount: Int) = (userCount + 1) / 2

/** Largest angle (from vertical) a button may sit at, so it stays clear of the bottom bar. */
private const val FAN_MAX_DEG = ARC_MAX_ANGLE_DEG
/** Smallest angle between two neighbouring buttons when the fan is squeezed. */
private const val FAN_MIN_STEP_DEG = 18.0

/**
 * Button centres (x from the left, y up from the footer edge), like fanLayout in
 * src/lib/footer-arc.ts. When the circle sits far to the side there is no room
 * for the whole fan there: instead of stacking buttons in a column, the fan turns
 * towards the free side (squeezed a little if needed) so it stays on screen. The
 * highlighted button ([highlightedIndex]) steps further out.
 */
internal fun fanLayout(angles: List<Double>, centerX: Float, width: Float, highlightedIndex: Int = -1): List<Pair<Float, Float>> {
    if (angles.isEmpty()) return emptyList()
    fun edge(room: Float) = min(FAN_MAX_DEG, asin(min(1.0, max(0.0, (room / ARC_ICON_RADIUS_ACTIVE).toDouble()))) * 180 / PI)
    val lowest = -edge(centerX - ARC_EDGE_MARGIN)
    val highest = edge(width - ARC_EDGE_MARGIN - centerX)
    val first = angles.first()
    val last = angles.last()
    var placed = angles
    if (width > ARC_EDGE_MARGIN * 2 && (first < lowest || last > highest)) {
        val gaps = angles.size - 1
        val step = if (gaps == 0) 0.0 else max(FAN_MIN_STEP_DEG, min((last - first) / gaps, (highest - lowest) / gaps))
        val start = min(max(first, lowest), highest - step * gaps)
        placed = angles.indices.map { start + step * it }
    }
    return placed.mapIndexed { i, deg ->
        val rad = deg * PI / 180
        val radius = if (i == highlightedIndex) ARC_ICON_RADIUS_ACTIVE else ARC_ICON_RADIUS
        (centerX + radius * sin(rad)).toFloat() to (radius * cos(rad)).toFloat()
    }
}

/** Same as LABEL_BUTTON_SCALE in src/lib/footer-arc.ts. */
private const val LABEL_BUTTON_SCALE = 1.35f
private const val LABEL_GAP = 12f
private const val LABEL_HEIGHT = 34f

/** Estimated width of the name box at the highlighted button (bold 15 + padding). */
internal fun labelWidth(text: String) = (text.length * 9.2f + 24f).roundToInt().toFloat()

private fun boxHitsCircle(left: Float, bottom: Float, w: Float, h: Float, cx: Float, cy: Float, r: Float): Boolean {
    val nx = cx.coerceIn(left, left + w)
    val ny = cy.coerceIn(bottom, bottom + h)
    return hypot(cx - nx, cy - ny) < r
}

/**
 * Where the name box of the highlighted button goes (left/bottom corner, same
 * coordinates as fanLayout), like labelPlacement in src/lib/footer-arc.ts: placed
 * diagonally outward along the ray from the circle through the button so the
 * finger does not cover it; larger distance / vertical placement when that hits a
 * neighbour or the screen edge. It never overlaps a button.
 */
internal fun labelPlacement(centers: List<Pair<Float, Float>>, index: Int, circleX: Float, width: Float, w: Float, h: Float = LABEL_HEIGHT): Pair<Float, Float> {
    val (cx, cy) = centers[index]
    val len = hypot(cx - circleX, cy).let { if (it == 0f) 1f else it }
    val radial = (cx - circleX) / len to cy / len
    val own = ARC_ICON_CIRCLE / 2 * LABEL_BUTTON_SCALE
    val others = centers.filterIndexed { i, _ -> i != index }
    fun fits(left: Float, bottom: Float) =
        left >= 6f && left + w <= width - 6f &&
            !boxHitsCircle(left, bottom, w, h, cx, cy, own + 4) &&
            others.all { !boxHitsCircle(left, bottom, w, h, it.first, it.second, ARC_ICON_CIRCLE / 2 + 4) }
    for (dir in listOf(radial, 0f to 1f)) {
        var extra = 0f
        while (extra <= 120f) {
            val dist = own + LABEL_GAP + extra
            val norm = max(abs(dir.first), abs(dir.second)).let { if (it == 0f) 1f else it }
            val left = cx + dir.first * dist + dir.first / norm * (w / 2) - w / 2
            val bottom = cy + dir.second * dist + dir.second / norm * (h / 2) - h / 2
            val clamped = left.coerceIn(6f, max(6f, width - 6f - w))
            if (fits(clamped, bottom)) return clamped to bottom
            extra += 12f
        }
    }
    return cx.minus(w / 2).coerceIn(6f, max(6f, width - 6f - w)) to (cy + own + LABEL_GAP)
}

/** Points of the circle segment of visible height [height] (flat bottom at y = R + BULGE). */
private fun segmentPoints(height: Float, targetDeg: Double?, amount: Float): List<Pair<Float, Float>> {
    val r = ARC_RADIUS
    val h = min(r, max(0.5f, height))
    val phi = acos(((r - h) / r).toDouble())
    val lineY = ARC_BULGE_MAX + r
    val centerY = lineY + (r - h)
    val points = mutableListOf<Pair<Float, Float>>()
    for (i in 0..ARC_BULGE_SAMPLES) {
        val tt = -phi + (2 * phi * i) / ARC_BULGE_SAMPLES
        var radius = r.toDouble()
        if (targetDeg != null && amount > 0) {
            val diff = abs(tt * 180 / PI - targetDeg)
            val falloff = max(0.0, cos((diff / ARC_BULGE_SPREAD_DEG) * (PI / 2)))
            val pin = max(0.0, 1 - abs(tt) / phi).pow(0.6)
            radius += amount * falloff.pow(2) * pin
        }
        points += (r + radius * sin(tt)).toFloat() to (centerY - radius * cos(tt)).toFloat()
    }
    points += (r + r * sin(phi)).toFloat() to lineY
    points += (r - r * sin(phi)).toFloat() to lineY
    return points
}

internal data class ArcSlot(val key: String, val href: String, val label: String, val icon: FoodIconSpec)

private enum class ArcMode { Undecided, Slide, Pull, Select }

@Composable
fun HomeFooterArc(modifier: Modifier = Modifier, onOpenMenuSheet: () -> Unit) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current.density
    val user = FoodProfile.user
    val allowed = AddActions.visible(user).map { it.key }.toSet()
    val userSlots = FoodPrefs.wheelActionKeys.filter { it in allowed }.take(ARC_MAX_USER_ACTIONS)
        .mapNotNull { AddActions.byKey(it, user?.sex) }
        .map { ArcSlot(it.key, it.href, t.t(it.labelKey), it.icon) }
    val listSlot = ArcSlot("list", "/add/menu", t.t("addButton.list"), FoodIconSpec.Tabler("List"))
    val mid = listSlotIndex(userSlots.size)
    val slots = userSlots.take(mid) + listSlot + userSlots.drop(mid)
    val angles = fanAngles(userSlots.size)

    val progress = remember { Animatable(0f) }
    var open by remember { mutableStateOf(false) }
    var gesturing by remember { mutableStateOf(false) }
    var savedOffsetX by remember { mutableStateOf(FoodPrefs.get(ARC_OFFSET_X_KEY)?.toFloatOrNull() ?: 0f) }
    var dragX by remember { mutableStateOf<Float?>(null) }
    var highlightedKey by remember { mutableStateOf<String?>(null) }
    var finger by remember { mutableStateOf<Pair<Float, Float>?>(null) }
    var editing by remember { mutableStateOf(false) }
    val isSerious = FoodSubscription.isSerious == true
    val liveSerious = rememberUpdatedState(isSerious)

    fun setOpenState(next: Boolean) {
        open = next
        scope.launch { progress.animateTo(if (next) 1f else 0f, tween(200)) }
    }

    fun activate(slot: ArcSlot) {
        if (slot.key == "list") onOpenMenuSheet() else nav.push(slot.href)
    }

    BoxWithConstraints(modifier.fillMaxSize()) {
        val width = maxWidth.value
        val height = maxHeight.value
        val maxOffset = max(0f, width / 2 - ARC_RADIUS - 8)
        val offsetX = (dragX ?: savedOffsetX).coerceIn(-maxOffset, maxOffset)
        val baseCx = width / 2 + offsetX
        // The fan follows the circle; buttons that would leave the screen move further up (fanLayout).
        val layout = fanLayout(angles, baseCx, width)
        val p = progress.value
        val cx = baseCx
        val visibleHeight = ARC_REST_HEIGHT + (ARC_RADIUS - ARC_REST_HEIGHT) * p

        fun slotCenter(index: Int): Pair<Float, Float> = layout[index]
        // The highlighted button steps further out (like the left circle); picking uses the resting spots.
        val highlightedIndex = slots.indexOfFirst { it.key == highlightedKey }
        val drawLayout = if (highlightedIndex >= 0) fanLayout(angles, baseCx, width, highlightedIndex) else layout

        fun updateHighlight(px: Float, upY: Float) {
            val center = baseCx
            finger = (px - center) to upY
            if (hypot(px - center, upY) < ARC_DEAD_ZONE) {
                highlightedKey = null
                return
            }
            var best = Float.MAX_VALUE
            var nearest: String? = null
            slots.forEachIndexed { index, slot ->
                val (sx, sy) = slotCenter(index)
                val d = hypot(px - sx, upY - sy)
                if (d < best) {
                    best = d
                    nearest = slot.key
                }
            }
            highlightedKey = nearest
        }

        // Tap outside closes an open fan.
        if (open && !gesturing) {
            Box(
                Modifier.fillMaxSize().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { setOpenState(false) },
            )
        }

        // The green segment (bulging toward the finger while aiming).
        val bulgeActive = finger != null && p > 0.3f
        val fingerDistance = finger?.let { hypot(it.first, it.second) } ?: 0f
        val bulgeDeg = finger?.let { atan2(it.first.toDouble(), max(1f, it.second).toDouble()) * 180 / PI }
        val bulgeAmount = if (bulgeActive) ARC_BULGE_MAX * min(1f, fingerDistance / (ARC_RADIUS * 1.5f)) else 0f
        Canvas(
            Modifier
                .offset(x = (cx - ARC_RADIUS).dp, y = (height - ARC_RADIUS - ARC_BULGE_MAX).dp)
                .size((ARC_RADIUS * 2).dp, (ARC_RADIUS + ARC_BULGE_MAX).dp),
        ) {
            val s = size.width / (ARC_RADIUS * 2)
            val pts = segmentPoints(visibleHeight, bulgeDeg, bulgeAmount)
            val path = Path().apply {
                pts.forEachIndexed { i, (x, y) -> if (i == 0) moveTo(x * s, y * s) else lineTo(x * s, y * s) }
                close()
            }
            drawPath(path, HcColors.Green)
        }

        // The small plus (follows the finger a little while pulling).
        val plusFollows = finger != null && p > 0.1f
        val plusX = if (plusFollows) cx + (finger!!.first * 0.4f).coerceIn(-ARC_RADIUS * 0.5f, ARC_RADIUS * 0.5f) else cx
        val plusUp = if (plusFollows) max(visibleHeight / 2, min(finger!!.second * 0.5f, visibleHeight * 0.8f)) else visibleHeight / 2
        val plusSize = 33 + p * 27
        Box(
            Modifier
                .offset(x = (plusX - plusSize / 2).dp, y = (height - plusUp - plusSize / 2).dp)
                .size(plusSize.dp)
                .graphicsLayer { rotationZ = if (plusFollows) 0f else p * 45 },
        ) { HcIcon("Plus", size = plusSize.dp, color = HcColors.White, stroke = 2.4f) }

        // The touch area: tap toggles, push up opens and aims, slide sideways moves it.
        val hitHeight = max(44f, visibleHeight)
        val liveCx = rememberUpdatedState(cx)
        val liveOffsetX = rememberUpdatedState(offsetX)
        val liveHit = rememberUpdatedState(hitHeight)
        Box(
            Modifier
                .offset(x = (cx - 60).dp, y = (height - hitHeight).dp)
                .size(120.dp, hitHeight.dp)
                .pointerInput(slots.map { it.key }, width, maxOffset, savedOffsetX) {
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        val startX = down.position.x
                        val startY = down.position.y
                        val startOffset = liveOffsetX.value
                        val boxLeft = liveCx.value - 60
                        val boxTop = height - liveHit.value
                        var mode = ArcMode.Undecided
                        var moved = false
                        // Pulled up: the circle has jumped to full size (no gradual growth).
                        var expanded = false
                        // Set when the long press opened the editor: the rest of the gesture is ignored.
                        var consumed = false
                        val wasOpen = open
                        if (progress.isRunning) scope.launch { progress.stop() }
                        // Holding the finger still as long as in the footer opens the editor (Seriøs only).
                        val longPress = if (liveSerious.value) {
                            scope.launch {
                                delay(ARC_LONG_PRESS_MS)
                                if (!moved) {
                                    consumed = true
                                    highlightedKey = null
                                    finger = null
                                    gesturing = false
                                    editing = true
                                }
                            }
                        } else {
                            null
                        }
                        gesturing = true
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            val dx = (change.position.x - startX) / density
                            val dy = (change.position.y - startY) / density
                            val px = boxLeft + change.position.x / density
                            val upY = height - (boxTop + change.position.y / density)
                            if (consumed) {
                                if (!change.pressed) break
                                continue
                            }
                            if (!change.pressed) {
                                longPress?.cancel()
                                gesturing = false
                                finger = null
                                val key = highlightedKey
                                highlightedKey = null
                                when {
                                    mode == ArcMode.Slide -> {
                                        dragX?.let {
                                            savedOffsetX = it
                                            FoodPrefs.set(ARC_OFFSET_X_KEY, it.toInt().toString())
                                        }
                                        dragX = null
                                    }
                                    !moved -> setOpenState(!wasOpen)
                                    else -> {
                                        val slot = slots.firstOrNull { it.key == key }
                                        if (slot != null) {
                                            setOpenState(false)
                                            activate(slot)
                                        } else {
                                            setOpenState(mode == ArcMode.Pull && expanded)
                                        }
                                    }
                                }
                                break
                            }
                            if (!moved) {
                                if (hypot(dx, dy) <= ARC_MOVE_PX) continue
                                moved = true
                                longPress?.cancel()
                                mode = if (wasOpen) ArcMode.Select else if (abs(dx) > abs(dy) && dy > -ARC_MOVE_PX * 2) ArcMode.Slide else ArcMode.Pull
                            }
                            change.consume()
                            when (mode) {
                                ArcMode.Slide -> dragX = (startOffset + dx).coerceIn(-maxOffset, maxOffset)
                                ArcMode.Pull -> {
                                    // As soon as the finger moves up the circle and buttons jump to
                                    // full size at once (no animation, no gradual growth).
                                    if (!expanded && dy < 0f) {
                                        expanded = true
                                        open = true
                                        scope.launch { progress.snapTo(1f) }
                                    }
                                    if (expanded) updateHighlight(px, upY)
                                }
                                ArcMode.Select -> updateHighlight(px, upY)
                                ArcMode.Undecided -> Unit
                            }
                        }
                        longPress?.cancel()
                        gesturing = false
                        finger = null
                    }
                },
        )

        // The fan.
        slots.forEachIndexed { index, slot ->
            key(slot.key) {
                val (sx, sy) = drawLayout[index]
                val highlighted = highlightedKey == slot.key
                // Like the side circle: the buttons appear at once (short fade/pop), not gradually with the pull.
                val appear by animateFloatAsState(if (p > 0.02f) 1f else 0f, tween(150), label = "arcAppear")
                val scale = (0.4f + 0.6f * appear) * if (highlighted) ARC_HIGHLIGHT_SCALE else 1f
                Box(
                    Modifier
                        .offset(x = (sx - ARC_ICON_CIRCLE / 2).dp, y = (height - sy - ARC_ICON_CIRCLE / 2).dp)
                        .size(ARC_ICON_CIRCLE.dp)
                        .graphicsLayer {
                            alpha = appear
                            scaleX = scale
                            scaleY = scale
                        }
                        .shadow(if (highlighted) 8.dp else 2.dp, CircleShape)
                        .clip(CircleShape)
                        .background(if (highlighted) HcColors.Green else HcColors.Tan)
                        .let { m ->
                            if (open && !gesturing) m.clickable {
                                setOpenState(false)
                                activate(slot)
                            } else m
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    val spec = slot.icon
                    if (spec is FoodIconSpec.Picture && highlighted) FoodMaskIcon(spec.src, ARC_ICON_SIZE.dp, HcColors.White)
                    else FoodIcon(spec, ARC_ICON_SIZE.dp, if (highlighted) HcColors.White else HcColors.Black)
                }
                if (highlighted) {
                    val labelW = labelWidth(slot.label)
                    val (lx, ly) = labelPlacement(drawLayout, index, baseCx, width, labelW)
                    Box(
                        Modifier
                            .offset(x = lx.dp, y = (height - ly - LABEL_HEIGHT).dp)
                            .size(labelW.dp, LABEL_HEIGHT.dp)
                            .shadow(2.dp, RoundedCornerShape(3.dp))
                            .background(HcColors.Tan, RoundedCornerShape(3.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(slot.label, style = HcTypeRoles.Body.style(HcColors.Green).copy(fontWeight = FontWeight.Bold, fontSize = 15.sp), maxLines = 1)
                    }
                }
            }
        }
    }

    if (editing) {
        val keys = FoodPrefs.wheelActionKeys
        HomeFooterArcEditor(
            userSlots = userSlots,
            listSlot = listSlot,
            poolKeys = AddActions.visible(user).map { it.key }.filter { it !in keys },
            sex = user?.sex,
            onChange = { nextUserKeys ->
                val current = FoodPrefs.wheelActionKeys
                val tail = current.drop(ARC_MAX_USER_ACTIONS).filter { it !in nextUserKeys }
                FoodPrefs.saveWheelActionKeys((nextUserKeys + tail).take(FoodPrefs.MAX_WHEEL_ACTIONS))
            },
            onClose = {
                editing = false
                setOpenState(false)
            },
        )
    }

    LaunchedEffect(Unit) { progress.snapTo(0f) }
}
