package dk.packroff.hellocal.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sign

private const val SIDE_ITEMS = 3
private const val SCALE_STEP = 0.18f
private const val FADE_OUT_AT = SIDE_ITEMS + 0.5f
private const val FADE_MS = 300

/**
 * src/components/hf/DragNumberStrip.tsx — vandret tal-hjul: det store tal
 * trækkes til siderne, nabotallene vises mindre og mere utydelige på samme
 * grundlinje, og enheden (content) er skjult, indtil nabotallene er faldet ud.
 */
@Composable
fun DragNumberStrip(
    value: Double,
    step: Double,
    min: Double,
    format: (Double) -> String,
    onChange: (Double) -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val haptic = LocalHapticFeedback.current
    val density = LocalDensity.current
    val stepPx = with(density) { 56.dp.toPx() }
    val shrinkPx = with(density) { 5.dp.toPx() }
    val currentValue by rememberUpdatedState(value)
    val currentOnChange by rememberUpdatedState(onChange)
    // 0 = hvile, 1 = træk, 2 = nabotallene falder ud.
    var phase by remember { mutableStateOf(0) }
    var fraction by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(phase) {
        if (phase == 2) {
            delay(FADE_MS.toLong())
            phase = 0
        }
    }
    val shownFraction by animateFloatAsState(
        if (phase == 1) fraction else 0f,
        if (phase == 1) snap() else tween(FADE_MS),
    )

    Box(
        modifier.pointerInput(step, min) {
            var start = 0.0
            var dx = 0f
            detectHorizontalDragGestures(
                onDragStart = {
                    start = currentValue
                    dx = 0f
                    phase = 1
                },
                onDragEnd = { phase = 2 },
                onDragCancel = { phase = 2 },
            ) { change, amount ->
                change.consume()
                dx += amount
                // Finger til venstre = større tal ind fra højre.
                val raw = -dx / stepPx
                var whole = raw.roundToInt()
                var frac = raw - whole
                val lowest = ceil((min - start) / step).toInt()
                if (whole <= lowest) {
                    whole = lowest
                    frac = max(0f, raw - whole)
                }
                fraction = frac
                val next = start + whole * step
                if (next != currentValue) {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    currentOnChange(next)
                }
            }
        },
        contentAlignment = Alignment.Center,
    ) {
        val active = phase != 0
        Box(Modifier.alpha(if (active) 0f else 1f)) { content() }
        if (active) {
            Box(Modifier.matchParentSize().clipToBounds()) {
                for (k in -SIDE_ITEMS..SIDE_ITEMS) {
                    val itemValue = value + k * step
                    if (itemValue < min) continue
                    key(k) {
                        val distance = k - shownFraction
                        val d = abs(distance)
                        val scale = 1f - SCALE_STEP * kotlin.math.min(d, SIDE_ITEMS.toFloat())
                        val target = if (phase == 2 && k != 0) 0f
                        else max(0f, 1f - d / FADE_OUT_AT) * (if (d < 0.5f) 1f else 0.75f)
                        val alpha by animateFloatAsState(target, if (phase == 2) tween(FADE_MS) else snap())
                        val offset = sign(distance) * (stepPx * d - shrinkPx * d * d)
                        HcText(
                            format(itemValue),
                            HcTypeRoles.PageTitle,
                            Modifier.align(Alignment.BottomCenter).graphicsLayer {
                                translationX = offset
                                scaleX = scale
                                scaleY = scale
                                this.alpha = alpha
                                // Skaleret om grundlinjen (28 dp linje, ca. 8 dp under grundlinjen).
                                transformOrigin = TransformOrigin(0.5f, 20f / 28f)
                            },
                            color = HcColors.Black,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}
