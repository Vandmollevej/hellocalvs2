package dk.packroff.hellocal.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.LocalNavigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * src/components/SwipeableRow.tsx — swipe right for Favorit (+ copy), swipe
 * left for (Fejl +) Slet. One gesture opens one side; release snaps open/closed.
 */
@Composable
fun CaptureSwipeableRow(
    onDelete: () -> Unit,
    onFavorite: (() -> Unit)? = null,
    onCopyToAccount: (() -> Unit)? = null,
    onReportError: (() -> Unit)? = null,
    surface: Color = HcColors.Cream,
    content: @Composable () -> Unit,
) {
    val t = LocalTranslator.current
    val density = LocalDensity.current
    val actionPx = with(density) { 80.dp.toPx() }
    val rightWidth = if (onReportError != null) actionPx * 2 else actionPx
    val leftWidth = (if (onFavorite != null) actionPx else 0f) + (if (onCopyToAccount != null) actionPx else 0f)
    var dragX by remember { mutableFloatStateOf(0f) }
    var dragging by remember { mutableStateOf(false) }
    var side by remember { mutableStateOf(0) }
    val shown by animateFloatAsState(dragX, animationSpec = tween(if (dragging) 0 else 150))
    val state = rememberDraggableState { delta ->
        val next = dragX + delta
        if (side == 0 && next != 0f) side = if (next > 0) 1 else -1
        val minimum = if (side == -1) -rightWidth else 0f
        val maximum = if (side == 1) leftWidth else 0f
        dragX = max(minimum, min(maximum, next))
    }
    fun close() {
        dragX = 0f
    }

    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(0.dp))) {
        // Actions under the row.
        Row(Modifier.matchParentSize()) {
            if (onFavorite != null) SwipeAction(HcColors.Green, t.t("swipeableRow.favorite"), { HcMaskIcon("/icons/favorite.png", 18.dp, HcColors.White) }) { onFavorite(); close() }
            if (onCopyToAccount != null) SwipeAction(HcColors.Watch, t.t("family.copy.action"), { HcIcon("Copy", size = 18.dp, color = HcColors.White) }) { onCopyToAccount(); close() }
            Spacer(Modifier.weight(1f))
            if (onReportError != null) SwipeAction(HcColors.GrayDark, t.t("swipeableRow.reportError"), { HcIcon("AlertTriangle", size = 18.dp, color = HcColors.White) }) { onReportError(); close() }
            SwipeAction(HcColors.RedDark, t.t("swipeableRow.delete"), null) { onDelete(); close() }
        }
        Box(
            Modifier.fillMaxWidth().offset { IntOffset(shown.roundToInt(), 0) }.background(surface)
                .draggable(
                    state = state,
                    orientation = Orientation.Horizontal,
                    onDragStarted = {
                        dragging = true
                        side = if (dragX > 0) 1 else if (dragX < 0) -1 else 0
                    },
                    onDragStopped = {
                        dragging = false
                        side = 0
                        dragX = when {
                            leftWidth > 0 && dragX > leftWidth / 2 -> leftWidth
                            dragX < -rightWidth / 2 -> -rightWidth
                            else -> 0f
                        }
                    },
                ),
        ) { content() }
    }
}

@Composable
private fun SwipeAction(color: Color, label: String, icon: (@Composable () -> Unit)?, onClick: () -> Unit) {
    Column(
        Modifier.width(80.dp).fillMaxHeight().background(color).clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
    ) {
        icon?.invoke()
        HcText(label, HcTypeRoles.Small, bold = true, color = HcColors.White, align = TextAlign.Center)
    }
}

/** One row in an EntryDetailsSheet (label left, bold value right). */
class CaptureDetailRow(val label: String, val value: String)

/**
 * src/components/hf/EntryDetailsSheet.tsx — one info sheet for a registration;
 * with [onDelete] it becomes a delete warning with a Slet button.
 */
@Composable
fun CaptureEntryDetailsSheet(
    title: String,
    onClose: () -> Unit,
    subtitle: String? = null,
    rows: List<CaptureDetailRow> = emptyList(),
    loading: Boolean = false,
    syncedFrom: Pair<String, String?>? = null,
    manual: Boolean = false,
    onDelete: (() -> Unit)? = null,
) {
    val t = LocalTranslator.current
    HcBottomSheet(
        onDismiss = onClose,
        title = title,
        scrollable = true,
        footer = {
            val close = LocalHcSheetClose.current
            if (onDelete != null) {
                HcButton(t.t("entrySheet.delete"), onClick = {
                    onDelete()
                    close()
                }, kind = HcButtonKind.Danger)
                HcSheetSkipButton(t.t("common.cancel"))
            } else {
                HcButton(t.t("common.close"), onClick = close)
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (subtitle != null) HcText(subtitle, HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            if (syncedFrom != null) {
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Row(
                    Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape).padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CaptureIntegrationIcon(syncedFrom.second, syncedFrom.first, 32.dp)
                    Column(Modifier.weight(1f)) {
                        HcText(t.t("entrySheet.syncedFrom", "name" to syncedFrom.first), HcTypeRoles.Body, bold = true, color = HcColors.Black)
                        HcText(t.t("entrySheet.syncedLocked", "name" to syncedFrom.first), HcTypeRoles.Small, color = HcColors.TextSecondary)
                    }
                }
            }
            if (manual) HcText(t.t("entrySheet.manual"), HcTypeRoles.Body, Modifier.fillMaxWidth(), bold = true, color = HcColors.Black, align = TextAlign.Center)
            if (loading) HcText(t.t("entrySheet.loading"), HcTypeRoles.Small, Modifier.fillMaxWidth(), color = HcColors.TextSecondary, align = TextAlign.Center)
            if (rows.isNotEmpty()) {
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Column(Modifier.fillMaxWidth().clip(shape).background(HcColors.Tan, shape)) {
                    rows.forEachIndexed { index, row ->
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            HcText(row.label, HcTypeRoles.Body, Modifier.weight(1f), color = HcColors.Black)
                            HcText(row.value, HcTypeRoles.Body, bold = true, color = HcColors.Black, align = TextAlign.End)
                        }
                        if (index < rows.lastIndex) HcLine()
                    }
                }
            }
            if (onDelete != null) {
                HcText(t.t("entrySheet.deleteWarning"), HcTypeRoles.Body, Modifier.fillMaxWidth(), color = HcColors.RedDark, align = TextAlign.Center)
            }
        }
    }
}
