package dk.packroff.hellocal.screens.statistics

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
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

/** A chart canvas with an SVG-style viewBox of [width] × [height]. */
@Composable
internal fun ViewBoxCanvas(width: Float, height: Float, modifier: Modifier = Modifier, draw: ViewBoxScope.() -> Unit) {
    val measurer = rememberTextMeasurer()
    Canvas(modifier.fillMaxWidth().aspectRatio(width / height)) {
        ViewBoxScope(this, size.width / width, measurer).draw()
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
