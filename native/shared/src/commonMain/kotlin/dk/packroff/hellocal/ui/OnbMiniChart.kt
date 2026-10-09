package dk.packroff.hellocal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import kotlin.math.max

/** src/components/hf/MiniChart.tsx — one point of a mini chart. */
data class OnbChartPoint(val label: String, val value: Double)

private const val CHART_WIDTH = 300f
private const val CHART_PADDING = 8f

/** MiniLineChart: 300×120 viewBox scaled to the full width, last point slightly bigger. */
@Composable
fun OnbMiniLineChart(
    points: List<OnbChartPoint>,
    modifier: Modifier = Modifier,
    color: Color = HcColors.Brand,
    emptyLabel: String = "Ingen data i denne periode",
    height: Float = 120f,
) {
    if (points.isEmpty()) {
        OnbEmptyChart(height, emptyLabel, modifier)
        return
    }
    val values = points.map { it.value.toFloat() }
    val min = values.min()
    val maxValue = values.max()
    val range = (maxValue - min).takeIf { it != 0f } ?: 1f
    val coords = points.mapIndexed { index, point ->
        Offset(
            if (points.size == 1) CHART_WIDTH / 2 else CHART_PADDING + (index.toFloat() / (points.size - 1)) * (CHART_WIDTH - CHART_PADDING * 2),
            height - CHART_PADDING - ((point.value.toFloat() - min) / range) * (height - CHART_PADDING * 2),
        )
    }
    Canvas(modifier.fillMaxWidth().aspectRatio(CHART_WIDTH / height)) {
        val unit = size.width / CHART_WIDTH
        scale(unit, unit, pivot = Offset.Zero) {
            val path = Path().apply {
                coords.forEachIndexed { index, c -> if (index == 0) moveTo(c.x, c.y) else lineTo(c.x, c.y) }
            }
            drawPath(path, color, style = Stroke(width = 2.5f, cap = StrokeCap.Round, join = StrokeJoin.Round))
            coords.forEachIndexed { index, c -> drawCircle(color, radius = if (index == coords.lastIndex) 3.5f else 2f, center = c) }
        }
    }
}

/** MiniBarChart: bars at 70 % of their slot, rounded 2, at least 1 unit high. */
@Composable
fun OnbMiniBarChart(
    points: List<OnbChartPoint>,
    modifier: Modifier = Modifier,
    color: Color = HcColors.Brand,
    emptyLabel: String = "Ingen data i denne periode",
    height: Float = 120f,
) {
    if (points.isEmpty()) {
        OnbEmptyChart(height, emptyLabel, modifier)
        return
    }
    val maxValue = max(points.maxOf { it.value }.toFloat(), 1f)
    val barWidth = (CHART_WIDTH - CHART_PADDING * 2) / points.size
    Canvas(modifier.fillMaxWidth().aspectRatio(CHART_WIDTH / height)) {
        val unit = size.width / CHART_WIDTH
        scale(unit, unit, pivot = Offset.Zero) {
            points.forEachIndexed { index, point ->
                val barHeight = (point.value.toFloat() / maxValue) * (height - CHART_PADDING * 2)
                val x = CHART_PADDING + index * barWidth
                val y = height - CHART_PADDING - barHeight
                drawRoundRect(
                    color,
                    topLeft = Offset(x + barWidth * 0.15f, y),
                    size = Size(barWidth * 0.7f, max(barHeight, 1f)),
                    cornerRadius = CornerRadius(2f, 2f),
                )
            }
        }
    }
}

@Composable
private fun OnbEmptyChart(height: Float, label: String, modifier: Modifier) {
    Box(modifier.fillMaxWidth().height(height.dp), contentAlignment = Alignment.Center) {
        HcText(label, HcTypeRoles.Caption, color = HcColors.TextSecondary)
    }
}
