package dk.packroff.hellocal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRole
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.icons.HcIcon
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// Custom (non-Tabler) icons and small drawings used by the settings screens.
// The web's PNG icons (public/icons/*.png) are shown as-is with HcRemoteImage,
// never redrawn (docs/DECISIONS.md 2026-09-27).

/** src/components/icons/Drumstick.tsx — two-coloured chicken leg (meat + white bone). */
@Composable
fun SettingsDrumstickIcon(size: Dp = 24.dp) {
    val meat = remember { PathParser().parsePathString("M14.6 9.4c2.2 2.9.3 8.4-3.9 11C6.2 23.2 1.4 19.6 2.3 14.4 3.2 9.2 10 6.6 14.6 9.4Z").toPath() }
    Canvas(Modifier.size(size)) {
        val s = this.size.width / 24f
        // Bone: meat-coloured outline under the white.
        drawLine(HcColors.Meat, Offset(14f * s, 10f * s), Offset(19f * s, 5f * s), strokeWidth = 5.4f * s, cap = StrokeCap.Round)
        drawCircle(HcColors.Meat, 3.1f * s, Offset(18.9f * s, 3.1f * s))
        drawCircle(HcColors.Meat, 3.1f * s, Offset(20.9f * s, 5.1f * s))
        drawLine(HcColors.White, Offset(14f * s, 10f * s), Offset(19f * s, 5f * s), strokeWidth = 3.2f * s, cap = StrokeCap.Round)
        drawCircle(HcColors.White, 1.9f * s, Offset(18.9f * s, 3.1f * s))
        drawCircle(HcColors.White, 1.9f * s, Offset(20.9f * s, 5.1f * s))
        scale(s, s, pivot = Offset.Zero) { drawPath(meat, HcColors.Meat) }
    }
}

/**
 * An icon by name for the settings lists: Tabler names go through HcIcon, the
 * web's custom icons are drawn here or loaded from public/.
 */
@Composable
fun SettingsNamedIcon(name: String, size: Dp = 20.dp) {
    when (name) {
        "Drumstick" -> SettingsDrumstickIcon(size)
        "WaterGlass" -> HcRemoteImage("/icons/water-glass.png", Modifier.size(size))
        "PaymentCard" -> SettingsPaymentCardIcon(size)
        else -> HcIcon(name, size = size, color = HcColors.Black)
    }
}

private val ARC_ANGLES = listOf(-75f, -37.5f, 0f, 37.5f, 75f)

/** WheelShape in src/components/FrontPagePreview.tsx — green half disk with five action circles. */
private fun DrawScope.wheelShape(cx: Float, cy: Float, diskRadius: Float, arcRadius: Float, circleRadius: Float, mirror: Boolean, s: Float) {
    val dir = if (mirror) -1f else 1f
    drawArc(
        color = HcColors.Green,
        startAngle = if (mirror) 90f else -90f,
        sweepAngle = 180f,
        useCenter = true,
        topLeft = Offset((cx - diskRadius) * s, (cy - diskRadius) * s),
        size = Size(diskRadius * 2 * s, diskRadius * 2 * s),
    )
    for (deg in ARC_ANGLES) {
        val theta = deg * PI.toFloat() / 180f
        val center = Offset((cx + dir * arcRadius * cos(theta)) * s, (cy + arcRadius * sin(theta)) * s)
        drawCircle(HcColors.White, circleRadius * s, center)
        drawCircle(HcColors.Black, circleRadius * s, center, style = Stroke(width = 1.2f * s))
    }
}

/** WheelIcon — the "Knapper i hjulet" heading icon (viewBox 0 -2 26 44). */
@Composable
fun SettingsWheelIcon(size: Dp = 30.dp) {
    Canvas(Modifier.width(size * 26f / 44f).height(size)) {
        val s = this.size.height / 44f
        translate(top = 2f * s) { wheelShape(0f, 20f, 9f, 17f, 3.4f, mirror = false, s = s) }
    }
}

/** FrontPagePreview — mini front page with the wheel on [side] and the number slider opposite. */
@Composable
fun SettingsFrontPagePreview(side: String, selected: Boolean) {
    Canvas(Modifier.width(72.dp).height(110.dp)) {
        val s = this.size.width / 72f
        val w = 72f
        val h = 110f
        val heroY = 44f
        val wheelLeft = side == "left"
        val sliderX = if (wheelLeft) w - 26f else 8f
        val clip = Path().apply { addRoundRect(RoundRect(0.5f * s, 0.5f * s, (w - 0.5f) * s, (h - 0.5f) * s, CornerRadius(9f * s))) }
        fun rect(x: Float, y: Float, rw: Float, rh: Float, color: androidx.compose.ui.graphics.Color, r: Float = 0f, alpha: Float = 1f) =
            drawRoundRect(color, Offset(x * s, y * s), Size(rw * s, rh * s), CornerRadius(r * s), alpha = alpha)
        clipPath(clip) {
            rect(0f, 0f, w, h, HcColors.Page)
            rect(0f, 0f, w, 13f, HcColors.Green)
            wheelShape(if (wheelLeft) 0f else w, heroY, 9f, 17f, 3.2f, mirror = !wheelLeft, s = s)
            rect(sliderX + 3f, heroY - 13f, 12f, 3f, HcColors.Black, r = 1.5f, alpha = 0.25f)
            rect(sliderX, heroY - 3f, 18f, 6f, HcColors.Black, r = 2f)
            rect(sliderX + 3f, heroY + 10f, 12f, 3f, HcColors.Black, r = 1.5f, alpha = 0.25f)
            rect(6f, 70f, w - 12f, 10f, HcColors.Tan, r = 3f)
            rect(6f, 83f, w - 12f, 10f, HcColors.Tan, r = 3f)
            rect(0f, h - 11f, w, 11f, HcColors.Nav)
        }
        drawRoundRect(
            color = if (selected) HcColors.SelectedBorder else HcColors.Black,
            topLeft = Offset(0.5f * s, 0.5f * s),
            size = Size((w - 1f) * s, (h - 1f) * s),
            cornerRadius = CornerRadius(9f * s),
            alpha = if (selected) 1f else 0.35f,
            style = Stroke(width = (if (selected) 1.5f else 1f) * s),
        )
    }
}

/**
 * src/components/ui/UncertaintyTilde.tsx — the green "~" in front of an
 * estimated value (about 2.4 × the text size, bold).
 */
@Composable
fun SettingsUncertaintyTilde(role: HcTypeRole = HcTypeRoles.Small, small: Boolean = false) {
    val factor = if (small) 2.6f else 2.4f
    HcText(
        "~",
        HcTypeRole(role.size * factor, FontWeight.Bold, role.size * factor * 0.6f, false, HcColors.Green),
    )
}
