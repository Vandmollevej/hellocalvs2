package dk.packroff.hellocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import dk.packroff.hellocal.i18n.LocalTranslator
import dk.packroff.hellocal.platform.NativeHooks
import dk.packroff.hellocal.theme.HcColors
import dk.packroff.hellocal.theme.HcDimens
import dk.packroff.hellocal.theme.HcTypeRoles
import dk.packroff.hellocal.ui.icons.HcIcon

/** Hello Doc panels in default order (src/lib/insight-layout.ts INSIGHT_PANELS). */
val HelloDocPanels = listOf("weight", "food", "vitamins", "fluid")

private val HelloDocPanelLabelKey = mapOf(
    "weight" to "helloDoc.preview.weightSection",
    "food" to "helloDoc.preview.foodSection",
    "vitamins" to "helloDoc.preview.vitaminsSection",
    "fluid" to "helloDoc.preview.fluidSection",
)

private const val STORAGE_KEY = "hellodoc.dashboardLayout"

/** The recipient's own dashboard composition: which panels, in which order (kept on the phone). */
class HelloDocDashboardLayout {
    var order by mutableStateOf(HelloDocPanels)
        private set
    var hidden by mutableStateOf(emptySet<String>())
        private set

    init {
        // "order|hidden", both comma separated; unknown ids are dropped, missing ones appended.
        val raw = runCatching { NativeHooks.secureStorage.get(STORAGE_KEY) }.getOrNull()
        if (raw != null) {
            val parts = raw.split("|")
            val kept = parts.getOrElse(0) { "" }.split(",").filter { it in HelloDocPanels }.distinct()
            order = kept + HelloDocPanels.filter { it !in kept }
            hidden = parts.getOrElse(1) { "" }.split(",").filter { it in HelloDocPanels }.toSet()
        }
    }

    fun toggle(id: String) {
        hidden = if (id in hidden) hidden - id else hidden + id
        save()
    }

    fun move(id: String, direction: Int) {
        val index = order.indexOf(id)
        val target = index + direction
        if (index < 0 || target < 0 || target >= order.size) return
        val moved = order.toMutableList()
        moved[index] = moved[target]
        moved[target] = id
        order = moved
        save()
    }

    private fun save() {
        runCatching { NativeHooks.secureStorage.set(STORAGE_KEY, order.joinToString(",") + "|" + hidden.joinToString(",")) }
    }

    /** Panels to draw: the chosen order, minus hidden ones. */
    fun visible(): List<String> = order.filter { it !in hidden }
}

@Composable
fun rememberHelloDocDashboardLayout(): HelloDocDashboardLayout = remember { HelloDocDashboardLayout() }

/** InsightMenu.tsx: burger button with a dropdown to show/hide and reorder the panels. */
@Composable
fun HelloDocDashboardMenu(
    layout: HelloDocDashboardLayout,
    available: List<String> = HelloDocPanels,
    extraRows: @Composable ColumnScope.(close: () -> Unit) -> Unit = {},
) {
    val t = LocalTranslator.current
    var open by remember { mutableStateOf(false) }
    val rows = layout.order.filter { it in available }

    Box {
        Box(
            Modifier.size(44.dp).clip(CircleShape).clickable { open = !open },
            contentAlignment = Alignment.Center,
        ) {
            HcIcon("Menu2", size = 22.dp, stroke = 2f, color = HcColors.Black, contentDescription = t.t("helloDoc.dashboard.menu"))
        }
        if (open) {
            val offsetY = with(LocalDensity.current) { 48.dp.roundToPx() }
            Popup(
                alignment = Alignment.TopEnd,
                offset = IntOffset(0, offsetY),
                onDismissRequest = { open = false },
                properties = PopupProperties(focusable = true),
            ) {
                val shape = RoundedCornerShape(HcDimens.RadiusCard)
                Column(
                    Modifier.width(288.dp).shadow(8.dp, shape).clip(shape).background(HcColors.Surface, shape)
                        .border(1.dp, HcColors.Nav, shape).padding(4.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    HcText(
                        t.t("helloDoc.dashboard.menuTitle"),
                        HcTypeRoles.Caption,
                        Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        color = HcColors.TextSecondary,
                    )
                    rows.forEachIndexed { index, id ->
                        val isHidden = id in layout.hidden
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = HcDimens.ControlHeight).padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Row(
                                Modifier.weight(1f).clickable { layout.toggle(id) },
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                HcIcon(if (isHidden) "EyeOff" else "Eye", size = 18.dp, stroke = 2f, color = HcColors.Black)
                                HcText(
                                    t.t(HelloDocPanelLabelKey.getValue(id)),
                                    HcTypeRoles.Body,
                                    color = if (isHidden) HcColors.TextSecondary else HcColors.Black,
                                    maxLines = 1,
                                )
                            }
                            Box(
                                Modifier.size(36.dp).clip(CircleShape).alpha(if (index == 0) 0.3f else 1f)
                                    .clickable(enabled = index > 0) { layout.move(id, -1) },
                                contentAlignment = Alignment.Center,
                            ) {
                                HcIcon("ArrowUp", size = 18.dp, stroke = 2f, color = HcColors.Black, contentDescription = t.t("helloDoc.dashboard.moveUp"))
                            }
                            Box(
                                Modifier.size(36.dp).clip(CircleShape).alpha(if (index == rows.lastIndex) 0.3f else 1f)
                                    .clickable(enabled = index < rows.lastIndex) { layout.move(id, 1) },
                                contentAlignment = Alignment.Center,
                            ) {
                                HcIcon("ArrowDown", size = 18.dp, stroke = 2f, color = HcColors.Black, contentDescription = t.t("helloDoc.dashboard.moveDown"))
                            }
                        }
                    }
                    extraRows { open = false }
                }
            }
        }
    }
}
