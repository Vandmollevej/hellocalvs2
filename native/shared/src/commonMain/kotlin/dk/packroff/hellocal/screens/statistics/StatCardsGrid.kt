package dk.packroff.hellocal.screens.statistics

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.theme.style
import dk.packroff.hellocal.ui.ChevronDirection
import dk.packroff.hellocal.ui.HcChevron
import dk.packroff.hellocal.ui.HcRemoteImage
import dk.packroff.hellocal.ui.HcSectionTitle
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.StatsDrumstickIcon
import dk.packroff.hellocal.ui.StatsRemoveCircle
import dk.packroff.hellocal.ui.StatsSkeleton
import dk.packroff.hellocal.ui.StatsUncertaintyTilde
import dk.packroff.hellocal.ui.StatsWaterGlassIcon
import dk.packroff.hellocal.ui.icons.HcIcon
import dk.packroff.hellocal.ui.statsOutline
import dk.packroff.hellocal.ui.statsSelected
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

// src/components/StatCardsGrid.tsx — the user's own grid of stat cards. Two
// columns of physical slots: a run of half-width items (cards and explicit
// empty slots) always has an even length, so every index has a fixed
// left/right place. Headers, dividers and fold-out sections span a row.
// A long press enters edit mode (wobble, remove circles); a lifted item
// follows the finger and lands where it is let go: a card swaps with the
// slot under the finger (or goes into a closed section, or is removed when
// let go outside the grid); a header, divider or section moves between rows.
//
// While something is lifted the grid already shows the result of letting go:
// the card it would swap with has moved to the card's old slot, and a
// header's landing row is a dashed placeholder. Every item that changes place
// slides there (FLIP, StatsReflow), and on release the item glides from
// under the finger into its spot.

private val SHAPE = RoundedCornerShape(HcDimens.RadiusCard)

/** The dashed placeholder where a lifted header/divider/section lands. */
private const val PREVIEW_ID = "heading-preview"

/** Ids of the items that are drawn: everything except the rows inside a closed section. */
private fun renderedIds(items: List<LayoutItem>): Set<String> {
    val ids = HashSet<String>()
    var closed: String? = null
    for (item in items) {
        val inside = closed
        if (inside != null) {
            if (item is AccordionEndLayoutItem && item.id == inside) closed = null
            continue
        }
        when (item) {
            is AccordionLayoutItem -> {
                ids += item.itemId
                if (!item.open) closed = item.id
            }
            is AccordionEndLayoutItem -> Unit
            else -> ids += item.itemId
        }
    }
    return ids
}

// ---------- Layout helpers (StatCardsGrid.tsx) ----------

/** Index of the first item of every visual row. */
private fun rowStarts(items: List<LayoutItem>): List<Int> {
    val starts = mutableListOf<Int>()
    var i = 0
    while (i < items.size) {
        starts += i
        i += if (items[i].isHalfWidth()) 2 else 1
    }
    return starts
}

private fun endsWithEmptyRow(layout: List<LayoutItem>): Boolean {
    val n = layout.size
    return n >= 2 && layout[n - 1] is EmptyLayoutItem && layout[n - 2] is EmptyLayoutItem && rowStarts(layout).contains(n - 2)
}

/** While editing there is always one free row at the bottom — of the grid and of every section. */
private fun withTrailingEmptyRow(layout: List<LayoutItem>): List<LayoutItem> {
    val next = mutableListOf<LayoutItem>()
    for (item in layout) {
        if (item is AccordionEndLayoutItem && !endsWithEmptyRow(next)) {
            next += makeEmptyStatSlot()
            next += makeEmptyStatSlot()
        }
        next += item
    }
    if (!endsWithEmptyRow(next)) {
        next += makeEmptyStatSlot()
        next += makeEmptyStatSlot()
    }
    return next
}

/** The layout without the lifted item — for a section, without its whole block. */
private fun withoutItem(layout: List<LayoutItem>, item: LayoutItem): List<LayoutItem> {
    if (item is AccordionLayoutItem) {
        accordionRange(layout, item.id)?.let { return layout.subList(0, it.start) + layout.subList(it.end + 1, layout.size) }
    }
    return layout.filter { it.itemId != item.itemId }
}

/** What moves when the item is lifted: the item, or a section's whole block. */
private fun liftedBlock(layout: List<LayoutItem>, item: LayoutItem): List<LayoutItem> {
    if (item is AccordionLayoutItem) {
        accordionRange(layout, item.id)?.let { return layout.subList(it.start, it.end + 1) }
    }
    return listOf(item)
}

private fun accordionCardCount(layout: List<LayoutItem>, id: String): Int {
    val range = accordionRange(layout, id) ?: return 0
    return layout.subList(range.start + 1, range.end).count { it is StatLayoutItem }
}

// ---------- State ----------

private class GridDrag(val id: String, val item: LayoutItem, val pointer: Offset, val grab: Offset, val size: IntSize)

private class GridState(
    initial: List<LayoutItem>,
    val edit: StatsEditController,
    val reflow: StatsReflow,
    private val scope: CoroutineScope,
) {
    var layout by mutableStateOf(initial)
    var editMode by mutableStateOf(false)
    var drag by mutableStateOf<GridDrag?>(null)
    /** Card drag: the slot (index) it lands in — null outside the grid (= remove). */
    var slotTarget by mutableStateOf<Int?>(null)
    /** Card drag: the closed section it goes into. */
    var accordionTarget by mutableStateOf<String?>(null)
    /** Header/divider/section drag: the index in the layout without the item. */
    var insertAt by mutableStateOf<Int?>(null)
    var editingHeaderId by mutableStateOf<String?>(null)
    var uncertaintyToggled by mutableStateOf(setOf<String>())
    var gridBounds: Rect = Rect.Zero
    var gridOrigin by mutableStateOf(Offset.Zero)
    var gridCoords: LayoutCoordinates? = null
    /** The placeholder's entry: its height grows from 0 (REFLOW_MS). */
    val previewGrow = Animatable(0f)

    /**
     * Every drawn half-width slot by its index in [renderItems] (the web's
     * data-slot-index), with the id drawn there when it was measured.
     */
    val slotBounds = HashMap<Int, Pair<String, Rect>>()

    fun bounds(id: String): Rect? = edit.itemBounds["grid:$id"]

    /** What is drawn while something is lifted: the grid as it will be once it is let go. */
    val renderItems: List<LayoutItem>
        get() {
            val d = drag ?: return layout
            if (d.item.isHalfWidth()) {
                if (accordionTarget != null) return layout
                val from = layout.indexOfFirst { it.itemId == d.id }
                val to = slotTarget ?: from
                if (from < 0 || to < 0 || to == from || to >= layout.size) return layout
                val next = layout.toMutableList()
                next[from] = layout[to]
                next[to] = layout[from]
                return next
            }
            return withoutItem(layout, d.item)
        }

    /** Header/divider/section drag: where in [renderItems] the dashed placeholder sits. */
    val previewAt: Int?
        get() {
            val d = drag ?: return null
            if (d.item.isHalfWidth()) return null
            val at = insertAt ?: return null
            return minOf(at, withoutItem(layout, d.item).size)
        }

    fun enterEditMode() {
        editMode = true
        layout = withTrailingEmptyRow(layout)
    }

    fun exitEditMode() {
        editMode = false
        drag = null
        slotTarget = null
        accordionTarget = null
        insertAt = null
        editingHeaderId = null
        layout = normalizeStatLayout(layout)
    }

    fun removeItem(id: String) {
        val prev = layout
        val target = prev.firstOrNull { it.itemId == id }
        layout = if (target is AccordionLayoutItem) {
            // Removing a section keeps its cards: they move out where the section was.
            val range = accordionRange(prev, target.id) ?: return
            val contents = prev.subList(range.start + 1, range.end).toMutableList()
            while (endsWithEmptyRow(contents)) {
                contents.removeAt(contents.lastIndex)
                contents.removeAt(contents.lastIndex)
            }
            prev.subList(0, range.start) + contents + prev.subList(range.end + 1, prev.size)
        } else {
            // A card leaves its slot empty — the rest of the grid must not shift.
            prev.flatMap { item ->
                when {
                    item.itemId != id -> listOf(item)
                    item is StatLayoutItem -> listOf(makeEmptyStatSlot())
                    else -> emptyList()
                }
            }
        }
    }

    fun toggleAccordion(id: String) {
        layout = layout.map { if (it is AccordionLayoutItem && it.id == id) it.copy(open = !it.open) else it }
    }

    fun updateHeaderText(id: String, text: String) {
        layout = layout.map {
            when {
                it is HeaderLayoutItem && it.id == id -> it.copy(text = text)
                it is AccordionLayoutItem && it.id == id -> it.copy(title = text)
                else -> it
            }
        }
    }

    /**
     * The long press on [pressedId] lifts it. [downPosition] is the finger in
     * the item's layout box; the box itself (not where a slide draws it) is
     * where the floating copy starts, like the web's offsetLeft/offsetTop.
     */
    fun startDrag(pressedId: String, downPosition: Offset): Boolean {
        val item = layout.firstOrNull { it.itemId == pressedId } ?: return false
        val origin = bounds(item.itemId) ?: return false
        if (!editMode) enterEditMode()
        val index = layout.indexOfFirst { it.itemId == item.itemId }
        val isCard = item.isHalfWidth()
        editingHeaderId = null
        // A full-width item starts out where it is: everything before it is
        // unchanged in the layout without it, so its index is the insert index.
        insertAt = if (!isCard && index >= 0) index else null
        slotTarget = if (isCard && index >= 0) index else null
        accordionTarget = null
        if (!isCard) {
            reflow.forget(PREVIEW_ID, force = true)
            scope.launch {
                previewGrow.snapTo(0f)
                previewGrow.animateTo(1f, tween(REFLOW_MS, easing = REFLOW_EASING))
            }
        }
        drag = GridDrag(item.itemId, item, origin.topLeft + downPosition, downPosition, IntSize(origin.width.roundToInt(), origin.height.roundToInt()))
        return true
    }

    /** The finger moved to [pointer] (root coordinates). */
    fun moveDrag(pointer: Offset) {
        val current = drag ?: return
        drag = GridDrag(current.id, current.item, pointer, current.grab, current.size)
        updateTargets(pointer)
    }

    fun updateTargets(pointer: Offset) {
        val current = drag ?: return
        if (current.item.isHalfWidth()) {
            if (!gridBounds.contains(pointer)) {
                slotTarget = null
                return
            }
            // The slot under the finger, measured from the slots' layout boxes
            // (never from where a sliding card is drawn). A slot whose drawn
            // item no longer matches the list is a frame old and is skipped.
            val drawn = renderItems
            var hit: Int? = null
            for ((index, entry) in slotBounds) {
                val (drawnId, rect) = entry
                if (index < drawn.size && drawn[index].itemId == drawnId && drawn[index].isHalfWidth() && rect.contains(pointer)) {
                    hit = index
                    break
                }
            }
            // A closed section's header takes the card in at the section's end.
            var into: String? = null
            if (hit == null) {
                into = layout.filterIsInstance<AccordionLayoutItem>()
                    .firstOrNull { !it.open && bounds(it.itemId)?.contains(pointer) == true }?.id
            }
            val own = layout.indexOfFirst { it.itemId == current.id }.takeIf { it >= 0 }
            val wasInto = accordionTarget
            if (into != null) {
                accordionTarget = into
                slotTarget = own
                return
            }
            accordionTarget = null
            if (hit != null) slotTarget = hit
            else if (slotTarget == null || wasInto != null) slotTarget = own
            return
        }
        // Header/divider/section: lands before the first row whose centre lies below the finger.
        val rest = withoutItem(layout, current.item)
        val topLevelOnly = current.item is AccordionLayoutItem
        val candidates = mutableListOf<Int>()
        var boundary = 0
        for (start in rowStarts(rest)) {
            val first = rest[start]
            if (first is AccordionEndLayoutItem) continue
            if (topLevelOnly && accordionAt(rest, start) != null) continue
            val rect = bounds(first.itemId) ?: continue
            candidates += start
            if (rect.top + rect.height / 2 < pointer.y) boundary += 1
        }
        insertAt = if (boundary < candidates.size) candidates[boundary] else rest.size
    }

    /** Lets go: the item lands where the grid shows it; a card let go outside the grid is removed. */
    fun drop(cancelled: Boolean) {
        val current = drag ?: return
        val currentLayout = layout
        val isCard = current.item.isHalfWidth()
        val from = currentLayout.indexOfFirst { it.itemId == current.id }
        val target = slotTarget
        val into = accordionTarget
        val at = insertAt
        if (!cancelled && isCard && target == null && into == null) {
            removeItem(current.id)
        } else if (!cancelled && isCard && into != null && from >= 0) {
            val next = currentLayout.toMutableList()
            next[from] = makeEmptyStatSlot()
            val range = accordionRange(next, into)
            if (range != null) {
                if (endsWithEmptyRow(next.subList(0, range.end))) next[range.end - 2] = current.item
                else next.add(range.end, current.item)
                layout = withTrailingEmptyRow(normalizeStatLayout(next))
            }
        } else {
            // It lands where the grid already shows it and glides there from
            // under the finger; a cancelled drag glides back home.
            val origin = gridCoords?.takeIf { it.isAttached }?.positionInRoot() ?: gridOrigin
            reflow.settleFrom(current.id, current.pointer - current.grab - origin)
            if (!cancelled && isCard && target != null && from >= 0 && target != from && target < currentLayout.size) {
                // Card onto a card or an empty slot: the two swap places.
                val next = currentLayout.toMutableList()
                next[from] = currentLayout[target]
                next[target] = currentLayout[from]
                layout = next
            } else if (!cancelled && !isCard && at != null) {
                val rest = withoutItem(currentLayout, current.item)
                val block = liftedBlock(currentLayout, current.item)
                val index = minOf(at, rest.size)
                layout = rest.subList(0, index) + block + rest.subList(index, rest.size)
            }
        }
        if (!isCard) scope.launch { previewGrow.snapTo(0f) }
        drag = null
        slotTarget = null
        accordionTarget = null
        insertAt = null
    }

    /** A short tap: a header's title renames it while editing; a section header renames or opens/closes. */
    fun tap(item: LayoutItem) {
        if (editMode && item is HeaderLayoutItem) editingHeaderId = item.id
        else if (item is AccordionLayoutItem) {
            if (editMode) editingHeaderId = item.id else toggleAccordion(item.id)
        }
    }
}

// ---------- Grid ----------

@OptIn(ExperimentalComposeUiApi::class)
@Composable
internal fun StatCardsGrid(
    cards: List<StatCardValue>,
    highlightRecommendedLimits: Boolean,
    autoExpandUncertainty: Boolean,
    loading: Boolean,
    edit: StatsEditController,
    onShowAddChange: (Boolean) -> Unit,
    onEditModeChange: (Boolean) -> Unit,
) {
    val coroutineScope = rememberCoroutineScope()
    val state = remember { GridState(loadStatLayout(), edit, StatsReflow(coroutineScope), coroutineScope) }
    val cardByKey = remember(cards) { cards.associateBy { it.key } }
    val density = LocalDensity.current
    var firstSave by remember { mutableStateOf(true) }

    val hasItems = state.layout.any { it !is EmptyLayoutItem }
    LaunchedEffect(state.editMode, hasItems) { onShowAddChange(state.editMode || !hasItems) }
    LaunchedEffect(state.editMode) { onEditModeChange(state.editMode) }
    LaunchedEffect(state.layout) {
        if (firstSave) firstSave = false else saveStatLayout(state.layout)
    }
    LaunchedEffect(edit.exitRequests) {
        if (edit.exitRequests > 0 && state.editMode && state.drag == null) state.exitEditMode()
    }
    // Auto-scroll while an item is held near the top/bottom of the screen.
    val dragging = state.drag != null
    LaunchedEffect(dragging) {
        while (dragging) {
            withFrameNanos { }
            val current = state.drag ?: break
            val speed = edit.autoScrollSpeed(current.pointer.y)
            if (speed != 0f) {
                edit.scrollState.scrollBy(speed)
                state.updateTargets(current.pointer)
            }
        }
    }

    val items = state.renderItems
    val previewAt = state.previewAt
    state.reflow.liveIds = renderedIds(items)
    // A new rendered list starts the FLIP slides (GridReflow's getSnapshotBeforeUpdate).
    SideEffect { state.reflow.observe(items) }

    val scope = GridScope(state, cardByKey, highlightRecommendedLimits, autoExpandUncertainty, loading, previewAt)
    Box(
        Modifier
            .fillMaxWidth()
            .onPlaced {
                state.reflow.container = it
                state.gridCoords = it
            }
            .onGloballyPositioned {
                state.gridBounds = it.boundsInRoot()
                state.gridOrigin = it.positionInRoot()
            }
            // Carries a lifted item: its own node may leave the grid while it
            // is dragged (a header leaves the list, a card changes row).
            .pointerInput(state) {
                trackLiftedDrag(
                    isLifted = { state.drag != null },
                    onMove = { position ->
                        val coords = state.gridCoords
                        if (coords != null && coords.isAttached) state.moveDrag(coords.localToRoot(position))
                    },
                    onEnd = { cancelled -> state.drop(cancelled) },
                )
            },
    ) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            scope.Range(items, 0, items.size)
            if (previewAt != null && previewAt >= items.size) key(PREVIEW_ID) { scope.Preview() }
        }
        // The lifted item under the finger, exactly as it looks in the grid while editing.
        state.drag?.let { d ->
            val width = with(density) { d.size.width.toDp() }
            val height = with(density) { d.size.height.toDp() }
            Box(
                Modifier
                    .zIndex(10f)
                    .layout { measurable, constraints ->
                        val placeable = measurable.measure(constraints)
                        layout(placeable.width, placeable.height) {
                            // Measured from where the grid is right now, so it stays
                            // under the finger while the page auto-scrolls.
                            val origin = coordinates?.positionInRoot() ?: state.gridOrigin
                            placeable.place(
                                IntOffset(
                                    (d.pointer.x - d.grab.x - origin.x).roundToInt(),
                                    (d.pointer.y - d.grab.y - origin.y).roundToInt(),
                                ),
                            )
                        }
                    }
                    .size(width, height)
                    .shadow(12.dp, SHAPE)
                    .background(HcColors.Cream, SHAPE),
            ) {
                scope.Lifted(d.item)
            }
        }
    }
}

private class GridScope(
    val state: GridState,
    val cardByKey: Map<String, StatCardValue>,
    val highlightRecommendedLimits: Boolean,
    val autoExpandUncertainty: Boolean,
    val loading: Boolean,
    /** Where in the drawn list the header placeholder goes (null: none). */
    val previewAt: Int?,
) {
    private val reflow get() = state.reflow

    /** During a card drag the lifted card's slot marker and the empty slots just appear; only cards slide. */
    private fun jumps(item: LayoutItem): Boolean {
        val d = state.drag ?: return false
        return d.item.isHalfWidth() && (item.itemId == d.id || item is EmptyLayoutItem)
    }

    /** The dashed placeholder where a lifted header, divider or section lands. */
    @Composable
    fun Preview() {
        val d = state.drag ?: return
        val grow = state.previewGrow.value
        val height = with(LocalDensity.current) { d.size.height.toDp() }
        val label = when (val item = d.item) {
            is HeaderLayoutItem -> item.text
            is AccordionLayoutItem -> item.title
            else -> ""
        }
        Box(
            Modifier
                .fillMaxWidth()
                .statsReflow(reflow, PREVIEW_ID)
                .height(height * grow)
                .alpha(grow)
                .clip(SHAPE)
                .statsOutline(HcColors.Black.copy(alpha = 0.4f)),
            contentAlignment = Alignment.Center,
        ) {
            HcText(label, HcTypeRoles.Small, color = HcColors.Black.copy(alpha = 0.5f), maxLines = 1)
        }
    }

    /**
     * Registers an item's layout box, its press gesture and its slide. The
     * box and the press are measured before the slide is applied, so they
     * always describe where the item belongs, not where it is drawn. The
     * press only lifts the item; the grid carries the drag ([trackLiftedDrag]).
     */
    @Composable
    fun Modifier.editable(item: LayoutItem, slotIndex: Int? = null, slide: Boolean = true): Modifier {
        val id = item.itemId
        val grid = state
        DisposableEffect(id) {
            onDispose {
                grid.edit.itemBounds.remove("grid:$id")
                grid.reflow.forget(id)
            }
        }
        return this
            .slotBounds(id, slotIndex)
            .onGloballyPositioned { grid.edit.itemBounds["grid:$id"] = it.boundsInRoot() }
            .pointerInput(grid, id) {
                awaitItemPress(
                    delayMs = { if (grid.editMode) DRAG_DELAY_MS else ENTER_EDIT_DELAY_MS },
                    onLongPress = { position -> grid.startDrag(id, position) },
                    onTap = { grid.layout.firstOrNull { it.itemId == id }?.let { grid.tap(it) } },
                )
            }
            .let { if (slide) it.statsReflow(reflow, id, jump = jumps(item)) else it }
    }

    /** Empty slots are drop targets but no press targets. */
    @Composable
    private fun Modifier.editableBounds(item: LayoutItem, slotIndex: Int): Modifier {
        val id = item.itemId
        val grid = state
        DisposableEffect(id) {
            onDispose {
                grid.edit.itemBounds.remove("grid:$id")
                grid.reflow.forget(id)
            }
        }
        return this
            .slotBounds(id, slotIndex)
            .onGloballyPositioned { grid.edit.itemBounds["grid:$id"] = it.boundsInRoot() }
            .statsReflow(reflow, id, jump = jumps(item))
    }

    /** The web's data-slot-index: a half-width slot's layout box by its index in the drawn list. */
    @Composable
    private fun Modifier.slotBounds(id: String, slotIndex: Int?): Modifier {
        if (slotIndex == null) return this
        val grid = state
        DisposableEffect(id, slotIndex) {
            onDispose { if (grid.slotBounds[slotIndex]?.first == id) grid.slotBounds.remove(slotIndex) }
        }
        return onGloballyPositioned { grid.slotBounds[slotIndex] = id to it.boundsInRoot() }
    }

    /** Draw order: the landing item on top, then sliding items (web z-index 20 / 10). */
    private fun zOf(vararg items: LayoutItem?): Float =
        items.maxOfOrNull { item -> if (item == null) 0f else reflow.zIndex(item.itemId) } ?: 0f

    /** Walks the flat list and nests each section's rows under its header. */
    @Composable
    fun Range(items: List<LayoutItem>, from: Int, to: Int) {
        var i = from
        while (i < to) {
            val item = items[i]
            if (i == previewAt) key(PREVIEW_ID) { Preview() }
            when {
                item is AccordionLayoutItem -> {
                    var end = -1
                    for (k in i + 1 until items.size) {
                        val other = items[k]
                        if (other is AccordionEndLayoutItem && other.id == item.id) {
                            end = k
                            break
                        }
                    }
                    if (end < 0 || end > to) end = to
                    val count = (i + 1 until end).count { items[it] is StatLayoutItem }
                    val start = i
                    key(item.itemId) { Accordion(item, start, items, end, count) }
                    i = end + 1
                }
                item is AccordionEndLayoutItem -> i += 1
                item.isHalfWidth() -> {
                    val left = item
                    val right = items.getOrNull(i + 1)?.takeIf { i + 1 < to && it.isHalfWidth() }
                    val index = i
                    key(left.itemId) {
                        Row(
                            Modifier.fillMaxWidth().zIndex(zOf(left, right)).height(IntrinsicSize.Min),
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Slot(left, index, Modifier.weight(1f).fillMaxHeight().zIndex(zOf(left)))
                            if (right != null) Slot(right, index + 1, Modifier.weight(1f).fillMaxHeight().zIndex(zOf(right)))
                            else Box(Modifier.weight(1f))
                        }
                    }
                    i += if (right != null) 2 else 1
                }
                else -> {
                    val index = i
                    key(item.itemId) {
                        Box(Modifier.fillMaxWidth().zIndex(zOf(item))) { FullWidth(item, index) }
                    }
                    i += 1
                }
            }
        }
    }

    @Composable
    private fun BoxScope.RemoveCircle(onRemove: () -> Unit) {
        // Centred on the item's top-right corner, 6 px outside like the web.
        Box(Modifier.matchParentSize(), contentAlignment = Alignment.TopEnd) {
            StatsRemoveCircle(onRemove, Modifier.offset(11.dp, (-11).dp))
        }
    }

    private fun cardOutline(modifier: Modifier, card: StatCardValue?): Modifier {
        val warn = highlightRecommendedLimits && card?.outsideRecommendedRange == true
        return when {
            state.editMode -> modifier.statsOutline(if (warn) HcColors.RedDark else HcColors.Black.copy(alpha = 0.4f))
            warn -> modifier.border(1.dp, HcColors.RedDark, SHAPE)
            else -> modifier
        }
    }

    @Composable
    private fun Slot(item: LayoutItem, index: Int, modifier: Modifier) {
        val drag = state.drag
        if (item is EmptyLayoutItem) {
            Box(
                modifier
                    .heightIn(min = 76.dp)
                    .editableBounds(item, index)
                    .let { if (state.editMode) it.statsOutline(HcColors.Black.copy(alpha = 0.4f)) else it },
            )
            return
        }
        val key = (item as StatLayoutItem).key
        val card = cardByKey[key]
        // The lifted card itself floats under the finger. Its place in the
        // grid (already the slot it lands in) keeps the card's size and only
        // marks where it lands, so nothing shifts when it is let go.
        val isDragged = drag?.id == item.itemId
        val landsHere = isDragged && state.slotTarget != null && state.accordionTarget == null
        val background = when {
            landsHere -> HcColors.Black.copy(alpha = 0.05f)
            isDragged -> HcColors.Black.copy(alpha = 0f)
            card != null || loading -> HcColors.Tan
            else -> HcColors.Tan.copy(alpha = 0.5f)
        }
        Box(
            modifier
                .editable(item, index)
                .statsLanding(reflow.landingId == item.itemId, SHAPE)
                .statsWobble(state.editMode && !isDragged, index),
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .clip(SHAPE)
                    .background(background, SHAPE)
                    .let {
                        if (isDragged) it.statsOutline(if (landsHere) HcColors.Black else HcColors.Black.copy(alpha = 0.4f))
                        else cardOutline(it, card)
                    }
                    .padding(16.dp),
            ) {
                Box(Modifier.alpha(if (isDragged) 0f else 1f)) { CardFace(card) }
                if (card != null && !state.editMode) {
                    CardUncertainty(card, autoExpandUncertainty != (card.key in state.uncertaintyToggled)) {
                        state.uncertaintyToggled = if (card.key in state.uncertaintyToggled) state.uncertaintyToggled - card.key else state.uncertaintyToggled + card.key
                    }
                }
            }
            if (state.editMode && !isDragged) RemoveCircle { state.removeItem(item.itemId) }
        }
    }

    @Composable
    fun CardFace(card: StatCardValue?) {
        val t = LocalTranslator.current
        if (card == null && loading) {
            // Cards that only exist once data is loaded (e.g. sport): same two lines as sketches.
            Column {
                StatsSkeleton(Modifier.fillMaxWidth(0.7f).height(14.dp).padding(vertical = 2.dp))
                Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatsSkeleton(Modifier.size(20.dp), RoundedCornerShape(50))
                    StatsSkeleton(Modifier.size(56.dp, 20.dp))
                }
            }
            return
        }
        if (card == null) {
            // A saved key with no card in this period (e.g. a sport) keeps its slot.
            HcText(t.t("statCardsGrid.noData"), HcTypeRoles.Small, color = HcColors.Inactive)
            return
        }
        Column {
            HcText(card.label, HcTypeRoles.Small, color = HcColors.TextSecondary)
            Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                StatCardIcon(card.icon, card.iconSrc)
                if (card.loading) {
                    StatsSkeleton(Modifier.size(56.dp, 20.dp))
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (card.uncertainty?.estimated != null) StatsUncertaintyTilde(HcTypeRoles.BodyLg.size)
                        HcText(card.value, HcTypeRoles.BodyLg, bold = true, color = HcColors.Black)
                    }
                }
            }
        }
    }

    @Composable
    fun Lifted(item: LayoutItem) {
        val noop = {}
        when (item) {
            is HeaderLayoutItem -> Box(Modifier.fillMaxSize().statsOutline(HcColors.Black.copy(alpha = 0.4f)).padding(horizontal = 12.dp, vertical = 8.dp)) {
                HcSectionTitle(item.text)
                RemoveCircle(noop)
            }
            is DividerLayoutItem -> Box(Modifier.fillMaxSize().statsOutline(HcColors.Black.copy(alpha = 0.4f)), contentAlignment = Alignment.Center) {
                Box(Modifier.fillMaxWidth(0.8f).height(2.dp).background(HcColors.Black))
                RemoveCircle(noop)
            }
            is AccordionLayoutItem -> Box(Modifier.fillMaxSize()) {
                // The whole section travels, but only its header is under the finger.
                Row(
                    Modifier
                        .fillMaxSize()
                        .background(HcColors.Tan, SHAPE)
                        .statsSelected(item.open)
                        .statsOutline(HcColors.Black.copy(alpha = 0.4f))
                        .padding(start = 16.dp, end = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    HcText(item.title, HcTypeRoles.Body, Modifier.weight(1f), bold = true, maxLines = 1)
                    HcText(accordionCardCount(state.layout, item.id).toString(), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    Box(Modifier.size(36.dp), contentAlignment = Alignment.Center) {
                        HcChevron(if (item.open) ChevronDirection.Down else ChevronDirection.Right)
                    }
                }
                RemoveCircle(noop)
            }
            is StatLayoutItem -> {
                val card = cardByKey[item.key]
                Box(Modifier.fillMaxSize().clip(SHAPE).background(if (card != null || loading) HcColors.Tan else HcColors.Tan.copy(alpha = 0.5f)).statsOutline(HcColors.Black.copy(alpha = 0.4f))) {
                    Box(Modifier.padding(16.dp)) { CardFace(card) }
                    RemoveCircle(noop)
                }
            }
            else -> Unit
        }
    }

    @Composable
    private fun FullWidth(item: LayoutItem, index: Int) {
        val isDragged = state.drag?.id == item.itemId
        val outline = HcColors.Black.copy(alpha = 0.4f)
        val landing = reflow.landingId == item.itemId
        when (item) {
            is HeaderLayoutItem -> Box(
                Modifier
                    .fillMaxWidth()
                    .editable(item)
                    .statsLanding(landing, SHAPE)
                    .statsWobble(state.editMode && !isDragged, index),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .let { if (state.editMode || isDragged) it.statsOutline(outline) else it }
                        .padding(horizontal = if (state.editMode) 12.dp else 4.dp, vertical = 8.dp)
                        .alpha(if (isDragged) 0f else 1f),
                ) {
                    if (state.editingHeaderId == item.id) {
                        RenameField(item.text, centered = true, onChange = { state.updateHeaderText(item.id, it) }) { state.editingHeaderId = null }
                    } else {
                        HcSectionTitle(item.text)
                    }
                }
                if (state.editMode && !isDragged) RemoveCircle { state.removeItem(item.itemId) }
            }
            is DividerLayoutItem -> Box(
                Modifier
                    .fillMaxWidth()
                    .editable(item)
                    .statsLanding(landing, SHAPE)
                    .statsWobble(state.editMode && !isDragged, index),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(20.dp)
                        .let { if (state.editMode || isDragged) it.statsOutline(outline) else it },
                    contentAlignment = Alignment.Center,
                ) {
                    if (!isDragged) Box(Modifier.fillMaxWidth(0.8f).height(2.dp).background(HcColors.Black))
                }
                if (state.editMode && !isDragged) RemoveCircle { state.removeItem(item.itemId) }
            }
            else -> Unit
        }
    }

    @Composable
    private fun Accordion(item: AccordionLayoutItem, index: Int, items: List<LayoutItem>, end: Int, count: Int) {
        val isDragged = state.drag?.id == item.itemId
        val isTarget = state.accordionTarget == item.id
        val outline = HcColors.Black.copy(alpha = 0.4f)
        // The section slides as one block (frame, header and rows); rows that
        // move inside it slide on top of that.
        Box(
            Modifier
                .fillMaxWidth()
                .zIndex(zOf(item))
                .statsReflow(reflow, item.itemId)
                .statsLanding(reflow.landingId == item.itemId, SHAPE),
        ) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(SHAPE)
                .background(HcColors.Tan, SHAPE)
                .let { if (state.editMode) it.statsOutline(outline) else it }
                .alpha(if (isDragged) 0.35f else 1f),
        ) {
            Box(Modifier.fillMaxWidth().statsWobble(state.editMode && !isDragged, index)) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = HcDimens.ControlHeight)
                        .editable(item, slide = false)
                        .statsSelected(item.open)
                        .let { if (isTarget) it.statsOutline(HcColors.Black, width = 2.dp, dashed = false) else it }
                        .padding(start = 16.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    val renaming = state.editingHeaderId == item.id
                    Box(Modifier.weight(1f)) {
                        if (renaming) {
                            RenameField(item.title, centered = false, onChange = { state.updateHeaderText(item.id, it) }) { state.editingHeaderId = null }
                        } else {
                            HcText(item.title, HcTypeRoles.Body, bold = true, maxLines = 1)
                        }
                    }
                    HcText(count.toString(), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    Box(
                        Modifier.size(36.dp).clip(RoundedCornerShape(50)).clickable { state.toggleAccordion(item.id) },
                        contentAlignment = Alignment.Center,
                    ) {
                        HcChevron(if (item.open) ChevronDirection.Down else ChevronDirection.Right)
                    }
                }
            }
            if (item.open) {
                Column(
                    Modifier.fillMaxWidth().background(HcColors.Cream).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Range(items, index + 1, end)
                    // Landing as the section's last row (just before its end marker).
                    if (previewAt == end && end < items.size) key(PREVIEW_ID) { Preview() }
                }
            }
        }
        // Outside the clipped frame, so the circle can sit on the corner.
        if (state.editMode && !isDragged) {
            Box(Modifier.matchParentSize(), contentAlignment = Alignment.TopEnd) {
                StatsRemoveCircle({ state.removeItem(item.itemId) }, Modifier.offset(11.dp, (-11).dp))
            }
        }
        }
    }
}

/** The inline rename field of a header (centred between lines) or a section title. */
@Composable
private fun RenameField(value: String, centered: Boolean, onChange: (String) -> Unit, onDone: () -> Unit) {
    val focus = remember { FocusRequester() }
    var hadFocus by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val role = if (centered) HcTypeRoles.SectionTitle else HcTypeRoles.Body
    BasicTextField(
        value = value,
        onValueChange = onChange,
        singleLine = true,
        textStyle = role.style().copy(
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            textAlign = if (centered) TextAlign.Center else TextAlign.Start,
        ),
        cursorBrush = SolidColor(HcColors.Action),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        modifier = Modifier
            .fillMaxWidth()
            .focusRequester(focus)
            .onFocusChanged {
                if (it.isFocused) hadFocus = true
                else if (hadFocus) onDone()
            },
    )
}

/** src/components/StatCardIcon.tsx — the image icon when set, otherwise the Tabler icon. */
@Composable
internal fun StatCardIcon(icon: String, iconSrc: String?, size: Int = 17) {
    when {
        iconSrc != null -> HcRemoteImage(iconSrc, Modifier.size((size + 5).dp), contentScale = ContentScale.Fit)
        icon == ICON_DRUMSTICK -> StatsDrumstickIcon(size.dp)
        icon == ICON_WATER_GLASS -> StatsWaterGlassIcon(size.dp, HcColors.Black)
        else -> HcIcon(icon, size = size.dp, stroke = 2f, color = HcColors.Black)
    }
}

/**
 * The grey uncertainty line under a nutrient card (docs/DECISIONS.md
 * 2026-09-24), folded in until the arrow is tapped (or auto-expanded).
 */
@Composable
private fun CardUncertainty(card: StatCardValue, expanded: Boolean, onToggle: () -> Unit) {
    val u = card.uncertainty ?: return
    if (expanded) UncertaintyLine(u.estimated, u.tolerance, u.unit, u.digits, Modifier.padding(top = 8.dp))
    HcText(
        if (expanded) "▴" else "▾",
        HcTypeRoles.Small,
        Modifier.padding(top = 4.dp).clickable(onClick = onToggle),
        color = HcColors.Black.copy(alpha = 0.4f),
    )
}

/** src/components/ui/UncertaintyLine.tsx — "±0,5 mg  ~ 1,1 mg". */
@Composable
internal fun UncertaintyLine(estimated: Double?, tolerance: Double?, unit: String, digits: Int, modifier: Modifier = Modifier) {
    val hasEstimate = estimated != null && estimated > 0
    val hasTolerance = tolerance != null && tolerance > 0
    if (!hasEstimate && !hasTolerance) return
    val color = HcColors.Black.copy(alpha = 0.6f)
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        if (hasTolerance) HcText("±${daNumber(tolerance!!, digits)} $unit", HcTypeRoles.Small, color = color)
        if (hasTolerance && hasEstimate) HcText("  ", HcTypeRoles.Small)
        if (hasEstimate) {
            StatsUncertaintyTilde(HcTypeRoles.Small.size, small = true)
            HcText(" ${daNumber(estimated!!, digits)} $unit", HcTypeRoles.Small, color = color)
        }
    }
}
