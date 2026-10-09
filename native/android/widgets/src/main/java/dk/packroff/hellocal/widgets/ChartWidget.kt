// Widget 3 on Android: one widget, swipe up/down between the Statistik
// charts (same gesture as the iPhone Smart Stack). Built on a classic RemoteViews StackView (Glance has no swipeable
// container); each page is the chart drawn to a bitmap. Tapping a page opens
// Statistik — swiping only changes chart.
package dk.packroff.hellocal.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import androidx.compose.ui.graphics.toArgb
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

class ChartWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.widget_chart_stack).apply {
                setRemoteAdapter(R.id.chart_stack, Intent(context, ChartStackService::class.java).apply {
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                    data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
                })
                setEmptyView(R.id.chart_stack, R.id.chart_empty)
                // Template for page taps; each page fills in its own deep link.
                setPendingIntentTemplate(
                    R.id.chart_stack,
                    PendingIntent.getActivity(
                        context, id, Intent(Intent.ACTION_VIEW),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
                    ),
                )
            }
            manager.updateAppWidget(id, views)
        }
        WidgetRefresh.schedule(context)
    }
}

class ChartStackService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = ChartStackFactory(applicationContext)
}

private class ChartStackFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {
    private var charts: List<WidgetSnapshot.Chart> = emptyList()

    override fun onCreate() {}
    override fun onDataSetChanged() {
        charts = SnapshotRepository.cached(context)?.charts.orEmpty()
    }
    override fun onDestroy() {}
    override fun getCount() = charts.size
    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount() = 1
    override fun getItemId(position: Int) = position.toLong()
    override fun hasStableIds() = true

    override fun getViewAt(position: Int): RemoteViews {
        val chart = charts[position]
        val density = context.resources.displayMetrics.density
        // 4×2 cells ≈ 364 × 196 dp (ANDROID_CELL in src/lib/widgets.ts).
        val bitmap = ChartRenderer.chart(chart, (364 * density).toInt(), (196 * density).toInt(), density,
            pageIndex = position, pageCount = charts.size)
        return RemoteViews(context.packageName, R.layout.widget_chart_page).apply {
            setImageViewBitmap(R.id.chart_image, bitmap)
            setContentDescription(R.id.chart_image, chart.label)
            setOnClickFillInIntent(R.id.chart_image, Intent().setData(Uri.parse(chart.deepLink)))
        }
    }
}

/** Canvas drawings shared by the chart pages and the stat-box ring. */
object ChartRenderer {
    private val brand = HcColors.Brand.toArgb()
    private val action = HcColors.Action.toArgb()
    private val danger = HcColors.Danger.toArgb()
    private val secondary = HcColors.TextSecondary.toArgb()
    private val inactive = 0xFF828282.toInt()
    private val nav = HcColors.Nav.toArgb()
    private val page = HcColors.Page.toArgb()

    fun chart(chart: WidgetSnapshot.Chart, width: Int, height: Int, d: Float, pageIndex: Int, pageCount: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), 16 * d, 16 * d, paint.apply { color = page })

        val pad = 12 * d
        paint.textSize = 13 * d
        paint.typeface = Typeface.DEFAULT_BOLD
        paint.color = action
        canvas.drawText(chart.label, pad, pad + 13 * d, paint)

        val latest = chart.points.lastOrNull { it.value != null }?.value
        val latestText = when {
            latest == null -> "—"
            chart.key == "kcal" -> "${latest.toLong()} kcal"
            else -> "${"%.1f".format(Locale("da", "DK"), latest)} ${chart.unit}"
        }
        paint.typeface = Typeface.DEFAULT
        paint.color = secondary
        paint.textAlign = Paint.Align.RIGHT
        canvas.drawText(latestText, width - pad, pad + 13 * d, paint)
        paint.textAlign = Paint.Align.LEFT

        val top = pad + 24 * d
        val bottom = height - pad - 18 * d // room for day labels
        val left = pad
        val right = width - pad - 8 * d // room for the page dots
        val step = (right - left) / chart.points.size
        val present = chart.points.mapNotNull { it.value }

        val (min, max) = when (chart.key) {
            "sleepQuality" -> 0.0 to 5.0
            "weight" -> {
                val all = present + listOfNotNull(chart.goal)
                if (all.isEmpty()) 0.0 to 1.0 else (all.min() - 1) to (all.max() + 1)
            }
            else -> 0.0 to (maxOf(1.0, present.maxOrNull() ?: 0.0, chart.goal ?: 0.0) * 1.1)
        }
        fun y(v: Double) = (bottom - (v - min) / ((max - min).takeIf { it != 0.0 } ?: 1.0) * (bottom - top)).toFloat()
        fun x(i: Int) = left + step * i + step / 2

        chart.goal?.takeIf { chart.key != "sleepQuality" }?.let { goal ->
            paint.color = inactive
            paint.strokeWidth = d
            paint.pathEffect = DashPathEffect(floatArrayOf(3 * d, 3 * d), 0f)
            canvas.drawLine(left, y(goal), right, y(goal), paint)
            paint.pathEffect = null
        }

        if (chart.key == "weight") {
            paint.color = action
            paint.strokeWidth = 2 * d
            paint.style = Paint.Style.STROKE
            val path = Path()
            var started = false
            chart.points.forEachIndexed { i, p ->
                val v = p.value ?: return@forEachIndexed
                if (started) path.lineTo(x(i), y(v)) else path.moveTo(x(i), y(v)).also { started = true }
            }
            canvas.drawPath(path, paint)
            paint.style = Paint.Style.FILL
            chart.points.forEachIndexed { i, p -> p.value?.let { canvas.drawCircle(x(i), y(it), 3 * d, paint) } }
        } else {
            val barW = minOf(18 * d, step * 0.6f)
            chart.points.forEachIndexed { i, p ->
                val v = p.value?.takeIf { it > 0 } ?: return@forEachIndexed
                paint.color = when {
                    chart.key == "sleepQuality" -> action
                    chart.goal != null && v > chart.goal -> danger
                    else -> brand
                }
                canvas.drawRoundRect(RectF(x(i) - barW / 2, y(v), x(i) + barW / 2, bottom), 3 * d, 3 * d, paint)
            }
        }

        paint.textSize = 11 * d
        paint.textAlign = Paint.Align.CENTER
        chart.points.forEachIndexed { i, p ->
            val last = i == chart.points.lastIndex
            paint.color = if (last) action else secondary
            paint.typeface = if (last) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            val label = runCatching {
                LocalDate.parse(p.date).dayOfWeek.getDisplayName(TextStyle.NARROW, Locale("da", "DK"))
            }.getOrDefault("")
            canvas.drawText(label, x(i), bottom + 14 * d, paint)
        }

        // Page dots on the right edge — StackView pages are swiped up/down,
        // the same gesture as the iPhone Smart Stack.
        paint.typeface = Typeface.DEFAULT
        val dotGap = 8 * d
        val startY = height / 2f - (pageCount - 1) * dotGap / 2
        repeat(pageCount) { i ->
            paint.color = if (i == pageIndex) action else inactive
            canvas.drawCircle(width - 5 * d, startY + i * dotGap, 3 * d, paint)
        }
        return bitmap
    }

    /** Progress ring for the "Spist i dag / mål" stat box (same as the web/iOS ring). */
    fun ring(progress: Double, sizePx: Int, d: Float): Bitmap {
        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val stroke = 8 * d
        val rect = RectF(stroke / 2, stroke / 2, sizePx - stroke / 2, sizePx - stroke / 2)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = stroke
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawArc(rect, 0f, 360f, false, paint.apply { color = nav })
        canvas.drawArc(rect, -90f, (360 * progress.coerceIn(0.0, 1.0)).toFloat(), false,
            paint.apply { color = if (progress > 1) danger else brand })
        return bitmap
    }
}
