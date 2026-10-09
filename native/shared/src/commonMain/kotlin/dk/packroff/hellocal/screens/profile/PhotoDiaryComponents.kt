package dk.packroff.hellocal.screens.profile

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PageSize
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.ProfileBytesImage
import dk.packroff.hellocal.ui.ProfileEllipsisText
import dk.packroff.hellocal.ui.ProfileFullScreenLayer
import dk.packroff.hellocal.ui.ProfilePhotoCheck
import dk.packroff.hellocal.ui.ProfileTextButton
import dk.packroff.hellocal.ui.icons.HcIcon

// src/components/photo-diary/* — carousel, full-screen viewer and before/after.

private const val CARD_WIDTH_FRACTION = 160f / 361f
private const val CARD_ASPECT = 160f / 333f
private const val LOOP_REPEAT = 1000

/**
 * PhotoCarousel.tsx — horizontal carousel, oldest left and newest right
 * (the HelloFresh "Kogebog" geometry: the middle card whole, neighbours
 * partly visible). With 3+ photos it loops.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PhotoCarousel(
    photos: List<DiaryPhoto>,
    index: Int,
    onIndexChange: (Int) -> Unit,
    onOpen: (Int) -> Unit,
    selectedId: String?,
    onSelect: ((Int) -> Unit)?,
) {
    val t = LocalTranslator.current
    val count = photos.size
    if (count == 0) return
    val loop = count >= 3
    val pageCount = if (loop) count * LOOP_REPEAT else count
    val pagerState = rememberPagerState(initialPage = if (loop) count * (LOOP_REPEAT / 2) + index else index) { pageCount }
    val currentOnIndexChange by rememberUpdatedState(onIndexChange)

    // Swiping changes the middle photo.
    LaunchedEffect(pagerState, count) {
        snapshotFlow { pagerState.settledPage }.collect { page ->
            val photoIndex = wrapIndex(page, count)
            currentOnIndexChange(photoIndex)
        }
    }
    // A change from outside (viewer, delete, new photo) moves the middle to the nearest place with that photo.
    LaunchedEffect(index, count) {
        val currentIndex = wrapIndex(pagerState.currentPage, count)
        if (currentIndex == index) return@LaunchedEffect
        var delta = index - currentIndex
        if (loop && delta > count / 2) delta -= count
        if (loop && delta < -count / 2) delta += count
        val target = if (loop) pagerState.currentPage + delta else index
        pagerState.animateScrollToPage(target.coerceIn(0, pageCount - 1))
    }

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val cardWidth = maxWidth * CARD_WIDTH_FRACTION
        val side = (maxWidth - cardWidth) / 2
        HorizontalPager(
            state = pagerState,
            pageSize = PageSize.Fixed(cardWidth),
            pageSpacing = 16.dp,
            contentPadding = PaddingValues(horizontal = side),
            beyondViewportPageCount = 2,
            modifier = Modifier.fillMaxWidth(),
        ) { page ->
            val photoIndex = wrapIndex(page, count)
            val photo = photos[photoIndex]
            val selected = photo.id == selectedId
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.fillMaxWidth().aspectRatio(CARD_ASPECT)) {
                    val shape = RoundedCornerShape(16.dp)
                    Box(Modifier.fillMaxSize().clip(shape).background(HcColors.Tan, shape).clickable { onOpen(photoIndex) }) {
                        ProfileBytesImage(photo.bytes, Modifier.fillMaxSize(), contentDescription = "${t.t("photoDiary.photoAlt")}, ${formatPhotoDay(photo.takenAt)}")
                    }
                    if (onSelect != null && count >= 2) {
                        ProfilePhotoCheck(selected, if (selected) 1 else null, onToggle = { onSelect(photoIndex) }, modifier = Modifier.align(Alignment.TopEnd))
                    }
                }
                Column {
                    ProfileEllipsisText(formatPhotoDay(photo.takenAt), HcTypeRoles.CardTitle)
                    HcText("${t.t("common.clockPrefix")} ${formatPhotoTime(photo.takenAt)}", HcTypeRoles.Caption)
                }
            }
        }
    }
}

/** PhotoViewer.tsx — full screen with air around the photo so the date always shows; same direction and loop. */
@Composable
fun PhotoViewer(photos: List<DiaryPhoto>, index: Int, onIndexChange: (Int) -> Unit, onClose: () -> Unit, onDelete: (String) -> Unit) {
    val t = LocalTranslator.current
    val count = photos.size
    val photo = photos.getOrNull(index) ?: return
    val currentIndex by rememberUpdatedState(index)
    fun go(direction: Int) {
        if (count > 1) onIndexChange(wrapIndex(currentIndex + direction, count))
    }
    ProfileFullScreenLayer(onDismiss = onClose) {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                IconButton("X", 24, t.t("common.close"), onClose)
                IconButton("Trash", 20, t.t("photoDiary.deleteAria")) { onDelete(photo.id) }
            }
            var dragTotal by remember { mutableFloatStateOf(0f) }
            Box(
                Modifier.weight(1f).fillMaxWidth().pointerInput(count) {
                    detectHorizontalDragGestures(
                        onDragStart = { dragTotal = 0f },
                        onDragEnd = {
                            val threshold = 50.dp.toPx()
                            if (dragTotal > threshold) go(-1) else if (dragTotal < -threshold) go(1)
                            dragTotal = 0f
                        },
                    ) { _, amount -> dragTotal += amount }
                },
            ) {
                Box(Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
                    ProfileBytesImage(
                        photo.bytes,
                        Modifier.fillMaxSize().clip(RoundedCornerShape(16.dp)),
                        contentScale = ContentScale.Fit,
                        contentDescription = t.t("photoDiary.photoAlt"),
                    )
                }
                if (count > 1) {
                    RoundArrow("ChevronLeft", t.t("photoDiary.previousPhoto"), Modifier.align(Alignment.CenterStart).padding(start = 8.dp)) { go(-1) }
                    RoundArrow("ChevronRight", t.t("photoDiary.nextPhoto"), Modifier.align(Alignment.CenterEnd).padding(end = 8.dp)) { go(1) }
                }
            }
            Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                HcText(formatPhotoDay(photo.takenAt), HcTypeRoles.CardTitle, color = HcColors.White)
                HcText("${t.t("common.clockPrefix")} ${formatPhotoTime(photo.takenAt)}", HcTypeRoles.Small, color = HcColors.White.copy(alpha = 0.7f))
            }
        }
    }
}

@Composable
private fun IconButton(icon: String, size: Int, label: String, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        HcIcon(icon, size = size.dp, color = HcColors.White, contentDescription = label)
    }
}

@Composable
private fun RoundArrow(icon: String, label: String, modifier: Modifier, onClick: () -> Unit) {
    Box(modifier.size(36.dp).clip(CircleShape).background(HcColors.Black.copy(alpha = 0.4f)).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        HcIcon(icon, size = 20.dp, color = HcColors.White, contentDescription = label)
    }
}

/**
 * PhotoCompare.tsx — before/after: photo 1 is ticked in the carousel; then
 * "slots" (photo 1 left, an empty place with "Efter" right), "pick" (all
 * other photos in a grid) and "compare" (both photos on top of each other
 * with a slider between them).
 */
@Composable
fun PhotoCompare(photos: List<DiaryPhoto>, firstId: String, onClose: () -> Unit) {
    val t = LocalTranslator.current
    var beforeId by remember { mutableStateOf(firstId) }
    var afterId by remember { mutableStateOf<String?>(null) }
    var picking by remember { mutableStateOf(false) }
    val before = photos.firstOrNull { it.id == beforeId } ?: return
    val after = afterId?.let { id -> photos.firstOrNull { it.id == id } }
    val step = when {
        picking -> "pick"
        after != null -> "compare"
        else -> "slots"
    }
    val candidates = photos.filter { it.id != beforeId }
    val title = if (step == "pick") t.t("photoDiary.compare.pickAfterTitle") else t.t("photoDiary.compare.title")

    fun chooseAfter(id: String) {
        afterId = id
        picking = false
    }

    ProfileFullScreenLayer(onDismiss = { if (picking) picking = false else onClose() }) {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                if (step == "pick") IconButton("ArrowLeft", 24, t.t("common.back")) { picking = false } else IconButton("X", 24, t.t("common.close"), onClose)
                ProfileEllipsisText(title, HcTypeRoles.CardTitle, Modifier.weight(1f).padding(horizontal = 8.dp), color = HcColors.White)
                if (step == "compare") {
                    IconButton("ArrowsLeftRight", 22, t.t("photoDiary.compare.swap")) {
                        val currentAfter = afterId
                        if (currentAfter != null) {
                            afterId = beforeId
                            beforeId = currentAfter
                        }
                    }
                } else {
                    Box(Modifier.size(44.dp))
                }
            }

            when (step) {
                "slots" -> Column(
                    Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                ) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        SlotLabel(1, t.t("photoDiary.compare.before"), formatPhotoDay(before.takenAt), Modifier.weight(1f))
                        SlotLabel(2, t.t("photoDiary.compare.after"), null, Modifier.weight(1f))
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        val shape = RoundedCornerShape(16.dp)
                        Box(Modifier.weight(1f).aspectRatio(3f / 4f).clip(shape).background(HcColors.Black, shape)) {
                            ProfileBytesImage(before.bytes, Modifier.fillMaxSize(), contentDescription = "${t.t("photoDiary.compare.before")}, ${formatPhotoDay(before.takenAt)}")
                            ProfilePhotoCheck(true, 1, onToggle = onClose, modifier = Modifier.align(Alignment.TopEnd))
                        }
                        Box(
                            Modifier.weight(1f).aspectRatio(3f / 4f).clip(shape).border(2.dp, HcColors.White.copy(alpha = 0.5f), shape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Row(
                                Modifier.clip(RoundedCornerShape(50)).background(HcColors.White).clickable { picking = true }.padding(horizontal = 16.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                HcIcon("Plus", size = 18.dp, stroke = 2.5f, color = HcColors.Black)
                                HcText(t.t("photoDiary.compare.after"), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                            }
                        }
                    }
                    HcText(t.t("photoDiary.compare.firstSelectedHint"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.White.copy(alpha = 0.7f), align = TextAlign.Center)
                }
                "pick" -> Column(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp)) {
                    HcText(t.t("photoDiary.compare.pickAfterHint"), HcTypeRoles.Small, Modifier.fillMaxWidth().padding(bottom = 16.dp), color = HcColors.White.copy(alpha = 0.7f), align = TextAlign.Center)
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(3),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 16.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(candidates, key = { it.id }) { photo ->
                            val selected = photo.id == afterId
                            val day = formatPhotoDay(photo.takenAt)
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                val shape = RoundedCornerShape(12.dp)
                                Box(Modifier.fillMaxWidth().aspectRatio(3f / 4f).clip(shape).background(HcColors.Black, shape)) {
                                    Box(Modifier.fillMaxSize().clickable { chooseAfter(photo.id) }) {
                                        ProfileBytesImage(photo.bytes, Modifier.fillMaxSize(), contentDescription = "${t.t("photoDiary.compare.chooseAsAfter")}, $day")
                                    }
                                    ProfilePhotoCheck(selected, 2, onToggle = { chooseAfter(photo.id) }, modifier = Modifier.align(Alignment.TopEnd))
                                }
                                ProfileEllipsisText(day, HcTypeRoles.Caption, color = HcColors.White.copy(alpha = 0.7f))
                            }
                        }
                    }
                }
                else -> if (after != null) {
                    Box(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp)) { PhotoCompareSlider(before, after) }
                    Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            SlotLabel(1, t.t("photoDiary.compare.before"), formatPhotoDay(before.takenAt), Modifier.weight(1f))
                            SlotLabel(2, t.t("photoDiary.compare.after"), formatPhotoDay(after.takenAt), Modifier.weight(1f), alignEnd = true)
                        }
                        ProfileTextButton(t.t("photoDiary.compare.changeAfter"), onClick = { picking = true }, color = HcColors.White)
                    }
                }
            }
        }
    }
}

@Composable
private fun SlotLabel(number: Int, label: String, date: String?, modifier: Modifier = Modifier, alignEnd: Boolean = false) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp, if (alignEnd) Alignment.End else Alignment.Start)) {
        Box(Modifier.size(24.dp).clip(CircleShape).background(HcColors.White), contentAlignment = Alignment.Center) {
            HcText(number.toString(), HcTypeRoles.Body, bold = true, color = HcColors.Black)
        }
        ProfileEllipsisText(if (date != null) "$label · $date" else label, HcTypeRoles.Small, color = HcColors.White)
    }
}

/**
 * PhotoCompareSlider.tsx — the two photos on top of each other with a
 * vertical slider: left of it the before photo (1), right the after photo
 * (2). Drag anywhere in the photo. The box takes the before photo's format.
 */
@Composable
private fun PhotoCompareSlider(before: DiaryPhoto, after: DiaryPhoto) {
    val t = LocalTranslator.current
    var percent by remember { mutableFloatStateOf(50f) }
    var ratio by remember(before.id) { mutableFloatStateOf(3f / 4f) }
    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        val boxWidth = minOf(maxWidth, maxHeight * ratio)
        val shape = RoundedCornerShape(16.dp)
        Box(
            Modifier.width(boxWidth).aspectRatio(ratio).clip(shape).background(HcColors.Black, shape)
                .pointerInput(Unit) {
                    fun moveTo(x: Float) {
                        percent = if (size.width > 0) (x / size.width * 100f).coerceIn(0f, 100f) else 50f
                    }
                    detectDragGestures(onDragStart = { moveTo(it.x) }) { change, _ ->
                        change.consume()
                        moveTo(change.position.x)
                    }
                }
                .pointerInput(Unit) {
                    detectTapGestures { offset -> percent = if (size.width > 0) (offset.x / size.width * 100f).coerceIn(0f, 100f) else 50f }
                },
        ) {
            ProfileBytesImage(after.bytes, Modifier.fillMaxSize(), contentDescription = "${t.t("photoDiary.compare.after")}, ${formatPhotoDay(after.takenAt)}")
            ProfileBytesImage(
                before.bytes,
                Modifier.fillMaxSize().drawWithContent {
                    clipRect(right = size.width * percent / 100f) { this@drawWithContent.drawContent() }
                },
                contentDescription = "${t.t("photoDiary.compare.before")}, ${formatPhotoDay(before.takenAt)}",
                onRatio = { ratio = it },
            )
            Pill("1 · ${t.t("photoDiary.compare.before")}", Modifier.align(Alignment.TopStart).padding(8.dp))
            Pill("2 · ${t.t("photoDiary.compare.after")}", Modifier.align(Alignment.TopEnd).padding(8.dp))
            BoxWithConstraints(Modifier.fillMaxSize()) {
                val x = maxWidth * (percent / 100f)
                Box(Modifier.fillMaxHeight().width(2.dp).align(Alignment.CenterStart).offset(x = x - 1.dp).background(HcColors.White))
                Row(
                    Modifier.size(44.dp).align(Alignment.CenterStart).offset(x = x - 22.dp).clip(CircleShape).background(HcColors.White),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    HcIcon("ChevronLeft", size = 16.dp, stroke = 2.5f, color = HcColors.Black, contentDescription = t.t("photoDiary.compare.sliderAria"))
                    HcIcon("ChevronRight", size = 16.dp, stroke = 2.5f, color = HcColors.Black)
                }
            }
        }
    }
}

@Composable
private fun Pill(text: String, modifier: Modifier) {
    Box(modifier.clip(RoundedCornerShape(50)).background(HcColors.Black.copy(alpha = 0.4f)).padding(horizontal = 8.dp, vertical = 4.dp)) {
        HcText(text, HcTypeRoles.Caption, color = HcColors.White)
    }
}
