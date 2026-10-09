package dk.packroff.hellocal.screens.statistics

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationVector2D
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.round
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

// Edit mode shared by the chart section and the card grid on the statistics
// page (StatChartsSection.tsx / StatCardsGrid.tsx): a long press makes the
// items wobble, a short tap on the background ends it, items are lifted and
// dragged, and the page scrolls by itself near the top/bottom edge.

internal const val ENTER_EDIT_DELAY_MS = 500L
internal const val DRAG_DELAY_MS = 250L
internal const val TAP_TOLERANCE_PX = 10f
internal const val AUTO_SCROLL_EDGE_PX = 72f

/** REFLOW_MS: how long an item takes to slide into its new place. */
internal const val REFLOW_MS = 180

/** REFLOW_EASING: cubic-bezier(0.2, 0, 0, 1). */
internal val REFLOW_EASING = CubicBezierEasing(0.2f, 0f, 0f, 1f)

/** Page-wide state the editable sections share. */
internal class StatsEditController(val scrollState: ScrollState) {
    /** The scroll viewport in root coordinates (for auto-scroll). */
    var viewportTop by mutableFloatStateOf(0f)
    var viewportBottom by mutableFloatStateOf(0f)

    /** Every editable item's bounds in root coordinates ("grid:…", "chart:…"). */
    val itemBounds = HashMap<String, Rect>()

    /** Bumped by a short tap on the background; editing sections then end edit mode. */
    var exitRequests by mutableIntStateOf(0)

    fun isOnItem(position: Offset): Boolean = itemBounds.values.any { it.contains(position) }

    /** Auto-scroll speed in px per frame for a finger at [y] (root), like the web (edge 72, /6). */
    fun autoScrollSpeed(y: Float): Float = when {
        viewportBottom <= viewportTop -> 0f
        y < viewportTop + AUTO_SCROLL_EDGE_PX -> -kotlin.math.ceil((viewportTop + AUTO_SCROLL_EDGE_PX - y) / 6f)
        y > viewportBottom - AUTO_SCROLL_EDGE_PX -> kotlin.math.ceil((y - (viewportBottom - AUTO_SCROLL_EDGE_PX)) / 6f)
        else -> 0f
    }
}

/**
 * FLIP reflow (StatCardsGrid.tsx GridReflow, StatChartsSection.tsx): when the
 * items change order, every item that changes place slides there from where
 * it was drawn instead of jumping — over [REFLOW_MS] with [REFLOW_EASING].
 *
 * Like the web, a slide only starts when the rendered list itself changed
 * ([observe]); other layout changes (a card's value arriving, a growing
 * placeholder) move the items directly, and a running slide keeps going on
 * top of that. Positions are kept per item id relative to [container], so an
 * item whose node is re-created in another row still slides from its old
 * spot, and scrolling never counts as a move.
 */
internal class StatsReflow(private val scope: CoroutineScope) {
    /** The layout all positions are measured in (the grid / the chart column). */
    var container: LayoutCoordinates? = null

    /** Ids drawn right now; an item disposed outside this set is forgotten ([forget]). */
    var liveIds: Set<String> = emptySet()

    private var version = 0
    private var observed: Any? = null
    private val placed = HashMap<String, Offset>()
    private val placedVersion = HashMap<String, Int>()
    private val shifts = HashMap<String, Animatable<Offset, AnimationVector2D>>()
    /** A shift that is about to be snapped to: used until the snap has happened. */
    private val pending = HashMap<String, Offset>()
    private val generation = HashMap<String, Int>()
    /** Where a dropped item starts its glide (container coordinates). */
    private val settles = HashMap<String, Offset>()
    /** Where a finger-following item was drawn last (container coordinates). */
    private val lastDrawn = HashMap<String, Offset>()
    private val sliding = mutableStateMapOf<String, Boolean>()

    /** The dropped item gliding from under the finger: drawn on top, its lift shadow fading. */
    var landingId by mutableStateOf<String?>(null)
        private set

    /** Call with the rendered list after every composition: a new list starts the slides. */
    fun observe(items: Any) {
        if (items != observed) {
            observed = items
            version += 1
        }
    }

    /** True while [id] slides (the web gives sliding items z-index 10). */
    fun isSliding(id: String): Boolean = sliding.containsKey(id)

    /** Draw order for [id]: the landing item on top, then sliding items. */
    fun zIndex(id: String): Float = when {
        landingId == id -> 2f
        isSliding(id) -> 1f
        else -> 0f
    }

    /** A dropped item glides from [topLeft] (container coordinates) into its slot. */
    fun settleFrom(id: String, topLeft: Offset, landing: Boolean = true) {
        settles[id] = topLeft
        if (landing) landingId = id
    }

    /** A dropped item that followed the finger glides from where it was last drawn. */
    fun settleFromLastDrawn(id: String, landing: Boolean = false) {
        val from = lastDrawn.remove(id) ?: return
        settleFrom(id, from, landing)
    }

    /** Drops what is known about an item that is no longer drawn. */
    fun forget(id: String, force: Boolean = false) {
        if (!force && id in liveIds) return
        placed.remove(id)
        placedVersion.remove(id)
        shifts.remove(id)
        pending.remove(id)
        settles.remove(id)
        lastDrawn.remove(id)
        sliding.remove(id)
    }

    /**
     * The item's offset from its layout box, read during placement (so it is
     * re-placed every animation frame and whenever a parent moves).
     * [followRootY] lets the item follow the finger instead (root y of its top).
     */
    fun shift(id: String, coordinates: LayoutCoordinates, jump: Boolean, followRootY: Float?): IntOffset {
        val box = container
        if (box == null || !box.isAttached || !coordinates.isAttached) return IntOffset.Zero
        val position = box.localPositionOf(coordinates, Offset.Zero)
        val anim = shifts.getOrPut(id) { Animatable(Offset.Zero, Offset.VectorConverter) }
        val current = pending[id] ?: anim.value
        val before = placed[id]
        val seenVersion = placedVersion[id]
        placed[id] = position
        placedVersion[id] = version
        if (followRootY != null) {
            if (current != Offset.Zero) start(id, anim, Offset.Zero, animate = false, landing = false)
            val follow = Offset(0f, followRootY - coordinates.positionInRoot().y)
            lastDrawn[id] = position + follow
            return follow.round()
        }
        lastDrawn.remove(id)
        val settle = settles.remove(id)
        val next = when {
            settle != null -> start(id, anim, settle - position, animate = true, landing = true)
            jump -> {
                if (current != Offset.Zero) start(id, anim, Offset.Zero, animate = false, landing = false)
                Offset.Zero
            }
            before == null || seenVersion == version -> current
            (before - position).getDistance() < 1f -> current
            else -> start(id, anim, before + current - position, animate = true, landing = false)
        }
        return next.round()
    }

    private fun start(
        id: String,
        anim: Animatable<Offset, AnimationVector2D>,
        from: Offset,
        animate: Boolean,
        landing: Boolean,
    ): Offset {
        val gen = (generation[id] ?: 0) + 1
        generation[id] = gen
        pending[id] = from
        scope.launch {
            try {
                anim.snapTo(from)
                if (generation[id] == gen) pending.remove(id)
                if (animate) {
                    sliding[id] = true
                    anim.animateTo(Offset.Zero, tween(REFLOW_MS, easing = REFLOW_EASING))
                }
            } finally {
                if (generation[id] == gen) {
                    pending.remove(id)
                    sliding.remove(id)
                    if (landing && landingId == id) landingId = null
                }
            }
        }
        return from
    }
}

/**
 * Applies [reflow]'s slide to the item. Put it right after the modifiers
 * that measure the item (bounds, press gesture), so those keep seeing the
 * item's layout box and never where it is drawn — like the web's offsetTop.
 */
@OptIn(ExperimentalComposeUiApi::class)
internal fun Modifier.statsReflow(
    reflow: StatsReflow,
    id: String,
    jump: Boolean = false,
    followRootY: (() -> Float?)? = null,
): Modifier = this.layout { measurable, constraints ->
    val placeable = measurable.measure(constraints)
    layout(placeable.width, placeable.height) {
        val coords = coordinates
        val shift = if (coords != null) reflow.shift(id, coords, jump, followRootY?.invoke()) else IntOffset.Zero
        placeable.place(shift)
    }
}

/** A dropped item's lift shadow fades while it glides into place (LIFT_SHADOW → none). */
@Composable
internal fun Modifier.statsLanding(active: Boolean, layerShape: Shape): Modifier {
    if (!active) return this
    val fade = remember { Animatable(1f) }
    LaunchedEffect(Unit) { fade.animateTo(0f, tween(REFLOW_MS, easing = REFLOW_EASING)) }
    return this.graphicsLayer {
        shadowElevation = 12.dp.toPx() * fade.value
        shape = layerShape
        clip = false
    }
}

/**
 * The page background's tap: any short tap that is not on an editable item
 * and not taken by a control (button, link, field) ends edit mode. Swipes
 * still just scroll. [origin] is the viewport's root position.
 */
internal suspend fun PointerInputScope.detectBackgroundTap(controller: StatsEditController, origin: () -> Offset) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Final)
        val onItem = controller.isOnItem(origin() + down.position)
        val up = waitForUpOrCancellation(pass = PointerEventPass.Final)
        if (up != null && !onItem && (up.position - down.position).getDistance() <= TAP_TOLERANCE_PX) {
            controller.exitRequests += 1
        }
    }
}

/** What a press on an editable item turned into. */
internal enum class PressOutcome { LongPress, Tap, Moved }

/**
 * The common press logic: waits [delayMs] for a still finger. Moving more
 * than the touch slop first means the user is scrolling, so the press is
 * dropped and the scroll container keeps the gesture.
 *
 * With [onDragMove]/[onDragEnd] the item follows the finger itself after the
 * long press. Without them the press ends at the lift and a container-level
 * [trackLiftedDrag] carries the drag — needed when the lifted item's own node
 * may leave the composition while it is dragged (the card grid re-renders
 * itself as it will look once the item is let go).
 */
internal suspend fun PointerInputScope.awaitItemPress(
    delayMs: () -> Long,
    onLongPress: (downPosition: Offset) -> Boolean,
    onTap: () -> Unit,
    onDragMove: ((position: Offset) -> Unit)? = null,
    onDragEnd: ((cancelled: Boolean) -> Unit)? = null,
) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = true)
        val slop = viewConfiguration.touchSlop
        val result: Int? = withTimeoutOrNull(delayMs()) {
            var outcome = -1
            while (outcome < 0) {
                val event = awaitPointerEvent()
                val change = event.changes.firstOrNull { it.id == down.id }
                outcome = when {
                    change == null -> 2
                    !change.pressed -> 1
                    change.isConsumed || (change.position - down.position).getDistance() > slop -> 2
                    else -> -1
                }
            }
            outcome
        }
        val outcome = when (result) {
            null -> PressOutcome.LongPress
            1 -> PressOutcome.Tap
            else -> PressOutcome.Moved
        }
        when (outcome) {
            PressOutcome.Tap -> onTap()
            PressOutcome.Moved -> Unit
            PressOutcome.LongPress -> {
                if (!onLongPress(down.position)) return@awaitEachGesture
                if (onDragMove == null || onDragEnd == null) return@awaitEachGesture
                var finished = false
                try {
                    while (!finished) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id }
                        if (change == null) {
                            finished = true
                            onDragEnd(true)
                        } else if (!change.pressed) {
                            change.consume()
                            finished = true
                            onDragEnd(false)
                        } else {
                            change.consume()
                            onDragMove(change.position)
                        }
                    }
                } finally {
                    if (!finished) onDragEnd(true)
                }
            }
        }
    }
}

/**
 * The container's half of a lift (see [awaitItemPress]): once [isLifted],
 * every move of the finger goes to [onMove] (container-local position) and
 * letting go to [onEnd]. The page does not scroll meanwhile (the moves are
 * consumed); before the lift nothing is touched, so a swipe still scrolls.
 */
internal suspend fun PointerInputScope.trackLiftedDrag(
    isLifted: () -> Boolean,
    onMove: (position: Offset) -> Unit,
    onEnd: (cancelled: Boolean) -> Unit,
) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        var ended = false
        try {
            while (!ended) {
                val event = awaitPointerEvent()
                val change = event.changes.firstOrNull { it.id == down.id }
                if (!isLifted()) {
                    if (change == null || !change.pressed) ended = true
                } else if (change == null) {
                    ended = true
                    onEnd(true)
                } else if (!change.pressed) {
                    change.consume()
                    ended = true
                    onEnd(false)
                } else {
                    change.consume()
                    onMove(change.position)
                }
            }
        } finally {
            if (!ended && isLifted()) onEnd(true)
        }
    }
}

/** `.stat-card-editing`: the wobble while editing (±1°, 0.22 s, staggered by index). */
@Composable
internal fun Modifier.statsWobble(active: Boolean, index: Int): Modifier {
    if (!active) return this
    val transition = rememberInfiniteTransition()
    val angle by transition.animateFloat(
        initialValue = -1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            tween(110, easing = FastOutSlowInEasing),
            RepeatMode.Reverse,
            initialStartOffset = StartOffset((index % 3) * 60),
        ),
    )
    return this.graphicsLayer { rotationZ = angle }
}
