package dk.packroff.hellocal.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors

/**
 * The ".hello-loader" from globals.css (welcome splash): lime disc with a brand
 * "snake" that spins and grows/shrinks (hello-loader-spin + hello-loader-length, 1.25 s).
 */
@Composable
fun OnbHelloLoader(size: Dp = 96.dp, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition()
    val progress by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1250, easing = LinearEasing), RepeatMode.Restart),
    )
    Canvas(modifier.size(size)) {
        val unit = this.size.width / 100f
        drawCircle(HcColors.Accent, radius = 46f * unit, center = Offset(50f * unit, 50f * unit))
        val (length, offset) = loaderKeyframe(progress)
        val circumference = 157f
        val start = progress * 360f + (-offset / circumference) * 360f
        val sweep = length / circumference * 360f
        val r = 25f * unit
        drawArc(
            color = HcColors.Brand,
            startAngle = start,
            sweepAngle = sweep,
            useCenter = false,
            topLeft = Offset(50f * unit - r, 50f * unit - r),
            size = Size(r * 2, r * 2),
            style = Stroke(width = 14f * unit, cap = StrokeCap.Round),
        )
    }
}

// (time, dash length, dash offset) from @keyframes hello-loader-length.
private val KEYFRAMES = listOf(
    Triple(0f, 18f, 0f),
    Triple(0.35f, 82f, -8f),
    Triple(0.58f, 82f, -35f),
    Triple(0.82f, 28f, -105f),
    Triple(1f, 18f, -157f),
)

private fun loaderKeyframe(p: Float): Pair<Float, Float> {
    for (i in 0 until KEYFRAMES.lastIndex) {
        val (t0, l0, o0) = KEYFRAMES[i]
        val (t1, l1, o1) = KEYFRAMES[i + 1]
        if (p <= t1) {
            val raw = ((p - t0) / (t1 - t0)).coerceIn(0f, 1f)
            val v = if (raw < 0.5f) 2 * raw * raw else 1 - (-2 * raw + 2) * (-2 * raw + 2) / 2 // ease-in-out
            return (l0 + (l1 - l0) * v) to (o0 + (o1 - o0) * v)
        }
    }
    return 18f to -157f
}
