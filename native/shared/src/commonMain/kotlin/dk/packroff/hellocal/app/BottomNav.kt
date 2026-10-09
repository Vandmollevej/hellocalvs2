package dk.packroff.hellocal.app

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectVerticalDragGestures
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.AwaitPointerEventScope
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.Navigator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.screens.food.FoodSubscription
import dk.packroff.hellocal.screens.profile.FamilyApi
import dk.packroff.hellocal.screens.profile.FamilyStatus
import dk.packroff.hellocal.screens.profile.ProfileSwitchList
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodFavoriteIcon
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.LocalCompactLandscape
import dk.packroff.hellocal.ui.ProfileIcon
import dk.packroff.hellocal.ui.ProfileVectorIcon
import dk.packroff.hellocal.ui.ProfileWaistMeasureIcon
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * src/components/BottomNav.tsx + src/lib/navigation.ts. Same items, same keys,
 * same default four (Tilføj, Madvarer, Kalender, Statistik), same stored layout
 * ("hellocal:bottomnav:v1"). Pages of four icons that slide continuously with a
 * swipe; long press (Seriøs) opens the edit panel: drag icons to reorder, drag
 * one up into the panel (or tap ×) to remove it, tap/drag a panel icon down to
 * add it. "Skift konto" (family plan only) opens the profile switcher sheet.
 */
data class NavItem(val key: String, val href: String?, val labelKey: String, val icon: String, val action: String? = null)

object NavItems {
    const val SWITCH_PROFILE_KEY = "skiftkonto"

    val all = listOf(
        NavItem("tilfoej", "/", "add", "Plus"),
        NavItem("madvarer", "/foods", "foods", "Apple"),
        NavItem("kalender", "/calendar", "calendar", "Calendar"),
        NavItem("statistik", "/statistics", "statistics", "trend"),
        NavItem("kamera", "/camera", "camera", "Camera"),
        NavItem("soeg", "/search", "search", "Search"),
        NavItem("stemme", "/voice", "voice", "Microphone"),
        NavItem("profil", "/profile", "profile", "User"),
        NavItem("favoritter", "/favorites", "favorites", "favorite"),
        NavItem("viden", "/viden-om", "knowledge", "Bulb"),
        NavItem("opskrifter", "/profile/recipes", "recipes", "Book2"),
        NavItem("status", "/profile/status", "status", "ChartLine"),
        NavItem("billeddagbog", "/profile/photo-diary", "photoDiary", "photoFrame"),
        NavItem("kropsmaal", "/profile/body-measurements", "bodyMeasurements", "waist"),
        // Only with a family plan (canSwitchProfile below).
        NavItem(SWITCH_PROFILE_KEY, null, "switchProfile", "Users", action = "switchProfile"),
    )
    val defaultActive = listOf("tilfoej", "madvarer", "kalender", "statistik")

    fun byKey(key: String): NavItem? = all.firstOrNull { it.key == key }
}

/** The user's footer layout (localStorage "hellocal:bottomnav:v1" on the web). */
object BottomNavLayout {
    private const val STORAGE_KEY = "hellocal:bottomnav:v1"

    val active = mutableStateListOf<String>()
    val inactive = mutableStateListOf<String>()
    private var loaded = false

    private val defaultInactive get() = NavItems.all.map { it.key }.filter { it !in NavItems.defaultActive }

    fun ensureLoaded() {
        if (loaded) return
        loaded = true
        val parsed = runCatching {
            NativeHooks.secureStorage.get(STORAGE_KEY)?.let { ApiJson.parseToJsonElement(it) as? JsonObject }
        }.getOrNull()
        fun list(name: String): List<String> =
            (parsed?.get(name) as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull } ?: emptyList()
        val known = NavItems.all.map { it.key }.toSet()
        val a = list("active").filter { it in known }
        val i = list("inactive").filter { it in known && it !in a }.toMutableList()
        NavItems.all.forEach { if (it.key !in a && it.key !in i) i += it.key }
        if (a.isEmpty()) setAll(NavItems.defaultActive, defaultInactive, persist = false) else setAll(a, i, persist = false)
    }

    private fun setAll(a: List<String>, i: List<String>, persist: Boolean = true) {
        active.clear()
        active.addAll(a)
        inactive.clear()
        inactive.addAll(i)
        if (persist) save()
    }

    private fun save() {
        val body = JsonObject(
            mapOf(
                "active" to JsonArray(active.map { JsonPrimitive(it) }),
                "inactive" to JsonArray(inactive.map { JsonPrimitive(it) }),
            ),
        )
        runCatching { NativeHooks.secureStorage.set(STORAGE_KEY, body.toString()) }
    }

    /** Footer roots (useFooterRootHrefs): only the hrefs that are in the bar. */
    val activeHrefs: Set<String>
        get() {
            ensureLoaded()
            return active.mapNotNull { NavItems.byKey(it)?.href }.toSet()
        }

    fun reset() = setAll(NavItems.defaultActive, defaultInactive)

    fun moveActive(key: String, target: Int) {
        val from = active.indexOf(key)
        val to = min(target, active.size - 1)
        if (from == -1 || from == to || to < 0) return
        val copy = active.toMutableList()
        copy.removeAt(from)
        copy.add(to, key)
        setAll(copy, inactive.toList())
    }

    fun removeFromActive(key: String) {
        if (key !in active) return
        setAll(active.filter { it != key }, if (key in inactive) inactive.toList() else inactive + key)
    }

    fun addToActive(key: String, at: Int? = null) {
        val copy = active.toMutableList()
        if (key !in copy) copy.add(min(at ?: copy.size, copy.size), key)
        setAll(copy, inactive.filter { it != key })
    }
}

private const val PAGE_SIZE = 4
private const val LONG_PRESS_MS = 550L
private const val FLIP_MS = 260
private const val PAGE_ANIM_MS = 220
// BottomNav.tsx: a still press (250 ms) lifts an icon in edit mode; moving first swipes the bar.
private const val EDIT_LIFT_MS = 250L
private const val AUTO_SCROLL_MAX_PAGES_PER_S = 2.4f
private const val TICK_MS = 16L
private val ICON_SIZE = 24.dp

/** An icon being dragged: from the bar (reorder/remove) or from the panel (add). */
private data class NavDrag(val key: String, val fromPanel: Boolean, val position: Offset, val moved: Boolean)

/** Edit state shared by the bar and its panel overlay (drawn above the page by AppFrame). */
private object BottomNavEdit {
    var editMode by mutableStateOf(false)
    var drag by mutableStateOf<NavDrag?>(null)
    var barBounds by mutableStateOf(Rect.Zero)
    var panelBounds by mutableStateOf(Rect.Zero)
    var scrollPages by mutableStateOf(0f)
    var swiping by mutableStateOf(false)
    var switchSheetOpen by mutableStateOf(false)
    var canSwitchProfile by mutableStateOf<Boolean?>(null)
    val panelItemBounds = mutableStateMapOf<String, Rect>()
}

/** Slot under [x] (root coordinates) on the shown page, as an index into the whole list. */
private fun slotIndexAt(x: Float): Int {
    val bar = BottomNavEdit.barBounds
    val slotWidth = bar.width / PAGE_SIZE
    val slot = floor((x - bar.left) / slotWidth).toInt().coerceIn(0, PAGE_SIZE - 1)
    return BottomNavEdit.scrollPages.roundToInt() * PAGE_SIZE + slot
}

/**
 * Index of the slot under [x] while the bar can rest between two pages:
 * the position is counted in scrolled content (BottomNav.tsx slotIndexAt).
 */
private fun slotIndexAtScrolled(x: Float): Int {
    val bar = BottomNavEdit.barBounds
    val slotWidth = bar.width / PAGE_SIZE
    return max(0, floor((x - bar.left) / slotWidth + BottomNavEdit.scrollPages * PAGE_SIZE).toInt())
}

/**
 * While a dragged icon is held near the bar's edge the bar scrolls continuously,
 * faster the closer to the edge (like dragging something to the edge of a scroller).
 */
private fun edgeScrollStep(position: Offset, dtSeconds: Float) {
    val bar = BottomNavEdit.barBounds
    if (position.y < bar.top - bar.height / 2 || position.y > bar.bottom + bar.height / 2) return
    val zone = bar.width * 0.14f
    val intoLeft = (bar.left + zone - position.x) / zone
    val intoRight = (position.x - (bar.right - zone)) / zone
    val speed = when {
        intoLeft > 0f -> -min(1f, intoLeft)
        intoRight > 0f -> min(1f, intoRight)
        else -> return
    }
    val maxScroll = (max(1, (BottomNavLayout.active.size + PAGE_SIZE - 1) / PAGE_SIZE) - 1).toFloat()
    BottomNavEdit.scrollPages = (BottomNavEdit.scrollPages + speed * AUTO_SCROLL_MAX_PAGES_PER_S * dtSeconds).coerceIn(0f, maxScroll)
}

private fun openItem(item: NavItem, navigator: Navigator) {
    if (item.action == "switchProfile") BottomNavEdit.switchSheetOpen = true
    else if (item.href != null) navigator.switchTab(Location(item.href))
}

@Composable
fun BottomNav(navigator: Navigator) {
    val t = LocalTranslator.current
    remember { BottomNavLayout.ensureLoaded() }
    val compact = LocalCompactLandscape.current
    var landscapeExpanded by remember { mutableStateOf(false) }

    // "Skift konto" exists only with a family plan or in a family; losing it moves the icon out again.
    LaunchedEffect(Unit) {
        FoodSubscription.load()
        BottomNavEdit.canSwitchProfile = FamilyApi.status()?.let { it.hasFamilyPlan || it.family != null }
    }
    LaunchedEffect(BottomNavEdit.canSwitchProfile) {
        if (BottomNavEdit.canSwitchProfile == false) BottomNavLayout.removeFromActive(NavItems.SWITCH_PROFILE_KEY)
    }

    if (compact && !landscapeExpanded) {
        // FEJLLISTE #32B: in landscape the bar starts folded to a small handle.
        Box(Modifier.fillMaxWidth().background(HcColors.Nav).padding(vertical = 4.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.width(96.dp).height(16.dp).clickable { landscapeExpanded = true }, contentAlignment = Alignment.Center) {
                Box(Modifier.width(40.dp).height(6.dp).clip(RoundedCornerShape(50)).background(HcColors.Black.copy(alpha = 0.3f)))
            }
        }
    } else {
        Column(Modifier.fillMaxWidth().background(HcColors.Nav)) {
            if (compact) {
                Box(Modifier.fillMaxWidth().height(14.dp).clickable { landscapeExpanded = false }, contentAlignment = Alignment.Center) {
                    Box(Modifier.width(40.dp).height(6.dp).clip(RoundedCornerShape(50)).background(HcColors.Black.copy(alpha = 0.3f)))
                }
            }
            NavBar(navigator)
        }
    }

    if (BottomNavEdit.switchSheetOpen) SwitchProfileSheet(t.t("nav.switchProfile"))
}

@Composable
private fun NavBar(navigator: Navigator) {
    val serious = FoodSubscription.isSerious == true
    val keys = BottomNavLayout.active.toList()
    val pageCount = max(1, (keys.size + PAGE_SIZE - 1) / PAGE_SIZE)
    val maxScroll = (pageCount - 1).toFloat()
    val drag = BottomNavEdit.drag
    val draggingOverPanel = drag != null && drag.moved && !drag.fromPanel && BottomNavEdit.panelBounds.contains(drag.position)

    BoxWithConstraints(
        Modifier.fillMaxWidth()
            .padding(top = 8.dp, bottom = 4.dp)
            .let { if (draggingOverPanel) it.border(1.dp, HcColors.GrayDark) else it }
            .onGloballyPositioned { BottomNavEdit.barBounds = it.boundsInRoot() },
    ) {
        val w = maxWidth
        val density = LocalDensity.current
        val widthPx = with(density) { w.toPx() }
        val slotPx = widthPx / PAGE_SIZE
        val scroll = BottomNavEdit.scrollPages
        val shownScroll by animateFloatAsState(
            if (BottomNavEdit.swiping || drag?.moved == true) scroll else scroll.coerceIn(0f, maxScroll),
            tween(if (BottomNavEdit.swiping || drag?.moved == true) 0 else PAGE_ANIM_MS),
        )
        // The gesture must survive reorders mid-drag, so it reads the latest values instead of restarting.
        val latestKeys by rememberUpdatedState(keys)
        val latestSerious by rememberUpdatedState(serious)
        val latestPageCount by rememberUpdatedState(pageCount)
        Box(
            Modifier.fillMaxWidth().height(60.dp).clipToBounds().pointerInput(widthPx) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val bar = BottomNavEdit.barBounds
                    val serious = latestSerious
                    val pageCount = latestPageCount
                    val maxScroll = (pageCount - 1).toFloat()
                    val index = slotIndexAt(bar.left + down.position.x)
                    val key = latestKeys.getOrNull(index)
                    val item = key?.let { NavItems.byKey(it) }
                    val slop = viewConfiguration.touchSlop
                    val start = down.position

                    // Edit mode: × in the item's top-right corner removes it; anything else drags it.
                    if (BottomNavEdit.editMode) {
                        if (key == null) {
                            if (pageCount > 1) swipeBar(down.id, start, widthPx, maxScroll)
                            return@awaitEachGesture
                        }
                        val slotLeft = (index % PAGE_SIZE) * slotPx
                        val itemRight = slotLeft + slotPx / 2 + with(density) { 32.dp.toPx() }
                        val onCross = start.y < with(density) { 18.dp.toPx() } && abs(start.x - itemRight) < with(density) { 14.dp.toPx() }
                        if (onCross) {
                            val up = awaitDragOrUp(down.id)
                            if (up) BottomNavLayout.removeFromActive(key)
                            return@awaitEachGesture
                        }
                        // A still press lifts the icon; moving first is a swipe that scrolls the bar.
                        val outcome = withTimeoutOrNull(EDIT_LIFT_MS) { awaitUpOrMove(down.id, start, slop) }
                        when (outcome) {
                            "move" -> if (pageCount > 1) swipeBar(down.id, start, widthPx, maxScroll)
                            null -> trackBarDrag(key, down.id, start, bar, slop)
                        }
                        return@awaitEachGesture
                    }

                    // Normal mode: tap opens, horizontal swipe pages, long press (Seriøs) edits.
                    // null = the finger was held for LONG_PRESS_MS without moving.
                    val result: String? = withTimeoutOrNull(LONG_PRESS_MS) { awaitUpOrMove(down.id, start, slop) }
                    when {
                        result == "up" -> {
                            if (item != null) openItem(item, navigator)
                        }
                        result == "move" -> {
                            if (pageCount <= 1) return@awaitEachGesture
                            swipeBar(down.id, start, widthPx, maxScroll)
                        }
                        result == null -> {
                            // Long press. Free: release navigates like a tap.
                            if (!serious || key == null) {
                                if (awaitDragOrUp(down.id) && item != null) openItem(item, navigator)
                            } else {
                                BottomNavEdit.editMode = true
                                trackBarDrag(key, down.id, start, bar, slop)
                            }
                        }
                    }
                }
            },
        ) {
            keys.forEachIndexed { index, itemKey ->
                key(itemKey) {
                    val item = NavItems.byKey(itemKey)
                    // FLIP: an icon whose place changes glides to its new slot.
                    val baseX by animateFloatAsState((index / PAGE_SIZE) * widthPx + (index % PAGE_SIZE) * slotPx, tween(FLIP_MS))
                    val isPlaceholder = drag != null && drag.moved && !drag.fromPanel && drag.key == itemKey
                    val itemWidthPx = with(density) { 64.dp.toPx() }
                    if (item != null) {
                        Box(Modifier.offset { IntOffset((baseX - shownScroll * widthPx + (slotPx - itemWidthPx) / 2).roundToInt(), 0) }) {
                            NavButton(item, navigator.current.path == item.href, BottomNavEdit.editMode, isPlaceholder)
                        }
                    }
                }
            }
        }
    }
}

/** "up" when the finger lifts, "move" once it travels further than [slop]; cancelled counts as "up". */
private suspend fun AwaitPointerEventScope.awaitUpOrMove(id: PointerId, start: Offset, slop: Float): String {
    while (true) {
        val event = awaitPointerEvent()
        val change = event.changes.firstOrNull { it.id == id }
        if (change == null || !change.pressed) return "up"
        val delta = change.position - start
        if (delta.getDistance() > slop) return "move"
    }
}

/** Continuous paging that follows the finger and stays where released (FEJLLISTE #7). */
private suspend fun AwaitPointerEventScope.swipeBar(id: PointerId, start: Offset, widthPx: Float, maxScroll: Float) {
    BottomNavEdit.swiping = true
    val startScroll = BottomNavEdit.scrollPages.coerceIn(0f, maxScroll)
    while (true) {
        val event = awaitPointerEvent()
        val change = event.changes.firstOrNull { it.id == id } ?: break
        if (!change.pressed) break
        change.consume()
        var next = startScroll + (start.x - change.position.x) / widthPx
        if (next < 0f) next *= 0.3f else if (next > maxScroll) next = maxScroll + (next - maxScroll) * 0.3f
        BottomNavEdit.scrollPages = next
    }
    BottomNavEdit.scrollPages = BottomNavEdit.scrollPages.coerceIn(0f, maxScroll)
    BottomNavEdit.swiping = false
}

/** Waits for the finger to lift; false when the pointer was cancelled. */
private suspend fun AwaitPointerEventScope.awaitDragOrUp(id: PointerId): Boolean {
    while (true) {
        val event = awaitPointerEvent()
        val change = event.changes.firstOrNull { it.id == id } ?: return false
        if (!change.pressed) return true
    }
}

/** Drags a bar icon: reorders while over the bar, removes it when dropped in the panel. */
private suspend fun AwaitPointerEventScope.trackBarDrag(
    key: String,
    id: PointerId,
    start: Offset,
    bar: Rect,
    slop: Float,
) {
    var moved = false
    var position = Offset(bar.left + start.x, bar.top + start.y)
    BottomNavEdit.drag = NavDrag(key, fromPanel = false, position = position, moved = false)
    while (true) {
        // Ticks even while the finger rests, so the bar keeps scrolling at the edge.
        val event = withTimeoutOrNull(TICK_MS) { awaitPointerEvent() }
        val change = event?.changes?.firstOrNull { it.id == id }
        if (event != null && change == null) break
        if (change != null && !change.pressed) break
        if (change != null) {
            if (!moved && (change.position - start).getDistance() > slop) moved = true
            if (moved) {
                change.consume()
                position = Offset(bar.left + change.position.x, bar.top + change.position.y)
            }
        }
        if (!moved) continue
        edgeScrollStep(position, TICK_MS / 1000f)
        BottomNavEdit.drag = NavDrag(key, fromPanel = false, position = position, moved = true)
        // Only while the finger is over the bar do the others make room.
        if (bar.contains(position)) BottomNavLayout.moveActive(key, slotIndexAtScrolled(position.x))
    }
    if (moved && BottomNavEdit.panelBounds.contains(position)) BottomNavLayout.removeFromActive(key)
    BottomNavEdit.drag = null
}

@Composable
private fun NavIcon(item: NavItem, color: Color, size: Dp = ICON_SIZE) {
    when (item.icon) {
        "trend" -> TrendIcon(color, size.value.roundToInt())
        "favorite" -> FoodFavoriteIcon(false, size, color)
        "photoFrame" -> ProfileIcon(ProfileVectorIcon.PhotoFrame, size, color, stroke = 1.6f)
        "waist" -> ProfileWaistMeasureIcon(null, size, color)
        else -> HcIcon(item.icon, size = size, color = color, stroke = 1.6f)
    }
}

@Composable
private fun NavButton(item: NavItem, active: Boolean, editMode: Boolean, isPlaceholder: Boolean) {
    val t = LocalTranslator.current
    val color = if (active) HcColors.Action else HcColors.TextSecondary
    val shape = RoundedCornerShape(12.dp)
    // .hf-nav-jiggle: ±1.4° every 0.16 s while editing.
    val jiggle = if (editMode && !isPlaceholder) {
        val transition = rememberInfiniteTransition()
        val angle by transition.animateFloat(-1.4f, 1.4f, infiniteRepeatable(tween(160), RepeatMode.Reverse))
        angle
    } else {
        0f
    }
    Box(
        Modifier.width(64.dp).height(56.dp).rotate(jiggle).clip(shape)
            .let { if (editMode || isPlaceholder) it.border(1.dp, if (isPlaceholder) HcColors.GrayDark else HcColors.TanDark, shape) else it },
    ) {
        Column(
            Modifier.fillMaxSize().alpha(if (isPlaceholder) 0f else 1f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        ) {
            NavIcon(item, color)
            HcText(t.t("nav.${item.labelKey}"), HcTypeRoles.Tab, color = color, maxLines = 1)
        }
        if (editMode && !isPlaceholder) {
            Box(
                Modifier.align(Alignment.TopEnd).size(20.dp).clip(CircleShape).background(HcColors.Black),
                contentAlignment = Alignment.Center,
            ) { HcIcon("X", size = 13.dp, stroke = 2.2f, color = HcColors.Tan) }
        }
    }
}

/**
 * The edit panel above the bar (the web's absolute "bottom-full" panel), the
 * dimmed page behind it and the dragged icon. AppFrame draws this on top of
 * the page so it can overlap the content like on the web.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BottomNavEditOverlay() {
    val drag = BottomNavEdit.drag
    if (!BottomNavEdit.editMode && drag == null) return
    val t = LocalTranslator.current
    val density = LocalDensity.current
    var rootBounds by remember { mutableStateOf(Rect.Zero) }
    var sheetOffset by remember { mutableStateOf(0f) }
    val bar = BottomNavEdit.barBounds
    val canSwitch = BottomNavEdit.canSwitchProfile == true
    val visibleInactive = BottomNavLayout.inactive.filter { canSwitch || it != NavItems.SWITCH_PROFILE_KEY }
    fun close() {
        BottomNavEdit.editMode = false
        sheetOffset = 0f
    }

    Box(Modifier.fillMaxSize().onGloballyPositioned { rootBounds = it.boundsInRoot() }) {
        if (BottomNavEdit.editMode) {
            val aboveBar = with(density) { (bar.top - rootBounds.top).coerceAtLeast(0f).toDp() }
            val belowBar = with(density) { (rootBounds.bottom - bar.top).coerceAtLeast(0f).toDp() }
            // Dims the page (not the bar, which stays editable); a tap closes the panel.
            Box(Modifier.fillMaxWidth().height(aboveBar).background(HcColors.Black.copy(alpha = 0.1f)).clickable { close() })
            val draggedOverBar = drag != null && drag.moved && drag.fromPanel && bar.contains(drag.position)
            val panelShape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
            Column(
                Modifier.align(Alignment.BottomCenter).padding(bottom = belowBar).fillMaxWidth()
                    .offset { IntOffset(0, sheetOffset.roundToInt()) }
                    .clip(panelShape).background(HcColors.Tan, panelShape)
                    .border(1.dp, if (draggedOverBar) HcColors.GrayDark else HcColors.TanDark, panelShape)
                    .onGloballyPositioned { BottomNavEdit.panelBounds = it.boundsInRoot() }
                    .padding(start = 16.dp, end = 16.dp, bottom = 16.dp, top = 8.dp),
            ) {
                // Grab line: drag down past 60 px to close.
                Box(
                    Modifier.fillMaxWidth().height(20.dp).pointerInput(Unit) {
                        detectVerticalDragGestures(
                            onDragEnd = {
                                if (sheetOffset > with(density) { 60.dp.toPx() }) close()
                                sheetOffset = 0f
                            },
                            onDragCancel = { sheetOffset = 0f },
                        ) { change, amount ->
                            change.consume()
                            sheetOffset = max(0f, sheetOffset + amount)
                        }
                    },
                    contentAlignment = Alignment.Center,
                ) { Box(Modifier.width(40.dp).height(6.dp).clip(RoundedCornerShape(50)).background(HcColors.Black.copy(alpha = 0.3f))) }
                Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    HcText("Træk et ikon ned i menuen", HcTypeRoles.Small, Modifier.weight(1f), bold = true, color = HcColors.Action)
                    HcText("Færdig", HcTypeRoles.Small, Modifier.clickable { close() }, bold = true, color = HcColors.Brand)
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    visibleInactive.forEach { itemKey ->
                        key(itemKey) {
                            val item = NavItems.byKey(itemKey)
                            if (item != null) PanelItem(item, drag)
                        }
                    }
                }
                if (visibleInactive.isEmpty()) HcText(t.t("nav.allIconsInUse"), HcTypeRoles.Small, color = HcColors.TextSecondary)
                Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.End) {
                    Box(Modifier.size(44.dp).clip(CircleShape).clickable {
                        BottomNavLayout.reset()
                        BottomNavEdit.scrollPages = 0f
                    }, contentAlignment = Alignment.Center) {
                        HcIcon("Refresh", size = 20.dp, color = HcColors.Black, contentDescription = t.t("nav.resetMenuAriaLabel"))
                    }
                }
            }
        }
        // The dragged icon follows the finger.
        if (drag != null && drag.moved) {
            val item = NavItems.byKey(drag.key)
            if (item != null) {
                DragGhost(item, drag.position, rootBounds)
            }
        }
    }
}

/** The lifted icon: grows a little as it leaves its place and follows the finger. */
@Composable
private fun DragGhost(item: NavItem, position: Offset, rootBounds: Rect) {
    val density = LocalDensity.current
    var lifted by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { lifted = true }
    val scale by animateFloatAsState(if (lifted) 1.18f else 1f, tween(140))
    val shape = RoundedCornerShape(12.dp)
    with(density) {
        Box(
            Modifier.offset { IntOffset((position.x - rootBounds.left - 32.dp.toPx()).roundToInt(), (position.y - rootBounds.top - 28.dp.toPx()).roundToInt()) }
                .width(64.dp).height(56.dp)
                .graphicsLayer { scaleX = scale; scaleY = scale; shadowElevation = 8.dp.toPx(); this.shape = shape; clip = false }
                .background(HcColors.TanDark, shape)
                .alpha(0.95f),
            contentAlignment = Alignment.Center,
        ) { NavIcon(item, HcColors.Black) }
    }
}

/** A hidden icon in the panel: tap adds it at the end, drag drops it into a bar slot. */
@Composable
private fun PanelItem(item: NavItem, drag: NavDrag?) {
    val t = LocalTranslator.current
    var bounds by remember { mutableStateOf(Rect.Zero) }
    val isPlaceholder = drag != null && drag.moved && drag.fromPanel && drag.key == item.key
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier.height(64.dp).widthIn(min = 64.dp).clip(shape)
            .background(if (isPlaceholder) Color.Transparent else HcColors.TanDark, shape)
            .border(1.dp, if (isPlaceholder) HcColors.GrayDark else HcColors.TanDark, shape)
            .onGloballyPositioned { bounds = it.boundsInRoot() }
            .pointerInput(item.key) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    val slop = viewConfiguration.touchSlop
                    var moved = false
                    var position = Offset(bounds.left + down.position.x, bounds.top + down.position.y)
                    BottomNavEdit.drag = NavDrag(item.key, fromPanel = true, position = position, moved = false)
                    while (true) {
                        val event = withTimeoutOrNull(TICK_MS) { awaitPointerEvent() }
                        val change = event?.changes?.firstOrNull { it.id == down.id }
                        if (event != null && change == null) break
                        if (change != null && !change.pressed) break
                        if (change != null) {
                            if (!moved && (change.position - down.position).getDistance() > slop) moved = true
                            if (moved) {
                                change.consume()
                                position = Offset(bounds.left + change.position.x, bounds.top + change.position.y)
                            }
                        }
                        if (!moved) continue
                        edgeScrollStep(position, TICK_MS / 1000f)
                        BottomNavEdit.drag = NavDrag(item.key, fromPanel = true, position = position, moved = true)
                    }
                    BottomNavEdit.drag = null
                    when {
                        !moved -> BottomNavLayout.addToActive(item.key)
                        BottomNavEdit.barBounds.contains(position) -> BottomNavLayout.addToActive(item.key, slotIndexAtScrolled(position.x))
                    }
                }
            }
            .padding(horizontal = 4.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
    ) {
        Column(Modifier.alpha(if (isPlaceholder) 0f else 1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            NavIcon(item, HcColors.Black)
            HcText(t.t("nav.${item.labelKey}"), HcTypeRoles.Micro, color = HcColors.Action, align = TextAlign.Center, maxLines = 1)
        }
    }
}

/** "Skift konto": the profile switcher in a bottom sheet. */
@Composable
private fun SwitchProfileSheet(title: String) {
    var status by remember { mutableStateOf<FamilyStatus?>(null) }
    LaunchedEffect(Unit) { status = FamilyApi.status() }
    HcBottomSheet(onDismiss = { BottomNavEdit.switchSheetOpen = false }, title = title) {
        status?.let { current ->
            ProfileSwitchList(current, onStatusChange = { status = it }, onDone = { BottomNavEdit.switchSheetOpen = false })
        }
    }
}

/** TrendIcon in BottomNav.tsx (polyline 2,19 9,12 14,15 22,3 with dots). */
@Composable
fun TrendIcon(color: Color, size: Int = 24) {
    Canvas(Modifier.size(size.dp)) {
        val s = this.size.width / 24f
        val pts = listOf(Offset(2f, 19f), Offset(9f, 12f), Offset(14f, 15f), Offset(22f, 3f)).map { Offset(it.x * s, it.y * s) }
        val path = Path().apply {
            moveTo(pts[0].x, pts[0].y)
            pts.drop(1).forEach { lineTo(it.x, it.y) }
        }
        drawPath(path, color, style = Stroke(width = 1.6f * s, cap = StrokeCap.Round, join = StrokeJoin.Round))
        listOf(pts[0], pts[2], pts[3]).forEach { drawCircle(color, radius = 1.6f * s, center = it) }
    }
}
