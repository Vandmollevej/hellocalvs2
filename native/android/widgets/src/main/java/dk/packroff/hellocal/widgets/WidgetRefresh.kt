// Keeps every widget fresh: a periodic WorkManager job (every 15 min, the
// Android minimum — matches refreshAfterSeconds) plus an immediate refresh
// the main app triggers after each registration.
package dk.packroff.hellocal.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class WidgetRefreshWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        runCatching { SnapshotRepository.fetch(applicationContext) }
        WidgetRefresh.redraw(applicationContext)
        return Result.success()
    }
}

object WidgetRefresh {
    private const val PERIODIC = "hellocal-widget-refresh"

    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<WidgetRefreshWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    /** Call from the main app after a registration, weigh-in etc. */
    fun now(context: Context) {
        WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<WidgetRefreshWorker>().build())
    }

    suspend fun redraw(context: Context) {
        QuickAddWidget().updateAll(context)
        AddRowWidget().updateAll(context)
        StatBoxWidget().updateAll(context)
        RecentEntriesWidget().updateAll(context)
        val manager = AppWidgetManager.getInstance(context)
        val chartIds = manager.getAppWidgetIds(ComponentName(context, ChartWidgetProvider::class.java))
        manager.notifyAppWidgetViewDataChanged(chartIds, R.id.chart_stack)
    }
}
