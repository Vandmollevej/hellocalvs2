package dk.packroff.hellocal.ui

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles

/** src/components/ui/Toggle.tsx — the only on/off control (never checkboxes, DECISIONS 2026-09-02). */
@Composable
fun HcToggle(
    checked: Boolean,
    onChange: (Boolean) -> Unit,
    label: String? = null,
    description: String? = null,
    enabled: Boolean = true,
) {
    val knobX by animateDpAsState(if (checked) 21.dp else 0.dp)
    val switch = @Composable {
        Box(
            Modifier.size(63.dp, 28.dp).alpha(if (enabled) 1f else 0.5f).clip(RoundedCornerShape(50))
                .background(if (checked) HcColors.Green else HcColors.TanDark)
                .clickable(enabled = enabled) { onChange(!checked) },
        ) {
            Box(
                Modifier.padding(2.dp).offset(x = knobX).size(38.dp, 24.dp).shadow(1.dp, RoundedCornerShape(50))
                    .background(HcColors.White, RoundedCornerShape(50)),
            )
        }
    }
    if (label == null) {
        switch()
        return
    }
    HcCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                HcText(label, HcTypeRoles.Body, bold = true, color = HcColors.Black)
                if (description != null) {
                    HorizontalDivider(Modifier.padding(top = 8.dp), thickness = 1.dp, color = HcColors.TanDark)
                    HcText(description, HcTypeRoles.Small, Modifier.padding(top = 8.dp), color = HcColors.TextSecondary)
                }
            }
            Box(Modifier.padding(top = 4.dp)) { switch() }
        }
    }
}

enum class ChevronDirection(val degrees: Float) { Right(0f), Down(90f), Up(-90f), Left(180f) }

/** src/components/hf/HfChevron.tsx — the one allowed chevron (design.md §6.7). */
@Composable
fun HcChevron(direction: ChevronDirection = ChevronDirection.Right, compact: Boolean = false, color: Color = HcColors.Action) {
    val size = if (compact) 16.dp else 20.dp
    Canvas(Modifier.size(size).rotate(direction.degrees)) {
        val s = this.size.width / 20f
        val path = Path().apply {
            moveTo(7.5f * s, 4.5f * s)
            lineTo(13f * s, 10f * s)
            lineTo(7.5f * s, 15.5f * s)
        }
        drawPath(path, color, style = Stroke(width = (if (compact) 2.25f else 2.5f) * s, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}
