package dk.packroff.hellocal.app

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.nav.Location
import dk.packroff.hellocal.nav.Navigator
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.HcText
import dk.packroff.hellocal.ui.icons.HcIcon

/**
 * src/components/BottomNav.tsx + src/lib/navigation.ts. Same items, same keys,
 * same default four (Tilføj, Madvarer, Kalender, Statistik).
 * TODO(parity): rearranging icons by long-press (Seriøs) and "Skift konto".
 */
data class NavItem(val key: String, val href: String, val labelKey: String, val icon: String)

object NavItems {
    val all = listOf(
        NavItem("tilfoej", "/", "add", "Plus"),
        NavItem("madvarer", "/foods", "foods", "Apple"),
        NavItem("kalender", "/calendar", "calendar", "Calendar"),
        NavItem("statistik", "/statistics", "statistics", "trend"),
        NavItem("kamera", "/camera", "camera", "Camera"),
        NavItem("soeg", "/search", "search", "Search"),
        NavItem("stemme", "/voice", "voice", "Microphone"),
        NavItem("profil", "/profile", "profile", "User"),
        NavItem("favoritter", "/favorites", "favorites", "Heart"),
        NavItem("viden", "/viden-om", "knowledge", "Bulb"),
        NavItem("opskrifter", "/profile/recipes", "recipes", "Book2"),
        NavItem("status", "/profile/status", "status", "ChartLine"),
        NavItem("billeddagbog", "/profile/photo-diary", "photoDiary", "Photo"),
        NavItem("kropsmaal", "/profile/body-measurements", "bodyMeasurements", "Ruler"),
    )
    val defaultActive = listOf("tilfoej", "madvarer", "kalender", "statistik")
}

@Composable
fun BottomNav(navigator: Navigator) {
    val t = LocalTranslator.current
    val items = NavItems.defaultActive.mapNotNull { key -> NavItems.all.firstOrNull { it.key == key } }
    Row(
        Modifier.fillMaxWidth().background(HcColors.Nav).padding(top = 8.dp, bottom = 4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        for (item in items) {
            val active = navigator.current.path == item.href
            val color = if (active) HcColors.Action else HcColors.TextSecondary
            Column(
                Modifier.width(64.dp).height(56.dp).clickable { navigator.switchTab(Location(item.href)) },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
            ) {
                if (item.icon == "trend") TrendIcon(color) else HcIcon(item.icon, size = 24.dp, color = color, stroke = 1.6f)
                HcText(t.t("nav.${item.labelKey}"), HcTypeRoles.Tab, color = color, maxLines = 1)
            }
        }
    }
}

/** TrendIcon in BottomNav.tsx (polyline 2,19 9,12 14,15 22,3 with dots). */
@Composable
fun TrendIcon(color: Color, size: Int = 24) {
    Canvas(Modifier.size(size.dp)) {
        val s = this.size.width / 24f
        val pts = listOf(Offset(2f, 19f), Offset(9f, 12f), Offset(14f, 15f), Offset(22f, 3f)).map { Offset(it.x * s, it.y * s) }
        val path = Path().apply {
            moveTo(pts[0].x, pts[0].y)
            pts.drop(1).forEach { lineTo(it.x, it.y) }
        }
        drawPath(path, color, style = Stroke(width = 1.6f * s, cap = StrokeCap.Round, join = StrokeJoin.Round))
        listOf(pts[0], pts[2], pts[3]).forEach { drawCircle(color, radius = 1.6f * s, center = it) }
    }
}
