package dk.packroff.hellocal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

/** src/components/FaceIdAnimation.tsx phases. */
enum class OnbFaceIdPhase { Idle, Scanning, Success, Failed }

private const val FRAME = 80f
private const val BRACKET_RADIUS = 18f
private const val BRACKET_ARM = 10f
private const val CHECK_LENGTH = 50f
private const val MORPH_END = 260f
private const val FACE_FADE_START = 480f
private const val FACE_FADE_END = 720f
private const val SPIN_START = 700f
private const val SPIN_END = 1180f
private const val CHECK_START = 1180f
private const val CHECK_END = 1460f
private const val SUCCESS_DONE = 1800f
private const val SHAKE_MS = 420f

private fun clamp01(v: Float) = v.coerceIn(0f, 1f)
private fun progress(t: Float, from: Float, to: Float) = clamp01((t - from) / (to - from))
private fun easeInOut(v: Float) = if (v < 0.5f) 2 * v * v else 1 - (-2 * v + 2) * (-2 * v + 2) / 2
private fun mix(a: Float, b: Float, v: Float) = a + (b - a) * v

private data class FaceFrame(
    val morph: Float = 0f,
    val look: Float = 0f,
    val faceOpacity: Float = 1f,
    val spin: Float = 0f,
    val spinColor: Float = 0f,
    val check: Float = 0f,
    val shakeX: Float = 0f,
)

/**
 * Port of the web Face ID animation: corner brackets with a face looking side
 * to side ("scanning"); brackets close to a circle, spin and draw a tick
 * ("success", then [onDone]); a short shake ("failed").
 */
@Composable
fun OnbFaceIdAnimation(phase: OnbFaceIdPhase, size: Dp = 96.dp, onDone: () -> Unit = {}, modifier: Modifier = Modifier) {
    var elapsed by remember { mutableFloatStateOf(0f) }
    val done by rememberUpdatedState(onDone)

    LaunchedEffect(phase) {
        elapsed = 0f
        if (phase == OnbFaceIdPhase.Idle) return@LaunchedEffect
        val start = withFrameMillis { it }
        while (true) {
            val now = withFrameMillis { it }
            elapsed = (now - start).toFloat()
            if (phase == OnbFaceIdPhase.Failed && elapsed >= SHAKE_MS) break
            if (phase == OnbFaceIdPhase.Success && elapsed >= SUCCESS_DONE) {
                done()
                break
            }
        }
    }

    val t = elapsed
    val frame = when (phase) {
        OnbFaceIdPhase.Idle -> FaceFrame()
        OnbFaceIdPhase.Scanning -> FaceFrame(look = sin((t / 1400f) * PI.toFloat() * 2))
        OnbFaceIdPhase.Failed -> {
            val p = progress(t, 0f, SHAKE_MS)
            FaceFrame(shakeX = sin(p * PI.toFloat() * 6) * 6 * (1 - p))
        }
        OnbFaceIdPhase.Success -> {
            val spinP = progress(t, SPIN_START, SPIN_END)
            FaceFrame(
                morph = easeInOut(progress(t, 0f, MORPH_END)),
                faceOpacity = 1 - progress(t, FACE_FADE_START, FACE_FADE_END),
                spin = easeInOut(spinP) * PI.toFloat() * 2,
                spinColor = sin(spinP * PI.toFloat()),
                check = easeInOut(progress(t, CHECK_START, CHECK_END)),
            )
        }
    }

    Canvas(modifier.size(size)) {
        val unit = this.size.width / 100f
        scale(unit, unit, pivot = Offset.Zero) { drawFace(frame) }
    }
}

private fun DrawScope.drawFace(f: FaceFrame) {
    val strokeColor = lerp(HcColors.Faceid, HcColors.FaceidSpin, f.spinColor)
    val stroke = 5f

    // Frame: one rounded rect whose dashed outline gives four corners (m = 0) or a full circle (m = 1).
    val radius = mix(BRACKET_RADIUS, FRAME / 2, f.morph)
    val side = FRAME - 2 * radius
    val arc = (PI.toFloat() / 2) * radius
    val arm = mix(BRACKET_ARM, side / 2, f.morph)
    val gap = max(0.01f, side - 2 * arm)
    val squash = max(0.08f, abs(cos(f.spin)))
    translate(left = f.shakeX) {
        rotate(-35f, pivot = Offset(50f, 50f)) {
            scale(squash, 1f, pivot = Offset(50f, 50f)) {
                rotate(35f, pivot = Offset(50f, 50f)) {
                    drawPath(
                        roundedFrame(10f, 10f, FRAME, radius),
                        strokeColor,
                        style = Stroke(
                            width = stroke,
                            cap = StrokeCap.Round,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(2 * arm + arc, gap), arm + arc),
                        ),
                    )
                }
            }
        }
    }

    // Face: eyes and nose move more than the mouth when it "turns" (depth).
    if (f.faceOpacity > 0f) {
        val faceStroke = Stroke(width = stroke, cap = StrokeCap.Round, join = StrokeJoin.Round)
        val faceColor = HcColors.Faceid.copy(alpha = f.faceOpacity)
        translate(left = f.shakeX) {
            translate(left = f.look * 5) {
                drawPath(Path().apply { moveTo(36f, 37f); lineTo(36f, 44f) }, faceColor, style = faceStroke)
                drawPath(Path().apply { moveTo(64f, 37f); lineTo(64f, 44f) }, faceColor, style = faceStroke)
            }
            translate(left = f.look * 6) {
                drawPath(Path().apply { moveTo(51f, 38f); lineTo(51f, 51f); lineTo(47f, 51f) }, faceColor, style = faceStroke)
            }
            translate(left = f.look * 3) {
                drawPath(Path().apply { moveTo(38f, 63f); cubicTo(45f, 69f, 55f, 69f, 62f, 63f) }, faceColor, style = faceStroke)
            }
        }
    }

    // Tick, drawn by sliding the dash in.
    if (f.check > 0f) {
        drawPath(
            Path().apply { moveTo(33f, 51f); lineTo(45f, 63f); lineTo(67f, 39f) },
            HcColors.Faceid,
            style = Stroke(
                width = stroke,
                cap = StrokeCap.Round,
                join = StrokeJoin.Round,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(CHECK_LENGTH, CHECK_LENGTH), CHECK_LENGTH * (1 - f.check)),
            ),
        )
    }
}

/** Same outline as SVG <rect rx>: starts at (x + r, y) and runs clockwise. */
private fun roundedFrame(x: Float, y: Float, size: Float, r: Float): Path = Path().apply {
    val right = x + size
    val bottom = y + size
    moveTo(x + r, y)
    lineTo(right - r, y)
    arcTo(Rect(right - 2 * r, y, right, y + 2 * r), -90f, 90f, false)
    lineTo(right, bottom - r)
    arcTo(Rect(right - 2 * r, bottom - 2 * r, right, bottom), 0f, 90f, false)
    lineTo(x + r, bottom)
    arcTo(Rect(x, bottom - 2 * r, x + 2 * r, bottom), 90f, 90f, false)
    lineTo(x, y + r)
    arcTo(Rect(x, y, x + 2 * r, y + 2 * r), 180f, 90f, false)
    close()
}
