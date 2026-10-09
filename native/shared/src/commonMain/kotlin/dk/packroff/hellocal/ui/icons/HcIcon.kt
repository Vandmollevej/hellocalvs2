package dk.packroff.hellocal.ui.icons

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.theme.HcColors

/**
 * A Tabler icon by its web name without the "Icon" prefix — `<IconPlus size={24}
 * stroke={1.6} />` on the web is `HcIcon("Plus", size = 24.dp, stroke = 1.6f)` here.
 */
@Composable
fun HcIcon(
    name: String,
    modifier: Modifier = Modifier,
    size: Dp = 24.dp,
    color: Color = HcColors.Action,
    stroke: Float = 2f,
    contentDescription: String? = null,
) {
    val vector = remember(name, stroke) { tablerVector(name, stroke) } ?: return
    Icon(vector, contentDescription, modifier.size(size), tint = color)
}

private val cache = mutableMapOf<Pair<String, Float>, ImageVector?>()

fun tablerVector(name: String, stroke: Float = 2f): ImageVector? = cache.getOrPut(name to stroke) {
    val (filled, paths) = TablerData.icons[name.removePrefix("Icon")] ?: return@getOrPut null
    ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f).apply {
        for (d in paths) {
            if (filled) {
                addPath(pathData = addPathNodes(d), fill = SolidColor(Color.Black))
            } else {
                addPath(
                    pathData = addPathNodes(d),
                    stroke = SolidColor(Color.Black),
                    strokeLineWidth = stroke,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                )
            }
        }
    }.build()
}
