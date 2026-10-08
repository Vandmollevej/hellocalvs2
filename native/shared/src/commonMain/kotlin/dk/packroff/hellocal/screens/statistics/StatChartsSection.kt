package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.ui.StatsRemoveCircle
import dk.packroff.hellocal.ui.statsOutline

// src/components/StatChartsSection.tsx — the charts at the top of the
// statistics page with the same editing as the card grid: a long press makes
// them wobble, a short tap on the background ends it, the remove circle
// takes a chart off and a lifted chart is dragged up/down in the list. The
// lifted chart follows the finger; the others slide (FLIP) into their new
// places as the order changes under it, and on release it glides into its slot.

private class ChartDrag(val key: String, val grabY: Float, val pointerY: Float)

private class ChartsState(initial: List<String>, val edit: StatsEditController, val reflow: StatsReflow) {
    var order by mutableStateOf(initial)
    var editMode by mutableStateOf(false)
    var drag by mutableStateOf<ChartDrag?>(null)

    fun bounds(key: String) = edit.itemBounds["chart:$key"]

    fun lift(key: String, downY: Float): Boolean {
        if (bounds(key) == null) return false
        editMode = true
        drag = ChartDrag(key, downY, (bounds(key)?.top ?: 0f) + downY)
        return true
    }

    fun move(localY: Float) {
        val current = drag ?: return
        val top = bounds(current.key)?.top ?: return
        val pointerY = top + localY
        drag = ChartDrag(current.key, current.grabY, pointerY)
        reorder(pointerY)
    }

    /** The lifted chart goes before the first chart whose centre lies below its own centre. */
    fun reorder(pointerY: Float) {
        val current = drag ?: return
        val dragged = bounds(current.key) ?: return
        val center = pointerY - current.grabY + dragged.height / 2
        val others = order.filter { it != current.key }
        var index = 0
        for (key in others) {
            val rect = bounds(key) ?: continue
            if (rect.top + rect.height / 2 < center) index += 1
        }
        val next = others.subList(0, index) + current.key + others.subList(index, others.size)
        if (next != order) order = next
    }

    /** endDrag: the chart glides (180 ms) from under the finger into its slot. */
    fun end() {
        val current = drag ?: return
        reflow.settleFromLastDrawn(current.key)
        drag = null
    }
}

@Composable
internal fun StatChartsSection(
    edit: StatsEditController,
    onShowAddChange: (Boolean) -> Unit,
    onEditModeChange: (Boolean) -> Unit,
    renderChart: @Composable (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val state = remember { ChartsState(loadChartLayout(), edit, StatsReflow(scope)) }
    val reflow = state.reflow
    var firstSave by remember { mutableStateOf(true) }

    LaunchedEffect(state.editMode, state.order.size) { onShowAddChange(state.editMode || state.order.isEmpty()) }
    LaunchedEffect(state.editMode) { onEditModeChange(state.editMode) }
    LaunchedEffect(state.order) {
        if (firstSave) firstSave = false else saveChartLayout(state.order)
    }
    LaunchedEffect(edit.exitRequests) {
        if (edit.exitRequests > 0 && state.editMode && state.drag == null) state.editMode = false
    }
    val dragging = state.drag != null
    LaunchedEffect(dragging) {
        while (dragging) {
            withFrameNanos { }
            val current = state.drag ?: break
            val speed = edit.autoScrollSpeed(current.pointerY)
            if (speed != 0f) {
                edit.scrollState.scrollBy(speed)
                state.reorder(current.pointerY)
            }
        }
    }

    val visible = state.order.filter { statChartDef(it) != null }
    reflow.liveIds = visible.toSet()
    // A new order starts the FLIP slides (the web's layout effect on [order, drag]).
    SideEffect { reflow.observe(visible) }
    if (visible.isEmpty()) return

    Column(
        Modifier.fillMaxWidth().onPlaced { reflow.container = it },
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        visible.forEachIndexed { index, chartKey ->
            key(chartKey) {
                val isDragged = state.drag?.key == chartKey
                DisposableEffect(chartKey) {
                    onDispose {
                        edit.itemBounds.remove("chart:$chartKey")
                        reflow.forget(chartKey)
                    }
                }
                Box(
                    Modifier
                        .fillMaxWidth()
                        .zIndex(if (isDragged) 3f else reflow.zIndex(chartKey))
                        // Bounds and the press gesture use the chart's layout box,
                        // never where it is drawn (the web measures offsetTop).
                        .onGloballyPositioned { edit.itemBounds["chart:$chartKey"] = it.boundsInRoot() }
                        .pointerInput(state, chartKey) {
                            awaitItemPress(
                                delayMs = { if (state.editMode) DRAG_DELAY_MS else ENTER_EDIT_DELAY_MS },
                                onLongPress = { position -> state.lift(chartKey, position.y) },
                                onTap = {},
                                onDragMove = { state.move(it.y) },
                                onDragEnd = { state.end() },
                            )
                        }
                        // The lifted chart follows the finger; the others slide into place.
                        .statsReflow(
                            reflow,
                            chartKey,
                            followRootY = { state.drag?.takeIf { it.key == chartKey }?.let { it.pointerY - it.grabY } },
                        )
                        .let { if (isDragged) it.shadow(12.dp, RoundedCornerShape(HcDimens.RadiusCard)) else it }
                        .statsWobble(state.editMode && !isDragged, index),
                ) {
                    Box(Modifier.fillMaxWidth().let { if (state.editMode) it.statsOutline(HcColors.Black.copy(alpha = 0.4f)) else it }) {
                        renderChart(chartKey)
                    }
                    if (state.editMode) {
                        Box(Modifier.matchParentSize(), contentAlignment = Alignment.TopEnd) {
                            StatsRemoveCircle(
                                { state.order = state.order.filter { it != chartKey } },
                                Modifier.offset(11.dp, (-11).dp),
                            )
                        }
                    }
                }
            }
        }
    }
}
