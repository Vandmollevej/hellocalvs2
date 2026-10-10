package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import dk.packroff.hellocal.api.ApiJson
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.RouteArgs
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.FoodImage
import dk.packroff.hellocal.ui.FoodListCard
import dk.packroff.hellocal.ui.FoodProfileCircle
import dk.packroff.hellocal.ui.FoodProfileTone
import dk.packroff.hellocal.ui.HcBottomSheet
import dk.packroff.hellocal.ui.FoodScrollSheet
import dk.packroff.hellocal.ui.HcScreen
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlinx.serialization.Serializable

// src/components/add/AddMenuList.tsx, AddMenuSheet.tsx and src/app/add/menu/page.tsx.

private data class AddTile(val key: String, val href: String, val icon: String, val requiresCycleTracking: Boolean = false)

private val TILES = listOf(
    AddTile("food", "/search", "/icons/add/food.webp"),
    AddTile("scan", "/camera?mode=product", "/icons/add/scan.webp"),
    AddTile("platePhoto", "/camera?mode=meal", "/icons/add/plate-photo.webp"),
    AddTile("dish", "/create-dish", "/icons/add/dish.webp"),
    AddTile("voice", "/voice", "/icons/add/voice.webp"),
    AddTile("weight", "/weight/create", "/icons/add/weight.webp"),
    AddTile("drink", "/water/create", "/icons/add/drink.webp"),
    AddTile("body", "/profile/body-measurements", "/icons/add/body.webp"),
    AddTile("activity", "/activity/create", "/icons/activity-3d.png"),
    AddTile("period", "/period/create", "/icons/add/period.svg", requiresCycleTracking = true),
    // Last (owner's choice 2026-10-09): fill in a screening.
    AddTile("screenings", "/profile/screenings?fill=1", "/icons/add/screenings.svg"),
)

private val TILE_KEYS = TILES.map { it.key }

@Serializable
private data class AddMenuLayout(val order: List<String> = emptyList(), val hidden: List<String> = emptyList())

/** src/lib/add-menu-layout.ts — order + hidden tiles per device (same storage key as the web). */
private object AddMenuLayoutStore {
    fun normalize(layout: AddMenuLayout): AddMenuLayout {
        val hidden = layout.hidden.filter { it in TILE_KEYS }.distinct()
        val order = layout.order.filter { it in TILE_KEYS }.distinct().toMutableList()
        for (key in TILE_KEYS) if (key !in order) order += key
        return AddMenuLayout(order, hidden)
    }

    fun load(): AddMenuLayout = FoodPrefs.get(FoodPrefs.ADD_MENU_LAYOUT_KEY)
        ?.let { runCatching { ApiJson.decodeFromString(AddMenuLayout.serializer(), it) }.getOrNull() }
        ?.let(::normalize) ?: AddMenuLayout(TILE_KEYS, emptyList())

    fun save(layout: AddMenuLayout) = FoodPrefs.set(FoodPrefs.ADD_MENU_LAYOUT_KEY, ApiJson.encodeToString(AddMenuLayout.serializer(), layout))
}

/** Native port of src/app/add/menu/page.tsx. */
@Composable
fun AddMenuScreen(args: RouteArgs) {
    val t = LocalTranslator.current
    HcScreen(t.t("addMenu.title")) {
        AddMenuList(date = args.opt("date"), time = args.opt("time"))
    }
}

/** src/components/add/AddMenuSheet.tsx — the add menu in a bottom sheet. */
@Composable
fun AddMenuSheet(onClose: () -> Unit, date: String? = null, time: String? = null) {
    val t = LocalTranslator.current
    FoodScrollSheet(onDismiss = onClose, title = t.t("addMenu.title")) {
        AddMenuList(date = date, time = time, onNavigate = onClose)
    }
}

/**
 * The tiles of the add menu. Long press (Seriøs) enters edit mode: drag to
 * reorder, × to hide, "Tilføj" brings hidden tiles back.
 */
@Composable
fun AddMenuList(date: String?, time: String?, onNavigate: () -> Unit = {}) {
    val t = LocalTranslator.current
    val nav = LocalNavigator.current
    val density = LocalDensity.current.density
    var layout by remember { mutableStateOf(AddMenuLayoutStore.load()) }
    var editMode by remember { mutableStateOf(false) }
    var addSheetOpen by remember { mutableStateOf(false) }
    var dragKey by remember { mutableStateOf<String?>(null) }
    var dragPos by remember { mutableStateOf(Offset.Zero) }
    var containerTopLeft by remember { mutableStateOf(Offset.Zero) }
    val tileRects = remember { mutableStateMapOf<String, Rect>() }

    LaunchedEffect(Unit) {
        if (FoodProfile.user == null) FoodProfile.refresh()
        FoodSubscription.load()
    }
    val isSerious = FoodSubscription.isSerious == true
    val showPeriod = AddActions.visible(FoodProfile.user).any { it.key == "menstrualCycle" }
    val available = TILES.filter { !it.requiresCycleTracking || showPeriod }
    val byKey = available.associateBy { it.key }
    val shown = layout.order.filter { it !in layout.hidden && it in byKey }
    val hiddenTiles = layout.hidden.filter { it in byKey }

    fun commit(next: AddMenuLayout) {
        layout = next
        AddMenuLayoutStore.save(next)
    }

    fun withContext(href: String): String {
        val parts = listOfNotNull(date?.let { "date=${Location.encode(it)}" }, time?.let { "time=${Location.encode(it)}" })
        if (parts.isEmpty()) return href
        return href + (if (href.contains("?")) "&" else "?") + parts.joinToString("&")
    }

    Box(Modifier.fillMaxWidth().onGloballyPositioned { containerTopLeft = it.boundsInRoot().topLeft }) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        FoodMealShareBar()
        if (editMode) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                HcText(t.t("addMenu.editDone"), HcTypeRoles.Small, Modifier.heightIn(min = 32.dp).clickable { editMode = false }.padding(vertical = 6.dp), color = HcColors.Green, bold = true)
                Box(Modifier.weight(1f))
                Row(
                    Modifier.heightIn(min = 32.dp).clickable { addSheetOpen = true },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    HcIcon("Plus", size = 14.dp, color = HcColors.Black, stroke = 2.5f)
                    HcText(t.t("addMenu.editAdd"), HcTypeRoles.Small, color = HcColors.Black, bold = true)
                }
            }
        }
        FoodListCard {
            Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                shown.chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { key ->
                            val tile = byKey.getValue(key)
                            val label = t.t("addMenu.${tile.key}")
                            val placeholder = dragKey == key
                            val shape = RoundedCornerShape(HcDimens.RadiusCard)
                            Box(
                                Modifier
                                    .weight(1f)
                                    .onGloballyPositioned { tileRects[key] = it.boundsInRoot() }
                                    .clip(shape)
                                    .let { m ->
                                        if (editMode) m.border(1.dp, if (placeholder) HcColors.GrayDark else HcColors.TanDark, shape) else m
                                    }
                                    .pointerInput(editMode, isSerious, shown) {
                                        detectDragGesturesAfterLongPress(
                                            onDragStart = { offset ->
                                                if (!editMode && !isSerious) return@detectDragGesturesAfterLongPress
                                                editMode = true
                                                dragKey = key
                                                dragPos = (tileRects[key]?.topLeft ?: Offset.Zero) + offset
                                            },
                                            onDragEnd = { dragKey = null },
                                            onDragCancel = { dragKey = null },
                                        ) { change, amount ->
                                            val current = dragKey ?: return@detectDragGesturesAfterLongPress
                                            change.consume()
                                            dragPos += amount
                                            val over = tileRects.entries.firstOrNull { (k, r) -> k != current && k in layout.order && r.contains(dragPos) }?.key
                                                ?: return@detectDragGesturesAfterLongPress
                                            val order = layout.order.toMutableList()
                                            val from = order.indexOf(current)
                                            val to = order.indexOf(over)
                                            if (from < 0 || to < 0 || from == to) return@detectDragGesturesAfterLongPress
                                            order.removeAt(from)
                                            order.add(to, current)
                                            commit(layout.copy(order = order))
                                        }
                                    }
                                    .let { m ->
                                        if (editMode) m else m.clickable {
                                            onNavigate()
                                            nav.push(withContext(tile.href))
                                        }
                                    }
                                    .padding(8.dp),
                                contentAlignment = Alignment.TopCenter,
                            ) {
                                Column(
                                    Modifier.fillMaxWidth().alpha(if (placeholder) 0f else 1f),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    FoodImage(tile.icon, Modifier.size(96.dp))
                                    HcText(label, HcTypeRoles.Body, align = TextAlign.Center)
                                }
                                if (editMode) {
                                    Box(
                                        Modifier.align(Alignment.TopEnd).size(24.dp).clip(CircleShape).background(HcColors.Black)
                                            .clickable { commit(layout.copy(hidden = layout.hidden + key)) },
                                        contentAlignment = Alignment.Center,
                                    ) { HcIcon("X", size = 14.dp, color = HcColors.Tan, stroke = 2.2f) }
                                }
                            }
                        }
                        if (row.size == 1) Box(Modifier.weight(1f))
                    }
                }
            }
        }
    }

    // The tile following the finger while dragging.
    val dragged = dragKey?.let { byKey[it] }
    if (dragged != null) {
        Box(
            Modifier
                .zIndex(10f)
                .offset(x = ((dragPos.x - containerTopLeft.x) / density - 48).dp, y = ((dragPos.y - containerTopLeft.y) / density - 48).dp)
                .size(96.dp)
                .alpha(0.9f),
        ) { FoodImage(dragged.icon, Modifier.size(96.dp)) }
    }
    }

    if (addSheetOpen) {
        HcBottomSheet(onDismiss = { addSheetOpen = false }, title = t.t("addMenu.editAddTitle")) {
            if (hiddenTiles.isEmpty()) {
                HcText(t.t("addMenu.editNoneHidden"), HcTypeRoles.Body, color = HcColors.TextSecondary)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    hiddenTiles.chunked(2).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { key ->
                                val tile = byKey.getValue(key)
                                Column(
                                    Modifier.weight(1f).clip(RoundedCornerShape(HcDimens.RadiusCard)).clickable {
                                        commit(layout.copy(hidden = layout.hidden.filter { it != key }))
                                        addSheetOpen = false
                                    }.padding(8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    FoodImage(tile.icon, Modifier.size(96.dp))
                                    HcText(t.t("addMenu.${tile.key}"), HcTypeRoles.Body, align = TextAlign.Center)
                                }
                            }
                            if (row.size == 1) Box(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// src/components/family/MealShareBar.tsx — "Til: Mig · Emma · Oscar".

private fun formatFactor(factor: Double): String {
    val whole = kotlin.math.floor(factor).toInt()
    val rest = factor - whole
    val fraction = when (rest) {
        0.25 -> "¼"
        0.5 -> "½"
        0.75 -> "¾"
        else -> ""
    }
    return if (whole == 0) fraction else "$whole$fraction"
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun FoodMealShareBar() {
    val t = LocalTranslator.current
    val status = FoodFamily.status ?: return
    val others = status.profiles.filter { it.id != status.activeProfile.id && it.canWrite }
    LaunchedEffect(others.map { it.id }) {
        val allowed = others.map { it.id }.toSet()
        if (MealShare.targets.any { it.profileId !in allowed }) MealShare.update(MealShare.targets.filter { it.profileId in allowed })
    }
    if (others.isEmpty()) return
    var choosingFor by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxWidth()) {
        HcText(t.t("family.share.title"), HcTypeRoles.Body, Modifier.padding(bottom = 8.dp))
        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier.height(40.dp).clip(RoundedCornerShape(50)).background(HcColors.Black).padding(start = 4.dp, end = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FoodProfileCircle(status.activeProfile.displayName, tone = FoodProfileTone.Card)
                HcText(if (status.activeProfile.id == status.me.id) t.t("family.share.me") else status.activeProfile.displayName, HcTypeRoles.Body, color = HcColors.White)
                HcIcon("Check", size = 16.dp, color = HcColors.White)
            }
            others.forEach { profile ->
                val selected = MealShare.targets.any { it.profileId == profile.id }
                val shape = RoundedCornerShape(50)
                Row(
                    Modifier.height(40.dp).clip(shape)
                        .let { if (selected) it.background(HcColors.SelectedBg).border(2.dp, HcColors.SelectedBorder, shape) else it.background(HcColors.Cream).border(1.dp, HcColors.GrayBorder, shape) }
                        .clickable {
                            MealShare.update(
                                if (selected) MealShare.targets.filter { it.profileId != profile.id }
                                else MealShare.targets + MealShareTarget(profile.id, 1.0),
                            )
                        }
                        .padding(start = 4.dp, end = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FoodProfileCircle(profile.displayName, tone = FoodProfileTone.Card)
                    HcText(profile.displayName.split(" ").first(), HcTypeRoles.Body, color = HcColors.Black)
                    if (selected) HcIcon("Check", size = 16.dp, color = HcColors.Black)
                }
            }
        }
        if (MealShare.targets.isNotEmpty()) {
            Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HcText(t.t("family.share.portionHelp"), HcTypeRoles.Caption, color = HcColors.TextSecondary)
                MealShare.targets.forEach { target ->
                    val profile = others.firstOrNull { it.id == target.profileId } ?: return@forEach
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        HcText(t.t("family.share.portionFor", "name" to profile.displayName), HcTypeRoles.Body, Modifier.weight(1f))
                        Row(
                            Modifier.height(40.dp).clip(RoundedCornerShape(HcDimens.RadiusCard)).background(HcColors.Cream)
                                .border(1.dp, HcColors.GrayBorder, RoundedCornerShape(HcDimens.RadiusCard))
                                .clickable { choosingFor = target.profileId }.padding(horizontal = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            HcText(t.t("family.share.portionOption", "factor" to formatFactor(target.factor)), HcTypeRoles.Body)
                            HcIcon("ChevronDown", size = 16.dp, color = HcColors.Black)
                        }
                    }
                }
            }
        }
    }

    choosingFor?.let { profileId ->
        HcBottomSheet(onDismiss = { choosingFor = null }) {
            MealShare.PORTION_FACTORS.forEach { factor ->
                val current = MealShare.targets.firstOrNull { it.profileId == profileId }?.factor == factor
                Row(
                    Modifier.fillMaxWidth().height(48.dp).clickable {
                        MealShare.update(MealShare.targets.map { if (it.profileId == profileId) it.copy(factor = factor) else it })
                        choosingFor = null
                    },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HcText(t.t("family.share.portionOption", "factor" to formatFactor(factor)), HcTypeRoles.Body, Modifier.weight(1f), bold = current)
                    if (current) HcIcon("Check", size = 18.dp, color = HcColors.Black)
                }
            }
        }
    }
}
