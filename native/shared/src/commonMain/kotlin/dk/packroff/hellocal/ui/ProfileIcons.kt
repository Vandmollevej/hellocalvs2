package dk.packroff.hellocal.ui

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.theme.HcColors

// Hand-drawn web icons the profile screens use (src/components/icons/*).
// SVG ones are rebuilt from the same path data; PNG ones (the user's own
// artwork, drawn on the web with a CSS mask) are loaded as-is and tinted —
// never redrawn (docs/DECISIONS.md 2026-09-27).

/** A PNG icon from public/ tinted like `currentColor` (the web's CSS mask). */
@Composable
fun ProfileMaskIcon(src: String, size: Dp = 24.dp, color: Color = HcColors.Black, modifier: Modifier = Modifier) =
    HcMaskIcon(src, size, color, modifier)

/** IconBathScale / IconBathroomScale — public/icons/bathroom-scale.png. */
@Composable
fun ProfileBathScaleIcon(size: Dp = 20.dp, color: Color = HcColors.Black) = ProfileMaskIcon("/icons/bathroom-scale.png", size, color)

/** IconPartyPopper — public/icons/party-popper.png. */
@Composable
fun ProfilePartyPopperIcon(size: Dp = 24.dp, color: Color = HcColors.Black) = ProfileMaskIcon("/icons/party-popper.png", size, color)

/** IconWaistMeasure — female figure for FEMALE, male otherwise. */
@Composable
fun ProfileWaistMeasureIcon(sex: String?, size: Dp = 24.dp, color: Color = HcColors.Black) =
    ProfileMaskIcon(if (sex == "FEMALE") "/icons/body-measurements/waist-female.png" else "/icons/body-measurements/waist-male.png", size, color)

/** Outline icons hand-authored on the web in the tabler style. */
enum class ProfileVectorIcon { PhotoFrame, PlateCutlery, ToiletCheck, ToiletOff, PersonClothed, PersonUnclothed, PlateFull, PlateEmpty, FaceId }

@Composable
fun ProfileIcon(icon: ProfileVectorIcon, size: Dp = 24.dp, color: Color = HcColors.Black, stroke: Float = 2f) {
    val vector = remember(icon, stroke) { profileVector(icon, stroke) }
    Icon(vector, null, Modifier.size(size), tint = color)
}

private fun circle(cx: Float, cy: Float, r: Float) = "M${cx - r} ${cy}a$r $r 0 1 0 ${2 * r} 0a$r $r 0 1 0 ${-2 * r} 0"

private fun line(x1: Float, y1: Float, x2: Float, y2: Float) = "M$x1 ${y1}L$x2 $y2"

private fun rect(x: Float, y: Float, w: Float, h: Float, rx: Float) =
    "M${x + rx} ${y}h${w - 2 * rx}a$rx $rx 0 0 1 $rx ${rx}v${h - 2 * rx}a$rx $rx 0 0 1 ${-rx} ${rx}h${-(w - 2 * rx)}a$rx $rx 0 0 1 ${-rx} ${-rx}v${-(h - 2 * rx)}a$rx $rx 0 0 1 $rx ${-rx}z"

private const val TOILET_1 = "M4 4h4v7H4z"
private const val TOILET_2 = "M4 11h14v1a5 5 0 0 1 -5 5h-4a5 5 0 0 1 -5 -5z"
private const val TOILET_3 = "M9 17l-1 4h7l-1 -4"

/** (stroked paths, filled paths) per icon — copied from the web SVGs. */
private fun iconPaths(icon: ProfileVectorIcon): Pair<List<String>, List<String>> = when (icon) {
    // src/components/icons/PhotoFrame.tsx
    ProfileVectorIcon.PhotoFrame -> listOf(
        rect(3f, 3f, 18f, 18f, 1.5f),
        rect(6.5f, 6.5f, 11f, 11f, 0.5f),
        circle(14.6f, 9.8f, 1f),
        "M6.5 15.5l3.2-3.2 2.6 2.6 1.6-1.6 3.6 3.6",
    ) to emptyList()
    // src/components/icons/PlateCutlery.tsx
    ProfileVectorIcon.PlateCutlery -> listOf(
        circle(12f, 12f, 6.5f),
        circle(12f, 12f, 3f),
        line(1.6f, 2.5f, 1.6f, 8f),
        line(3f, 2.5f, 3f, 8f),
        line(4.4f, 2.5f, 4.4f, 8f),
        line(3f, 8f, 3f, 21.5f),
        "M20.4 2.5c2 2 2 6.5 0 9",
        line(19.2f, 2.5f, 19.2f, 11.5f),
        line(20f, 11.5f, 20f, 21.5f),
    ) to emptyList()
    // src/components/icons/WeighConditions.tsx
    ProfileVectorIcon.ToiletCheck -> listOf(TOILET_1, TOILET_2, TOILET_3, "M12 5.5l2 2l4.5 -4.5") to emptyList()
    ProfileVectorIcon.ToiletOff -> listOf(TOILET_1, TOILET_2, TOILET_3, "M3 3l18 18") to emptyList()
    ProfileVectorIcon.PersonClothed -> listOf(
        circle(12f, 3.5f, 2f),
        "M9 7.5h6l4.5 3.5l-1.5 2l-2.5 -1.5v3.5h-7v-3.5l-2.5 1.5l-1.5 -2z",
        "M8.5 15l.5 7h2.5l.5 -4.5l.5 4.5h2.5l.5 -7",
    ) to emptyList()
    ProfileVectorIcon.PersonUnclothed -> listOf(
        circle(12f, 3.5f, 2f),
        "M12 7v8",
        "M5.5 13l6.5 -5l6.5 5",
        "M8 22l4 -7l4 7",
    ) to emptyList()
    ProfileVectorIcon.PlateFull -> listOf(
        circle(12f, 12f, 9f),
        circle(10f, 10f, 2f),
        circle(14.5f, 11f, 1.5f),
        circle(11f, 14.5f, 1.5f),
    ) to listOf(circle(10f, 10f, 2f), circle(14.5f, 11f, 1.5f), circle(11f, 14.5f, 1.5f))
    ProfileVectorIcon.PlateEmpty -> listOf(circle(12f, 12f, 9f), circle(12f, 12f, 5.5f)) to emptyList()
    // src/components/icons/FaceIdIcon.tsx (1200-unit viewBox, scaled in profileVector)
    ProfileVectorIcon.FaceId -> listOf(
        "M375 175H280a105 105 0 0 0-105 105v95",
        "M825 175h95a105 105 0 0 1 105 105v95",
        "M175 800v120a105 105 0 0 0 105 105h95",
        "M1025 800v120a105 105 0 0 1-105 105h-95",
        "M400 450v75",
        "M800 450v75",
        "M625 450v175a50 50 0 0 1-50 50h-25",
        "M442 775c95 67 221 67 316 0",
    ) to emptyList()
}

private fun profileVector(icon: ProfileVectorIcon, stroke: Float): ImageVector {
    val faceId = icon == ProfileVectorIcon.FaceId
    val viewport = if (faceId) 1200f else 24f
    val strokeWidth = if (faceId) 50f else stroke
    val (stroked, filled) = iconPaths(icon)
    return ImageVector.Builder(name = icon.name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = viewport, viewportHeight = viewport).apply {
        for (d in filled) addPath(pathData = addPathNodes(d), fill = SolidColor(Color.Black))
        for (d in stroked) {
            addPath(
                pathData = addPathNodes(d),
                stroke = SolidColor(Color.Black),
                strokeLineWidth = strokeWidth,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
    }.build()
}
