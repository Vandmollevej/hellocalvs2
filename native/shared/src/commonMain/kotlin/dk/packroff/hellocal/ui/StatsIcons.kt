package dk.packroff.hellocal.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.theme.HcColors

/**
 * src/components/icons/Drumstick.tsx — two-coloured chicken leg (meat-brown
 * meat, white bone with a meat-coloured edge). Always two-coloured.
 */
@Composable
fun StatsDrumstickIcon(size: Dp = 24.dp, modifier: Modifier = Modifier) {
    val meat = remember {
        PathParser().parsePathString("M14.6 9.4c2.2 2.9.3 8.4-3.9 11C6.2 23.2 1.4 19.6 2.3 14.4 3.2 9.2 10 6.6 14.6 9.4Z").toPath()
    }
    Canvas(modifier.size(size)) {
        val s = this.size.width / 24f
        scale(s, pivot = Offset.Zero) {
            // Bone: meat-coloured edge under the white, so the edge is drawn in one go.
            drawLine(HcColors.Meat, Offset(14f, 10f), Offset(19f, 5f), strokeWidth = 5.4f, cap = StrokeCap.Round)
            drawCircle(HcColors.Meat, radius = 3.1f, center = Offset(18.9f, 3.1f))
            drawCircle(HcColors.Meat, radius = 3.1f, center = Offset(20.9f, 5.1f))
            drawLine(HcColors.White, Offset(14f, 10f), Offset(19f, 5f), strokeWidth = 3.2f, cap = StrokeCap.Round)
            drawCircle(HcColors.White, radius = 1.9f, center = Offset(18.9f, 3.1f))
            drawCircle(HcColors.White, radius = 1.9f, center = Offset(20.9f, 5.1f))
            drawPath(meat, HcColors.Meat)
        }
    }
}

/**
 * src/components/icons/WaterGlass.tsx — the user's approved PNG artwork
 * (public/icons/water-glass.png, black lines on transparent) tinted like a
 * CSS mask, so it takes the surrounding text colour like the Tabler icons.
 */
@Composable
fun StatsWaterGlassIcon(size: Dp = 24.dp, color: Color = HcColors.Action, modifier: Modifier = Modifier) {
    AsyncImage(
        model = Api.absoluteUrl("/icons/water-glass.png"),
        contentDescription = null,
        modifier = modifier.size(size),
        contentScale = ContentScale.Fit,
        colorFilter = ColorFilter.tint(color),
    )
}
