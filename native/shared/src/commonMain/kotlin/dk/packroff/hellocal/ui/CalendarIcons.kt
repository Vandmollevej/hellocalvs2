package dk.packroff.hellocal.ui

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import dk.packroff.hellocal.api.Api
import dk.packroff.hellocal.theme.HcColors

// The user's own PNG artwork from the web app's public/icons (used as-is, never
// redrawn — docs/DECISIONS.md 2026-09-27). On the web they are CSS masks that
// take the text colour; here the PNG is tinted with the same colour (SrcIn).

/** A public/icons PNG drawn in one colour, like the web's CSS-mask icons. */
@Composable
fun CalendarMaskIcon(src: String, size: Dp, color: Color = HcColors.Black, modifier: Modifier = Modifier) =
    HcMaskIcon(src, size, color, modifier)

/** src/components/hf/IconBathScale.tsx — the one weight icon (bathroom scale). */
@Composable
fun CalendarBathScaleIcon(size: Dp = 20.dp, color: Color = HcColors.Black, modifier: Modifier = Modifier) =
    CalendarMaskIcon("/icons/bathroom-scale.png", size, color, modifier)

/** src/components/icons/WaterGlass.tsx */
@Composable
fun CalendarWaterGlassIcon(size: Dp = 24.dp, color: Color = HcColors.Black, modifier: Modifier = Modifier) =
    CalendarMaskIcon("/icons/water-glass.png", size, color, modifier)

/** src/components/icons/PartyPopper.tsx IconPartyPopper — the målsætning marker. */
@Composable
fun CalendarPartyPopperIcon(size: Dp = 24.dp, color: Color = HcColors.Black, modifier: Modifier = Modifier) =
    CalendarMaskIcon("/icons/party-popper.png", size, color, modifier)

/** PartyPopperImage — the coloured konfettikanon, only for the target-date circle. */
@Composable
fun CalendarPartyPopperImage(size: Dp, modifier: Modifier = Modifier) {
    AsyncImage(
        model = Api.absoluteUrl("/icons/party-popper-color.png"),
        contentDescription = null,
        modifier = modifier.size(size),
        contentScale = ContentScale.Fit,
    )
}
