package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens

// Draws the web's inline SVG charts 1:1: every chart keeps its SVG viewBox
// (e.g. 0 0 280 90), is as wide as its card and scales like the browser does.
// Coordinates below are viewBox units, never pixels.

internal enum class TextAnchor { Start, Middle, End }

internal class ViewBoxScope(private val scope: DrawScope, private val scale: Float, private val measurer: TextMeasurer) {
    private fun p(x: Float, y: Float) = Offset(x * scale, y * scale)

    private fun dash(pattern: FloatArray?): PathEffect? =
        pattern?.let { PathEffect.dashPathEffect(FloatArray(it.size) { i -> it[i] * scale }, 0f) }

    fun line(x1: Float, y1: Float, x2: Float, y2: Float, color: Color, width: Float, dashPattern: FloatArray? = null, round: Boolean = false) {
        scope.drawLine(
            color,
            p(x1, y1),
            p(x2, y2),
            strokeWidth = width * scale,
            cap = if (round) StrokeCap.Round else StrokeCap.Butt,
            pathEffect = dash(dashPattern),
        )
    }

    fun polyline(points: List<Offset>, color: Color, width: Float, dashPattern: FloatArray? = null, alpha: Float = 1f) {
        if (points.size < 2) return
        val path = Path().apply {
            moveTo(points[0].x * scale, points[0].y * scale)
            for (i in 1 until points.size) lineTo(points[i].x * scale, points[i].y * scale)
        }
        scope.drawPath(
            path,
            color,
            alpha = alpha,
            style = Stroke(width = width * scale, cap = StrokeCap.Round, join = StrokeJoin.Round, pathEffect = dash(dashPattern)),
        )
    }

    fun polygon(points: List<Offset>, color: Color, alpha: Float) {
        if (points.size < 3) return
        val path = Path().apply {
            moveTo(points[0].x * scale, points[0].y * scale)
            for (i in 1 until points.size) lineTo(points[i].x * scale, points[i].y * scale)
            close()
        }
        scope.drawPath(path, color, alpha = alpha)
    }

    fun circle(cx: Float, cy: Float, r: Float, color: Color, strokeColor: Color? = null, strokeWidth: Float = 0f) {
        scope.drawCircle(color, radius = r * scale, center = p(cx, cy))
        if (strokeColor != null && strokeWidth > 0f) {
            scope.drawCircle(strokeColor, radius = r * scale, center = p(cx, cy), style = Stroke(width = strokeWidth * scale))
        }
    }

    fun rect(x: Float, y: Float, w: Float, h: Float, color: Color, alpha: Float = 1f, rx: Float = 0f) {
        scope.drawRoundRect(
            color,
            topLeft = p(x, y),
            size = Size(w * scale, h * scale),
            cornerRadius = CornerRadius(rx * scale, rx * scale),
            alpha = alpha,
        )
    }

    /** SVG <text>: [y] is the baseline, [anchor] is text-anchor. */
    fun text(text: String, x: Float, y: Float, fontSize: Float, color: Color, bold: Boolean = false, anchor: TextAnchor = TextAnchor.Start) {
        val style = TextStyle(
            fontSize = with(scope) { (fontSize * scale).toSp() },
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = color,
        )
        val layout = measurer.measure(text, style)
        val width = layout.size.width.toFloat()
        val left = when (anchor) {
            TextAnchor.Start -> x * scale
            TextAnchor.Middle -> x * scale - width / 2f
            TextAnchor.End -> x * scale - width
        }
        scope.drawText(layout, topLeft = Offset(left, y * scale - layout.firstBaseline))
    }
}

/**
 * An SVG `<title>` on a chart mark (circle or bar), in viewBox units. The
 * browser shows the title when the pointer rests on the mark; the app shows
 * [text] in a small bubble when the mark is tapped.
 */
internal data class ChartTip(val x: Float, val y: Float, val w: Float, val h: Float, val text: String, val round: Boolean) {
    /** Distance from (px, py) to the mark's edge — 0 inside it. */
    fun distance(px: Float, py: Float): Float {
        if (round) {
            val r = w / 2f
            val dx = px - (x + r)
            val dy = py - (y + r)
            return max(0f, sqrt(dx * dx + dy * dy) - r)
        }
        val dx = max(max(x - px, 0f), px - (x + w))
        val dy = max(max(y - py, 0f), py - (y + h))
        return sqrt(dx * dx + dy * dy)
    }

    companion object {
        fun circle(cx: Float, cy: Float, r: Float, text: String) = ChartTip(cx - r, cy - r, r * 2f, r * 2f, text, round = true)
        fun rect(x: Float, y: Float, w: Float, h: Float, text: String) = ChartTip(x, y, w, h, text, round = false)
    }
}

/** How far (dp) from a mark a tap still counts as a tap on it. */
private const val TIP_TOLERANCE_DP = 12

/**
 * A short tap that nothing else took: the scroll (a swipe) and the edit-mode
 * drag (a long press) consume their events, which cancels the tap here. Seen
 * on the Final pass and never consumed, so the chart's own long press still works.
 */
private suspend fun PointerInputScope.detectChartTap(onTap: (Offset) -> Unit) {
    awaitEachGesture {
        awaitFirstDown(requireUnconsumed = false)
        val up = waitForUpOrCancellation(pass = PointerEventPass.Final)
        if (up != null) onTap(up.position)
    }
}

/** A chart canvas with an SVG-style viewBox of [width] × [height]; [tips] are its point titles. */
@Composable
internal fun ViewBoxCanvas(
    width: Float,
    height: Float,
    modifier: Modifier = Modifier,
    tips: List<ChartTip> = emptyList(),
    draw: ViewBoxScope.() -> Unit,
) {
    val measurer = rememberTextMeasurer()
    var shown by remember(tips) { mutableStateOf<ChartTip?>(null) }
    Box(modifier.fillMaxWidth().aspectRatio(width / height)) {
        Canvas(
            Modifier
                .matchParentSize()
                .let { base ->
                    if (tips.isEmpty()) base
                    else base.pointerInput(tips) {
                        detectChartTap { position ->
                            // A tap near a mark shows its title; a tap anywhere else hides it.
                            val scale = size.width / width
                            val tolerance = TIP_TOLERANCE_DP.dp.toPx() / scale
                            val px = position.x / scale
                            val py = position.y / scale
                            var best: ChartTip? = null
                            var bestDistance = Float.MAX_VALUE
                            for (tip in tips) {
                                val d = tip.distance(px, py)
                                // Later marks are drawn on top, so they win a tie.
                                if (d <= tolerance && d <= bestDistance) {
                                    best = tip
                                    bestDistance = d
                                }
                            }
                            shown = best
                        }
                    }
                },
        ) {
            ViewBoxScope(this, size.width / width, measurer).draw()
        }
        shown?.let { tip -> ChartTipBubble(tip, width, Modifier.matchParentSize()) { shown = null } }
    }
}

/** The title bubble, centred above its mark and kept inside the chart's width. */
@Composable
private fun ChartTipBubble(tip: ChartTip, viewBoxWidth: Float, modifier: Modifier, onClose: () -> Unit) {
    Layout(
        content = {
            Box(
                Modifier
                    .background(HcColors.Black, RoundedCornerShape(HcDimens.RadiusCard))
                    .clickable(onClick = onClose)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            ) {
                HcText(tip.text, HcTypeRoles.Small, color = HcColors.White)
            }
        },
        modifier = modifier,
    ) { measurables, constraints ->
        val placeable = measurables.first().measure(Constraints(maxWidth = constraints.maxWidth))
        val scale = constraints.maxWidth / viewBoxWidth
        val gap = 6.dp.roundToPx()
        val centre = (tip.x + tip.w / 2f) * scale
        val x = (centre - placeable.width / 2f).roundToInt().coerceIn(0, max(0, constraints.maxWidth - placeable.width))
        val y = (tip.y * scale).roundToInt() - gap - placeable.height
        layout(constraints.maxWidth, constraints.maxHeight) { placeable.place(x, y) }
    }
}

/** `.hf-card` without the built-in gap, for charts that space their own rows. */
@Composable
internal fun ChartCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().background(HcColors.Card, RoundedCornerShape(HcDimens.RadiusCard)).padding(HcDimens.SpaceBlock),
        content = content,
    )
}
