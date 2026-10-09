package dk.packroff.hellocal.screens.food

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.lerp
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.theme.HcColors
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

// src/components/HomeWaves.tsx + src/lib/home-waves.ts — the lime pulse line
// (heart-rate monitor) behind the top bar and the hero. The wave bundles and
// the fog were removed on the web (user 2026-10-05: `bundles: [], fog: []`),
// so only the pulse is drawn. It beats in the watch's measured pulse
// (/api/health-metrics/heart-rate, polled every minute), 15 bpm without a watch.
// All geometry below is in CSS px = dp, exactly as the web canvas.

/** Pixels drawn outside the view (WAVE_BLEED). */
private const val WAVE_BLEED = 48f

/** The top layer reaches this far below the hero (PULSE_BELOW_HERO). */
private const val PULSE_BELOW_HERO = 18f

/** Px from the pulse baseline up to the middle of the wheel's last row (PULSE_ABOVE_LAST_ROW). */
internal const val PULSE_ABOVE_LAST_ROW = 25f

private const val FRAME_MS = 1000.0 / 30
private const val HEART_RATE_POLL_MS = 60_000L

/** Pulse without a connected watch: one beat every 4 seconds (DEFAULT_PULSE_BPM). */
private const val DEFAULT_PULSE_BPM = 15.0
private const val MIN_PULSE_BPM = 10.0

/** Px over which the old trace's trailing edge fades while it is removed. */
private const val PULSE_TAIL_TAPER = 60f
private const val PULSE_STEP = 1.5f

/** Small, fast seeded random generator (mulberry32), same bits as the web. */
private fun mulberry32(seed: Int): () -> Double {
    var a = seed
    return {
        a += 0x6d2b79f5
        var t = a
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + (t xor (t ushr 7)) * (t or 61))
        ((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL).toDouble() / 4294967296.0
    }
}

/** The web's `Pulse` (+ the scene's startTime). */
private class PulseScene(
    /** Baseline as a share of the height (fallback when the wheel is not measured yet). */
    val y: Double,
    /** Beat height in px. */
    val amplitude: Double,
    /** Seconds one sweep takes across the screen. */
    val sweep: Double,
    val offset: Double,
    val seed: Long,
    val startTime: Double,
) {
    /** The pulse is locked per sweep, so beats do not move if the pulse changes mid-sweep. */
    val lockedBpm = HashMap<Int, Double>()
}

/** createWaveScene(seed, "top") — only the pulse part is still used. */
private fun createPulseScene(seed: Int): PulseScene {
    val rand = mulberry32(seed)
    fun between(a: Double, b: Double) = a + (b - a) * rand()
    val y = between(0.58, 0.62)
    val amplitude = between(18.0, 26.0)
    val sweep = between(3.0, 4.0)
    val offset = between(0.0, 20.0)
    val pulseSeed = floor(rand() * 4294967296.0).toLong()
    val startTime = between(0.0, 600.0)
    return PulseScene(y, amplitude, sweep, offset, pulseSeed, startTime)
}

/** One heartbeat (P, QRS, T); u is the distance from the R peak in beat widths. Negative = up. */
private fun heartbeatShape(u: Double): Double {
    fun g(center: Double, w: Double): Double {
        val k = (u - center) / w
        return exp(-(k * k))
    }
    return -0.12 * g(-0.3, 0.06) + 0.14 * g(-0.055, 0.018) - 1 * g(0.0, 0.022) + 0.32 * g(0.05, 0.022) - 0.22 * g(0.3, 0.075)
}

/** The pulse for a sweep: the one that applied when the sweep started. */
private fun bpmForCycle(pulse: PulseScene, cycle: Int, bpm: Double): Double {
    val locked = pulse.lockedBpm[cycle]
    if (locked != null) return locked
    pulse.lockedBpm[cycle] = bpm
    pulse.lockedBpm.keys.filter { it < cycle - 1 }.forEach { pulse.lockedBpm.remove(it) }
    return bpm
}

/** Vertical deflection at x for one sweep: a beat every 60/bpm seconds in the sweep's own time. */
private fun pulseTrace(pulse: PulseScene, cycle: Int, bpm: Double, width: Float): (Float) -> Float {
    val left = -WAVE_BLEED
    val span = width + WAVE_BLEED * 2
    val speed = span / pulse.sweep
    val beatSeconds = max(90.0, min(150.0, width * 0.3)) / speed
    val safeBpm = if (bpm.isFinite()) bpm else DEFAULT_PULSE_BPM
    val interval = 60.0 / min(220.0, max(MIN_PULSE_BPM, safeBpm))
    val cycleRand = mulberry32((pulse.seed + cycle).toInt())
    val firstBeat = cycleRand() * interval
    val beatAt = ArrayList<Double>()
    val beatAmplitude = ArrayList<Double>()
    var at = firstBeat - interval
    while (at < pulse.sweep + interval) {
        beatAt += at
        beatAmplitude += pulse.amplitude * (0.88 + 0.24 * cycleRand())
        at += interval
    }
    return { x ->
        val time = ((x - left) / span) * pulse.sweep
        var y = 0.0
        for (i in beatAt.indices) {
            val u = (time - beatAt[i]) / beatSeconds
            if (u > -1 && u < 1) y += beatAmplitude[i] * heartbeatShape(u)
        }
        y.toFloat()
    }
}

/**
 * drawPulse: a lime trace drawn from the left edge to the right like a heart
 * monitor. The next sweep starts at once from the left and removes the previous
 * one from behind (with a soft edge), at the same pace as the trace appeared.
 */
private fun DrawScope.drawPulse(
    pulse: PulseScene,
    t: Double,
    width: Float,
    bpm: Double,
    baseY: Float,
    pulseColor: Color,
    coreColor: Color,
) {
    val time = t + pulse.offset
    val cycle = floor(time / pulse.sweep).toInt()
    val progress = (time - cycle * pulse.sweep) / pulse.sweep
    val left = -WAVE_BLEED
    val right = width + WAVE_BLEED
    val head = (left + progress * (right - left)).toFloat()

    // A little fainter at the edge than at the tip, but visible all the way in.
    fun fade(color: Color, to: Float, taperFrom: Float?): Brush {
        val end = max(to, left + 1)
        val stops = ArrayList<Pair<Float, Color>>()
        stops += 0f to color.copy(alpha = 0.55f)
        if (taperFrom != null) {
            val span = end - left
            val start = min(1f, max(0f, (taperFrom - left) / span))
            val stop = min(1f, max(start, (taperFrom + PULSE_TAIL_TAPER - left) / span))
            stops += start to color.copy(alpha = 0f)
            stops += stop to color.copy(alpha = 0.55f + 0.45f * stop)
        }
        stops += 1f to color.copy(alpha = 1f)
        return Brush.linearGradient(*stops.toTypedArray(), start = Offset(left, 0f), end = Offset(end, 0f))
    }

    fun strokeTrace(from: Float, to: Float, yAt: (Float) -> Float, gradientEnd: Float, taperFrom: Float?) {
        val path = Path()
        path.moveTo(from, baseY + yAt(from))
        var x = from + PULSE_STEP
        while (x < to) {
            path.lineTo(x, baseY + yAt(x))
            x += PULSE_STEP
        }
        path.lineTo(to, baseY + yAt(to))
        drawPath(path, fade(pulseColor, gradientEnd, taperFrom), alpha = 0.25f, style = Stroke(width = 5f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawPath(path, fade(coreColor, gradientEnd, taperFrom), alpha = 0.85f, style = Stroke(width = 1.6f, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }

    val yAt = pulseTrace(pulse, cycle, bpmForCycle(pulse, cycle, bpm), width)
    if (head > left) strokeTrace(left, head, yAt, head, null)

    // The previous sweep stays unchanged ahead of the tip and is removed from behind.
    val eraseFrom = head + 28
    if (eraseFrom < right) {
        val previous = pulseTrace(pulse, cycle - 1, bpmForCycle(pulse, cycle - 1, bpm), width)
        strokeTrace(eraseFrom, right, previous, right, eraseFrom)
    }

    // Small glowing point at the tip (a round-capped 0.01 px line = a dot).
    val tip = Offset(head, baseY + yAt(head))
    drawCircle(pulseColor, radius = 4.5f, center = tip, alpha = 0.3f)
    drawCircle(coreColor, radius = 1.5f, center = tip, alpha = 1f)
}

/** The watch's current pulse, or DEFAULT_PULSE_BPM without a watch/fresh measurement. */
private suspend fun fetchPulseBpm(): Double = try {
    val data = Api.get("/api/health-metrics/heart-rate") as? JsonObject
    val heartRate = data?.get("heartRate") as? JsonObject
    val bpm = (heartRate?.get("bpm") as? JsonPrimitive)?.doubleOrNull
    if (bpm != null && bpm.isFinite()) bpm else DEFAULT_PULSE_BPM
} catch (e: Exception) {
    DEFAULT_PULSE_BPM
}

/**
 * HomeWaves variant "top": fills the top block (top bar + hero) and reaches
 * PULSE_BELOW_HERO below it. [pulseY] is the baseline in dp from the block's
 * top (just above the stats wheel's last number); null until measured.
 */
@Composable
fun HomeWaves(pulseY: Float?, modifier: Modifier = Modifier) {
    val scene = remember { createPulseScene(Random.nextInt()) }
    var clock by remember { mutableStateOf(scene.startTime) }
    var bpm by remember { mutableStateOf(DEFAULT_PULSE_BPM) }

    // requestAnimationFrame at 30 fps; the clock never jumps more than 0.1 s.
    LaunchedEffect(scene) {
        var last = withFrameNanos { it }
        while (true) {
            val now = withFrameNanos { it }
            val elapsedMs = (now - last) / 1_000_000.0
            if (elapsedMs < FRAME_MS) continue
            clock += min(0.1, elapsedMs / 1000.0)
            last = now
        }
    }

    // Integrations sync every 15 minutes; one lookup a minute is plenty.
    LaunchedEffect(scene) {
        while (true) {
            bpm = fetchPulseBpm()
            delay(HEART_RATE_POLL_MS)
        }
    }

    val pulseColor = HcColors.Lime
    val coreColor = lerp(HcColors.Lime, HcColors.Brand, 0.18f)
    Canvas(modifier) {
        val d = density
        val width = size.width / d
        val height = size.height / d
        if (width <= 0f || height <= 0f) return@Canvas
        val baseY = pulseY ?: (scene.y * height).toFloat()
        // .home-wave: overflow hidden, reaching PULSE_BELOW_HERO under the block.
        clipRect(left = 0f, top = 0f, right = size.width, bottom = size.height + PULSE_BELOW_HERO * d) {
            scale(scale = d, pivot = Offset.Zero) {
                drawPulse(scene, clock, width, bpm, baseY, pulseColor, coreColor)
            }
        }
    }
}
