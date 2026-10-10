package dk.packroff.hellocal.screens.food

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.i18n.Translator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.FoodIcon
import dk.packroff.hellocal.ui.FoodIconSpec
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodMaskIcon
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

// ---------------------------------------------------------------------------
// src/lib/add-actions.ts — every "add something" destination.

data class AddAction(
    val key: String,
    val href: String,
    val icon: FoodIconSpec,
    val labelKey: String,
    val requiresCycleTracking: Boolean = false,
)

object AddActions {
    val all = listOf(
        AddAction("microphone", "/voice", FoodIconSpec.Tabler("Microphone"), "addButton.microphone"),
        AddAction("ownDishes", "/create-dish", FoodIconSpec.Mask("/icons/gryde.png"), "addButton.ownDishes"),
        AddAction("search", "/search", FoodIconSpec.Tabler("Search"), "addButton.search"),
        AddAction("weight", "/weight/create", FoodIconSpec.Mask("/icons/bathroom-scale.png"), "addButton.weight"),
        AddAction("water", "/water/create", FoodIconSpec.Mask("/icons/water-glass.png"), "addButton.water"),
        AddAction("activity", "/activity/create", FoodIconSpec.Tabler("Activity"), "addButton.activity"),
        AddAction("camera", "/camera?mode=product", FoodIconSpec.Tabler("Camera"), "addButton.camera"),
        AddAction("targetWeight", "/profile/goals", FoodIconSpec.Mask("/icons/party-popper.png"), "profile.actions.target"),
        AddAction("bodyMeasurements", "/profile/body-measurements", FoodIconSpec.Mask("/icons/body-measurements/waist-male.png"), "profile.row.bodyMeasurements"),
        AddAction("menstrualCycle", "/period/create", FoodIconSpec.Tabler("CalendarHeart"), "addButton.menstrualCycle", requiresCycleTracking = true),
        AddAction("drinks", "/drinks", FoodIconSpec.Tabler("GlassCocktail"), "addButton.drinks"),
        // Screeninger: opens the fill-in sheet; always last.
        AddAction("screenings", "/profile/screenings?fill=1", FoodIconSpec.Tabler("ClipboardHeart"), "addButton.screenings"),
    )

    /** "Kropsmål" shows the female waist figure for women, the male one otherwise. */
    private fun withProfileIcon(action: AddAction, sex: String?): AddAction =
        if (action.key == "bodyMeasurements" && sex == "FEMALE") action.copy(icon = FoodIconSpec.Mask("/icons/body-measurements/waist-female.png")) else action

    fun byKey(key: String, sex: String?): AddAction? = all.firstOrNull { it.key == key }?.let { withProfileIcon(it, sex) }

    /** visibleAddActions — "menstrualCycle" only for women with cycle tracking on. */
    fun visible(user: FoodProfileUser?): List<AddAction> = all
        .filter { !it.requiresCycleTracking || (user?.sex == "FEMALE" && user.cycleTrackingEnabled) }
        .map { withProfileIcon(it, user?.sex) }
}

// ---------------------------------------------------------------------------
// src/components/AddButton.tsx — the green joystick on the front page.

const val HERO_HEIGHT = 300f
private const val CENTER_Y = HERO_HEIGHT / 2
private const val CIRCLE = 46f
private const val FAB_SIZE = 64f
private const val HALF_CIRCLE_RADIUS = 83f
private const val FAB_INSET = 10f
private const val ARC_GAP = 52f
private const val RADIUS = HALF_CIRCLE_RADIUS + ARC_GAP + CIRCLE / 2
private const val HIGHLIGHT_EXTRA_RADIUS = 14f
private const val ACTIVE_RADIUS = RADIUS + HIGHLIGHT_EXTRA_RADIUS
private const val INACTIVE_RADIUS = RADIUS - 8
private const val HIGHLIGHT_SCALE = 1.35f
private const val LABEL_GAP = 12f
private const val LABEL_OFFSET = CIRCLE / 2 + (CIRCLE * HIGHLIGHT_SCALE) / 2 + LABEL_GAP
private const val ICON_SIZE = 26f
private const val SELECT_DEAD_ZONE = 14f
private const val LIGHT_CIRCLE_SIZE = 40f
private const val FINGERPRINT_SIZE = 52f
private const val FINGERPRINT_TILT_DEG = 35f
private const val FINGERPRINT_EDGE_NUDGE = 15f
private const val LIGHT_CIRCLE_TRAVEL = HALF_CIRCLE_RADIUS - LIGHT_CIRCLE_SIZE / 2 - 6
private const val BULGE_MAX = 20f
private const val BULGE_SPREAD_DEG = 46.0
private const val BULGE_SAMPLE_COUNT = 48
private const val BULGE_POLE_TAPER_DEG = 12.0
private const val DRAG_THRESHOLD = 6f

private fun rad(deg: Double) = deg * PI / 180.0

/** The half-disk backdrop, bulging toward the highlighted option (backdropPath on the web). */
private fun backdropPoints(bulgeAngleDeg: Double?, bulgeAmount: Float): List<Pair<Float, Float>> {
    val points = mutableListOf<Pair<Float, Float>>()
    for (i in 0..BULGE_SAMPLE_COUNT) {
        val angleDeg = -90.0 + (180.0 * i) / BULGE_SAMPLE_COUNT
        val theta = rad(angleDeg)
        val y = HALF_CIRCLE_RADIUS * (1 + sin(theta))
        var x = HALF_CIRCLE_RADIUS * cos(theta)
        if (bulgeAngleDeg != null && bulgeAmount > 0) {
            var diff = abs(angleDeg - bulgeAngleDeg)
            if (diff > 180) diff = 360 - diff
            val falloff = max(0.0, cos((diff / BULGE_SPREAD_DEG) * (PI / 2)))
            val pinFactor = min(1.0, (90 - abs(angleDeg)) / BULGE_POLE_TAPER_DEG)
            x += bulgeAmount * falloff.pow(2) * pinFactor
        }
        points += x.toFloat() to y.toFloat()
    }
    return points
}

/** Angles spread evenly across -75..75 whatever the number of actions. */
fun computeAngles(count: Int): List<Double> {
    if (count <= 1) return listOf(0.0)
    val step = 150.0 / (count - 1)
    return List(count) { -75 + it * step }
}

private data class WheelAction(val key: String, val href: String, val label: String, val icon: FoodIconSpec)

private fun buildActions(t: Translator, selected: List<String>, allowed: Set<String>, sex: String?): List<WheelAction> {
    val list = WheelAction("list", "/add/menu", t.t("addButton.list"), FoodIconSpec.Tabler("List"))
    val chosen = selected.filter { it in allowed }.mapNotNull { AddActions.byKey(it, sex) }
        .map { WheelAction(it.key, it.href, t.t(it.labelKey), it.icon) }
    return listOf(list) + chosen
}

@Composable
fun HomeAddButton(onOpen: () -> Unit, topLimitDp: Float, bottomLimitDp: Float, onOpenMenuSheet: () -> Unit) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val side = FoodPrefs.fabSide
    val left = side == "left"
    val user = FoodProfile.user
    val allowed = AddActions.visible(user).map { it.key }.toSet()
    val actions = buildActions(t, FoodPrefs.wheelActionKeys, allowed, user?.sex)
    val angles = computeAngles(actions.size)
    val density = LocalDensity.current.density

    var open by remember { mutableStateOf(false) }
    var highlightedKey by remember { mutableStateOf<String?>(null) }
    var dragOffset by remember { mutableStateOf<Pair<Float, Float>?>(null) }
    var offsetY by remember { mutableStateOf(FoodPrefs.loadFabOffsetY()) }

    // Vertical extent of everything the circle shows (circleExtent on the web).
    val outer = RADIUS + HIGHLIGHT_EXTRA_RADIUS
    val halfIcon = CIRCLE * 1.35f / 2
    val iconYs = angles.map { CENTER_Y + outer * sin(rad(it)).toFloat() }
    val extentTop = min(CENTER_Y - HALF_CIRCLE_RADIUS, iconYs.minOf { it - halfIcon })
    val extentBottom = max(CENTER_Y + HALF_CIRCLE_RADIUS, iconYs.maxOf { it + halfIcon })
    val minOffset = topLimitDp - extentTop
    val maxOffset = max(minOffset, bottomLimitDp - extentBottom)
    fun clampOffset(v: Float) = v.coerceIn(minOffset, maxOffset)
    LaunchedEffect(minOffset, maxOffset) { offsetY = clampOffset(offsetY) }

    BoxWithConstraints(Modifier.fillMaxSize().offset(y = offsetY.dp)) {
        val width = maxWidth.value

        fun itemCenter(angleDeg: Double): Pair<Float, Float> {
            val reach = INACTIVE_RADIUS * cos(rad(angleDeg)).toFloat()
            val x = if (left) reach else width - reach
            return x to CENTER_Y + INACTIVE_RADIUS * sin(rad(angleDeg)).toFloat()
        }

        val fabLeft = if (left) FAB_INSET else width - FAB_INSET - FAB_SIZE
        val fabTop = CENTER_Y - FAB_SIZE / 2

        fun updateHighlight(px: Float, py: Float) {
            var nearest: String? = null
            var best = Float.MAX_VALUE
            actions.forEachIndexed { i, action ->
                val (x, y) = itemCenter(angles[i])
                val d = hypot(px - x, py - y)
                if (d < best) {
                    best = d
                    nearest = action.key
                }
            }
            val fabCx = fabLeft + FAB_SIZE / 2
            val dx = px - fabCx
            val dy = py - CENTER_Y
            val distance = hypot(dx, dy)
            val clamped = min(distance, LIGHT_CIRCLE_TRAVEL)
            val angle = atan2(dy, dx)
            val offset = cos(angle) * clamped to sin(angle) * clamped
            dragOffset = offset
            val inward = if (left) offset.first else -offset.first
            val touchesEdge = FAB_INSET + FAB_SIZE / 2 + inward - FINGERPRINT_SIZE / 2 <= 0
            highlightedKey = if (distance > SELECT_DEAD_ZONE && !touchesEdge) nearest else null
        }

        fun activate(key: String?) {
            val action = actions.firstOrNull { it.key == key } ?: return
            if (action.key == "list") onOpenMenuSheet() else nav.push(action.href)
        }

        val highlightedIndex = actions.indexOfFirst { it.key == highlightedKey }
        val bulgeAngle = if (highlightedIndex >= 0) angles[highlightedIndex] else null
        val dragDistance = dragOffset?.let { hypot(it.first, it.second) } ?: 0f
        val bulgeAmount = if (highlightedIndex >= 0) min(BULGE_MAX, (dragDistance / LIGHT_CIRCLE_TRAVEL) * BULGE_MAX) else 0f

        // The green half-disk; dragging it moves the whole circle vertically.
        Box(
            Modifier
                .offset(x = if (left) 0.dp else (width - HALF_CIRCLE_RADIUS - BULGE_MAX).dp, y = (CENTER_Y - HALF_CIRCLE_RADIUS).dp)
                .size((HALF_CIRCLE_RADIUS + BULGE_MAX).dp, (HALF_CIRCLE_RADIUS * 2).dp)
                .graphicsLayer { scaleX = if (left) 1f else -1f }
                .pointerInput(minOffset, maxOffset) {
                    detectVerticalDragGestures(
                        onDragEnd = { FoodPrefs.saveFabOffsetY(offsetY) },
                        onDragCancel = { FoodPrefs.saveFabOffsetY(offsetY) },
                    ) { change, dragAmount ->
                        change.consume()
                        offsetY = clampOffset(offsetY + dragAmount / density)
                    }
                },
        ) {
            Canvas(Modifier.fillMaxSize()) {
                val s = size.height / (HALF_CIRCLE_RADIUS * 2)
                val points = backdropPoints(bulgeAngle, bulgeAmount)
                val path = Path().apply {
                    points.forEachIndexed { i, (x, y) -> if (i == 0) moveTo(x * s, y * s) else lineTo(x * s, y * s) }
                    lineTo(0f, HALF_CIRCLE_RADIUS * 2 * s)
                    lineTo(0f, 0f)
                    close()
                }
                drawPath(path, HcColors.Green)
            }
        }

        // The fingerprint "button": tap toggles the fan, press-and-drag aims at an option.
        val fingerprintX by animateFloatAsState(
            (dragOffset?.first ?: 0f) + if (left) -FINGERPRINT_EDGE_NUDGE else FINGERPRINT_EDGE_NUDGE,
            animationSpec = tween(if (dragOffset != null) 0 else 150),
        )
        val fingerprintY by animateFloatAsState(dragOffset?.second ?: 0f, animationSpec = tween(if (dragOffset != null) 0 else 150))
        Box(
            Modifier
                .offset(x = fabLeft.dp, y = fabTop.dp)
                .size(FAB_SIZE.dp)
                .pointerInput(actions.map { it.key }, left, width) {
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        val start = down.position
                        var moved = false
                        val wasOpen = open
                        var selecting = wasOpen
                        highlightedKey = null
                        dragOffset = null
                        while (true) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            val px = fabLeft + change.position.x / density
                            val py = fabTop + change.position.y / density
                            if (!change.pressed) {
                                if (selecting) {
                                    val key = highlightedKey
                                    highlightedKey = null
                                    dragOffset = null
                                    open = false
                                    activate(key)
                                } else if (!moved) {
                                    if (!open) onOpen()
                                    open = !open
                                }
                                break
                            }
                            if (hypot(change.position.x - start.x, change.position.y - start.y) / density > DRAG_THRESHOLD) moved = true
                            if (selecting) {
                                updateHighlight(px, py)
                                change.consume()
                            } else if (moved && !wasOpen && !open) {
                                onOpen()
                                open = true
                                selecting = true
                                updateHighlight(px, py)
                                change.consume()
                            }
                        }
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            FoodImage(
                "/icons/fingerprint.png",
                Modifier
                    .size(FINGERPRINT_SIZE.dp)
                    .graphicsLayer {
                        translationX = fingerprintX * density
                        translationY = fingerprintY * density
                        rotationZ = if (left) FINGERPRINT_TILT_DEG else -FINGERPRINT_TILT_DEG
                        scaleX = if (left) -1f else 1f
                    },
                contentScale = ContentScale.Fit,
                colorFilter = ColorFilter.tint(HcColors.White),
                contentDescription = if (open) t.t("addButton.closeMenu") else t.t("addButton.openMenu"),
            )
        }

        // The fanned-out actions.
        actions.forEachIndexed { i, action ->
            key(action.key) {
            val highlighted = highlightedKey == action.key
            val radius by animateFloatAsState(if (highlighted) ACTIVE_RADIUS else INACTIVE_RADIUS, tween(150))
            val scale by animateFloatAsState(if (!open) 0.4f else if (highlighted) HIGHLIGHT_SCALE else 1f, tween(150))
            val itemAlpha by animateFloatAsState(if (open) 1f else 0f, tween(150))
            val r = rad(angles[i])
            val reach = radius * cos(r).toFloat() - CIRCLE / 2
            val top = CENTER_Y + radius * sin(r).toFloat() - CIRCLE / 2
            val x = if (left) reach else width - reach - CIRCLE
            Box(
                Modifier
                    .offset(x = x.dp, y = top.dp)
                    .size(CIRCLE.dp)
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                        this.alpha = itemAlpha
                    }
                    .shadow(if (highlighted) 8.dp else 2.dp, CircleShape)
                    .clip(CircleShape)
                    .background(if (highlighted) HcColors.Green else HcColors.Tan)
                    // Hidden actions must not catch touches meant for the list below.
                    .let { m ->
                        if (!open) m else m.clickable {
                            open = false
                            activate(action.key)
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                val iconColor = if (highlighted) HcColors.White else HcColors.Black
                val spec = action.icon
                if (spec is FoodIconSpec.Picture && highlighted) FoodMaskIcon(spec.src, ICON_SIZE.dp, HcColors.White)
                else FoodIcon(spec, ICON_SIZE.dp, iconColor)
            }
            if (open && highlighted) {
                // Green label beside the highlighted icon, toward the screen middle.
                val labelInset = LABEL_OFFSET + reach
                Box(
                    Modifier
                        .align(if (left) Alignment.TopStart else Alignment.TopEnd)
                        .offset(x = (if (left) labelInset else -labelInset).dp, y = (top + CIRCLE / 2 - 17).dp)
                        .shadow(2.dp, RoundedCornerShape(3.dp))
                        .background(HcColors.Tan, RoundedCornerShape(3.dp))
                        .padding(horizontal = 10.dp, vertical = 7.dp)
                        .alpha(1f),
                ) {
                    Text(action.label, style = HcTypeRoles.Body.style(HcColors.Green).copy(fontWeight = FontWeight.Bold, fontSize = 15.sp), maxLines = 1)
                }
            }
            }
        }
    }
}
