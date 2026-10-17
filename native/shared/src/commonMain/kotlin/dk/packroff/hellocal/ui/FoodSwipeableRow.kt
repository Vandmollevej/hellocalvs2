package dk.packroff.hellocal.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.icons.HcIcon

private const val ACTION_WIDTH = 80f

/** An extra button behind the row (e.g. Aktivér on screenings); looks like every other action. */
data class FoodSwipeAction(val label: String, val icon: String, val color: Color, val onClick: () -> Unit)

/** Texts for the swipe actions (src/components/SwipeableRow.tsx uses swipeableRow.* and family.copy.action). */
data class FoodSwipeTexts(val favorite: String, val copy: String, val reportError: String, val delete: String, val favoriteSaved: String = favorite)

/**
 * src/components/SwipeableRow.tsx — swipe right for Favorit (+ Kopier til konto),
 * swipe left for (Fejl +) Slet. One gesture opens one side; releases snap open/closed.
 * The one shared swipe row (user 2026-10-17): every action is icon over label, 80 dp wide.
 */
@Composable
fun FoodSwipeableRow(
    texts: FoodSwipeTexts,
    /** null = no Slet (e.g. search results: products you can't delete from the list). */
    onDelete: (() -> Unit)?,
    modifier: Modifier = Modifier,
    onFavorite: (() -> Unit)? = null,
    isFavorite: Boolean = false,
    onCopyToAccount: (() -> Unit)? = null,
    onReportError: (() -> Unit)? = null,
    rightActions: List<FoodSwipeAction> = emptyList(),
    surface: Color = HcColors.Tan,
    content: @Composable () -> Unit,
) {
    val density = LocalDensity.current.density
    val rightWidth = ACTION_WIDTH * (rightActions.size + (if (onReportError != null) 1 else 0) + (if (onDelete != null) 1 else 0))
    val leftWidth = (if (onFavorite != null) ACTION_WIDTH else 0f) + (if (onCopyToAccount != null) ACTION_WIDTH else 0f)
    var dragX by remember { mutableStateOf(0f) }
    var dragging by remember { mutableStateOf(false) }
    val shown by animateFloatAsState(dragX, if (dragging) snap<Float>() else tween<Float>(150))

    Box(modifier.fillMaxWidth().height(IntrinsicSize.Min).clipToBounds()) {
        Row(Modifier.fillMaxWidth().fillMaxHeight()) {
            if (onFavorite != null) SwipeAction(if (isFavorite) texts.favoriteSaved else texts.favorite, if (isFavorite) HcColors.Black else HcColors.Green, icon = { FoodFavoriteIcon(isFavorite, 20.dp, HcColors.White) }) {
                onFavorite()
                dragX = 0f
            }
            if (onCopyToAccount != null) SwipeAction(texts.copy, HcColors.Watch, icon = { HcIcon("Copy", size = 20.dp, color = HcColors.White) }) {
                onCopyToAccount()
                dragX = 0f
            }
            Box(Modifier.weight(1f))
            rightActions.forEach { action ->
                SwipeAction(action.label, action.color, icon = { HcIcon(action.icon, size = 20.dp, color = HcColors.White) }) {
                    action.onClick()
                    dragX = 0f
                }
            }
            if (onReportError != null) SwipeAction(texts.reportError, HcColors.GrayDark, icon = { HcIcon("AlertTriangle", size = 20.dp, color = HcColors.White) }) {
                onReportError()
                dragX = 0f
            }
            if (onDelete != null) SwipeAction(texts.delete, HcColors.RedDark, icon = { HcIcon("Trash", size = 20.dp, color = HcColors.White) }) {
                onDelete()
                dragX = 0f
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .offset(x = shown.dp)
                .background(surface)
                .pointerInput(leftWidth, rightWidth) {
                    var side = 0
                    var startOffset = 0f
                    var total = 0f
                    detectHorizontalDragGestures(
                        onDragStart = {
                            startOffset = dragX
                            total = 0f
                            side = if (dragX > 0) 1 else if (dragX < 0) -1 else 0
                            dragging = true
                        },
                        onDragEnd = {
                            dragging = false
                            dragX = when {
                                leftWidth > 0 && dragX > leftWidth / 2 -> leftWidth
                                rightWidth > 0 && dragX < -rightWidth / 2 -> -rightWidth
                                else -> 0f
                            }
                        },
                        onDragCancel = {
                            dragging = false
                            dragX = when {
                                leftWidth > 0 && dragX > leftWidth / 2 -> leftWidth
                                rightWidth > 0 && dragX < -rightWidth / 2 -> -rightWidth
                                else -> 0f
                            }
                        },
                    ) { change, amount ->
                        change.consume()
                        total += amount / density
                        val next = startOffset + total
                        if (side == 0 && next != 0f) side = if (next > 0) 1 else -1
                        val minimum = if (side == -1) -rightWidth else 0f
                        val maximum = if (side == 1) leftWidth else 0f
                        dragX = next.coerceIn(minimum, maximum)
                    }
                },
        ) { content() }
    }
}

@Composable
private fun SwipeAction(label: String, color: Color, icon: (@Composable () -> Unit)?, onClick: () -> Unit) {
    Column(
        Modifier.width(ACTION_WIDTH.dp).fillMaxHeight().background(color).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
    ) {
        icon?.invoke()
        HcText(label, HcTypeRoles.Small, color = HcColors.White, bold = true, align = TextAlign.Center)
    }
}
