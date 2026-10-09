package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import kotlin.math.roundToInt

/**
 * src/components/hf/HfProgressStepper.tsx — shared HelloFresh step indicator:
 * a dot per step, lines between the dots (the line after the active step is
 * filled by `progress` 0–1), a label under each dot (first left-aligned, last
 * right-aligned, the rest centred under their dot).
 */
@Composable
fun SettingsProgressStepper(steps: List<String>, current: Int, progress: Float, modifier: Modifier = Modifier) {
    val last = steps.lastIndex
    val fraction = progress.coerceIn(0f, 1f)
    Column(modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            steps.forEachIndexed { index, _ ->
                Box(Modifier.size(8.dp).clip(CircleShape).background(if (index <= current) HcColors.ProgressDark else HcColors.Inactive))
                if (index < last) {
                    val fill = when {
                        index < current -> 1f
                        index == current -> fraction
                        else -> 0f
                    }
                    Box(Modifier.weight(1f).height(3.dp).clip(RoundedCornerShape(50)).background(HcColors.Inactive)) {
                        if (fill > 0f) Box(Modifier.fillMaxWidth(fill).fillMaxHeight().clip(RoundedCornerShape(50)).background(HcColors.Progress))
                    }
                }
            }
        }
        Layout(
            content = {
                steps.forEachIndexed { index, step ->
                    HcText(step, if (index == current) HcTypeRoles.ProgressActive else HcTypeRoles.ProgressInactive, maxLines = 1)
                }
            },
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
        ) { measurables, constraints ->
            val width = constraints.maxWidth
            val placeables = measurables.map { it.measure(Constraints(maxWidth = width)) }
            val height = placeables.maxOfOrNull { it.height } ?: 0
            layout(width, height) {
                placeables.forEachIndexed { index, p ->
                    val x = when {
                        index == 0 -> 0
                        index == last -> width - p.width
                        else -> ((width * index.toFloat() / last) - p.width / 2f).roundToInt()
                    }
                    p.place(x, 0)
                }
            }
        }
    }
}
