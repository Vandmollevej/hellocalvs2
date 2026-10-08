package dk.packroff.hellocal.screens.food

import androidx.compose.animation.core.Animatable
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
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

// src/components/FooterArc.tsx + src/lib/footer-arc.ts — the small half circle
// over the bottom navigation: tap or push up to fan out the add actions
// ("alle" always in the middle), slide sideways to move it.
// TODO(parity): long-press editing (FooterArcEditor.tsx, Seriøs only) is not
// ported yet; the order is still editable under Indstillinger → Visning → Forside.

private const val ARC_RADIUS = 58f
private const val ARC_REST_HEIGHT = 20f
private const val ARC_PULL_DISTANCE = 70f
private const val ARC_ICON_CIRCLE = 46f
private const val ARC_ICON_RADIUS = ARC_RADIUS + 38 + ARC_ICON_CIRCLE / 2
private const val ARC_ANGLE_STEP_DEG = 32.0
private const val ARC_MAX_USER_ACTIONS = 4
private const val ARC_BULGE_MAX = 18f
private const val ARC_BULGE_SPREAD_DEG = 50.0
private const val ARC_BULGE_SAMPLES = 40
private const val ARC_MOVE_PX = 8f
private const val ARC_DEAD_ZONE = 34f
private const val ARC_HIGHLIGHT_SCALE = 1.35f
private const val ARC_ICON_SIZE = 26f
private const val ARC_OFFSET_X_KEY = "hellocal.frontpage.arcOffsetX"
private val ARC_FAN_HALF_WIDTH = (ARC_ICON_RADIUS * sin(ARC_ANGLE_STEP_DEG * 2 * PI / 180) + ARC_ICON_CIRCLE / 2 + 8).toFloat()

private fun fanAngles(userCount: Int): List<Double> {
    val total = userCount + 1
    return List(total) { (it - (total - 1) / 2.0) * ARC_ANGLE_STEP_DEG }
}

private fun listSlotIndex(userCount: Int) = (userCount + 1) / 2

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

private data class ArcSlot(val key: String, val href: String, val label: String, val icon: FoodIconSpec)

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
        val fanCx = if (width > ARC_FAN_HALF_WIDTH * 2) baseCx.coerceIn(ARC_FAN_HALF_WIDTH, width - ARC_FAN_HALF_WIDTH) else width / 2
        fun centerAt(p: Float) = baseCx + (fanCx - baseCx) * p
        val p = progress.value
        val cx = centerAt(p)
        val visibleHeight = ARC_REST_HEIGHT + (ARC_RADIUS - ARC_REST_HEIGHT) * p

        fun slotCenter(index: Int, pp: Float): Pair<Float, Float> {
            val r = angles[index] * PI / 180
            return (centerAt(pp) + ARC_ICON_RADIUS * sin(r)).toFloat() to (ARC_ICON_RADIUS * cos(r)).toFloat()
        }

        fun updateHighlight(px: Float, upY: Float, pp: Float) {
            val center = centerAt(pp)
            finger = (px - center) to upY
            if (hypot(px - center, upY) < ARC_DEAD_ZONE) {
                highlightedKey = null
                return
            }
            var best = Float.MAX_VALUE
            var nearest: String? = null
            slots.forEachIndexed { index, slot ->
                val (sx, sy) = slotCenter(index, pp)
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
        val plusSize = 11 + p * 9
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
                        val wasOpen = open
                        gesturing = true
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            val dx = (change.position.x - startX) / density
                            val dy = (change.position.y - startY) / density
                            val px = boxLeft + change.position.x / density
                            val upY = height - (boxTop + change.position.y / density)
                            if (!change.pressed) {
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
                                            setOpenState(mode == ArcMode.Pull && progress.value > 0.5f)
                                        }
                                    }
                                }
                                break
                            }
                            if (!moved) {
                                if (hypot(dx, dy) <= ARC_MOVE_PX) continue
                                moved = true
                                mode = if (wasOpen) ArcMode.Select else if (abs(dx) > abs(dy) && dy > -ARC_MOVE_PX * 2) ArcMode.Slide else ArcMode.Pull
                            }
                            change.consume()
                            when (mode) {
                                ArcMode.Slide -> dragX = (startOffset + dx).coerceIn(-maxOffset, maxOffset)
                                ArcMode.Pull -> {
                                    val pp = (-dy / ARC_PULL_DISTANCE).coerceIn(0f, 1f)
                                    scope.launch { progress.snapTo(pp) }
                                    if (pp > 0.3f) updateHighlight(px, upY, pp) else {
                                        highlightedKey = null
                                        finger = null
                                    }
                                }
                                ArcMode.Select -> updateHighlight(px, upY, 1f)
                                ArcMode.Undecided -> Unit
                            }
                        }
                        gesturing = false
                    }
                },
        )

        // The fan.
        slots.forEachIndexed { index, slot ->
            key(slot.key) {
                val (sx, sy) = slotCenter(index, p)
                val highlighted = highlightedKey == slot.key
                val scale = (0.4f + 0.6f * p) * if (highlighted) ARC_HIGHLIGHT_SCALE else 1f
                Box(
                    Modifier
                        .offset(x = (sx - ARC_ICON_CIRCLE / 2).dp, y = (height - sy - ARC_ICON_CIRCLE / 2).dp)
                        .size(ARC_ICON_CIRCLE.dp)
                        .graphicsLayer {
                            alpha = if (p > 0.02f) p else 0f
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
                    Box(
                        Modifier
                            .offset(x = (sx - 60).dp, y = (height - sy - ARC_ICON_CIRCLE / 2 - 14 - 34).dp)
                            .size(120.dp, 34.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(Modifier.shadow(2.dp, RoundedCornerShape(3.dp)).background(HcColors.Tan, RoundedCornerShape(3.dp)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                            Text(slot.label, style = HcTypeRoles.Body.style(HcColors.Green).copy(fontWeight = FontWeight.Bold, fontSize = 15.sp), maxLines = 1)
                        }
                    }
                }
            }
        }
    }

    LaunchedEffect(Unit) { progress.snapTo(0f) }
}
