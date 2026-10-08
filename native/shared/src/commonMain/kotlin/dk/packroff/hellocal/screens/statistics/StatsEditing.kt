package dk.packroff.hellocal.screens.statistics

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope

// Edit mode shared by the chart section and the card grid on the statistics
// page (StatChartsSection.tsx / StatCardsGrid.tsx): a long press makes the
// items wobble, a short tap on the background ends it, items are lifted and
// dragged, and the page scrolls by itself near the top/bottom edge.

internal const val ENTER_EDIT_DELAY_MS = 500L
internal const val DRAG_DELAY_MS = 250L
internal const val TAP_TOLERANCE_PX = 10f
internal const val AUTO_SCROLL_EDGE_PX = 72f

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
 */
internal suspend fun PointerInputScope.awaitItemPress(
    delayMs: () -> Long,
    onLongPress: (downPosition: Offset) -> Boolean,
    onTap: () -> Unit,
    onDragMove: (position: Offset) -> Unit,
    onDragEnd: (cancelled: Boolean) -> Unit,
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
