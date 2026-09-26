// Glance widgets 1, 2, 4 and 6 from docs/WIDGETS.md. Widget 3 (swipeable
// charts) is a classic RemoteViews StackView — see ChartWidget.kt — because
// Glance has no swipeable container.
package dk.packroff.hellocal.widgets

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// design.md §3
object HcColors {
    val page = Color(0xFFFAF8F3)
    val card = Color(0xFFEEE9DF)
    val nav = Color(0xFFDFD9CC)
    val brand = Color(0xFF067A46)
    val action = Color(0xFF232323)
    val textSecondary = Color(0xFF656565)
    val danger = Color(0xFFA3271F)
}

private val caption = TextStyle(fontSize = 13.sp, color = ColorProvider(HcColors.action))
private val captionStrong = caption.copy(fontWeight = FontWeight.Bold)
private val captionSecondary = caption.copy(color = ColorProvider(HcColors.textSecondary))

fun openDeepLink(deepLink: String): Action =
    actionStartActivity(Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))

private fun kcal(value: Number) = String.format(Locale("da", "DK"), "%,d", value.toLong()).replace(',', '.')

@Composable
private fun WidgetShell(content: @Composable () -> Unit) {
    Box(
        modifier = GlanceModifier.fillMaxSize().background(HcColors.page).cornerRadius(16.dp).padding(12.dp),
    ) { content() }
}

// --- 1. Quick add ---------------------------------------------------------

class QuickAddWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            WidgetShell {
                Box(
                    modifier = GlanceModifier.fillMaxSize().clickable(openDeepLink("hellocal://add/menu")),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier = GlanceModifier.size(48.dp).background(HcColors.brand).cornerRadius(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Image(ImageProvider(R.drawable.ic_widget_plus), contentDescription = "Tilføj", modifier = GlanceModifier.size(28.dp))
                    }
                }
            }
        }
    }
}

class QuickAddWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = QuickAddWidget()
}

// --- 2. Add row -----------------------------------------------------------

class AddRowWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = SnapshotRepository.cached(context)
        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)
        val keys = WidgetChoices.addRowKeys(context, appWidgetId)
        provideContent {
            val fit = ((LocalSize.current.width.value + 4) / 76).toInt().coerceIn(1, MAX_ADD_ROW_ACTIONS)
            val actions = keys.mapNotNull { key -> snapshot?.addActions?.firstOrNull { it.key == key } }.take(fit)
            WidgetShell {
                Row(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    actions.forEachIndexed { index, action ->
                        if (index > 0) Spacer(GlanceModifier.width(8.dp))
                        Column(
                            modifier = GlanceModifier.defaultWeight().fillMaxHeight().background(HcColors.card)
                                .cornerRadius(12.dp).clickable(openDeepLink(action.deepLink)),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Image(ImageProvider(addActionIcon(action.key)), contentDescription = null, modifier = GlanceModifier.size(24.dp))
                            Text(action.label, style = caption, maxLines = 1)
                        }
                    }
                    if (actions.isEmpty()) Text("Åbn Hello Cal for at logge ind", style = captionSecondary)
                }
            }
        }
    }
}

class AddRowWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AddRowWidget()
}

fun addActionIcon(key: String) = when (key) {
    "microphone" -> R.drawable.ic_widget_microphone
    "ownDishes" -> R.drawable.ic_widget_pot
    "search" -> R.drawable.ic_widget_search
    "weight" -> R.drawable.ic_widget_scale
    "water" -> R.drawable.ic_widget_droplet
    "camera" -> R.drawable.ic_widget_camera
    "targetWeight" -> R.drawable.ic_widget_target
    "bodyMeasurements" -> R.drawable.ic_widget_ruler
    "menstrualCycle" -> R.drawable.ic_widget_calendar_heart
    else -> R.drawable.ic_widget_plus_dark
}

// --- 4. Stat box ----------------------------------------------------------

class StatBoxWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = SnapshotRepository.cached(context)
        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)
        val box = snapshot?.statBox(WidgetChoices.statBoxKey(context, appWidgetId))
        provideContent {
            WidgetShell {
                Column(
                    modifier = GlanceModifier.fillMaxSize().clickable(openDeepLink(box?.deepLink ?: "hellocal://statistics")),
                ) {
                    Text(box?.label ?: "—", style = captionStrong, maxLines = 2)
                    Spacer(GlanceModifier.defaultWeight())
                    box?.progress?.let { progress ->
                        // Glance can't draw arcs, so the ring is a bitmap (ChartRenderer.ring).
                        val density = context.resources.displayMetrics.density
                        Box(modifier = GlanceModifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            Image(
                                ImageProvider(ChartRenderer.ring(progress, (56 * density).toInt(), density)),
                                contentDescription = null,
                                modifier = GlanceModifier.size(56.dp),
                            )
                        }
                        Spacer(GlanceModifier.defaultWeight())
                    }
                    Text(
                        box?.value ?: "—",
                        style = TextStyle(
                            fontSize = if (box?.progress != null) 15.sp else 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(HcColors.action),
                        ),
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

class StatBoxWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = StatBoxWidget()
}

// --- 6. Recent entries (free height) --------------------------------------

private val timeFormat = DateTimeFormatter.ofPattern("HH.mm")

private fun time(iso: String) = runCatching {
    OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).format(timeFormat)
}.getOrDefault("")

/** Same rule as recentEntriesRowsForHeight() in src/lib/widgets.ts. */
fun recentRowsForHeight(heightDp: Float) = ((heightDp - 40) / 36).toInt().coerceIn(1, 12)

class RecentEntriesWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = SnapshotRepository.cached(context)
        provideContent {
            val size: DpSize = LocalSize.current
            val entries = snapshot?.recentEntries.orEmpty().take(recentRowsForHeight(size.height.value))
            WidgetShell {
                Column(modifier = GlanceModifier.fillMaxSize()) {
                    Row(
                        modifier = GlanceModifier.fillMaxWidth().clickable(openDeepLink("hellocal://calendar")),
                    ) {
                        Text("Seneste registreringer", style = captionStrong, modifier = GlanceModifier.defaultWeight())
                        Text("${kcal(snapshot?.today?.eatenKcal ?: 0)} kcal i dag", style = captionSecondary)
                    }
                    if (entries.isEmpty()) Text("Ingen registreringer endnu.", style = captionSecondary)
                    entries.forEach { entry ->
                        Row(
                            modifier = GlanceModifier.fillMaxWidth().height(36.dp).clickable(openDeepLink(entry.deepLink)),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(entry.title, style = caption, maxLines = 1, modifier = GlanceModifier.defaultWeight())
                            Text(time(entry.createdAt), style = captionSecondary, modifier = GlanceModifier.padding(horizontal = 8.dp))
                            Text("${kcal(entry.kcal)} kcal", style = captionStrong)
                        }
                    }
                }
            }
        }
    }
}

class RecentEntriesWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = RecentEntriesWidget()
}
