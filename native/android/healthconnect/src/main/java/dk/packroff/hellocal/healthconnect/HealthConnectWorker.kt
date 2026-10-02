// Hourly background sync plus an on-demand run (after login, after the user
// changed choices or granted permissions, when the app comes to the front).
package dk.packroff.hellocal.healthconnect

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import java.util.concurrent.TimeUnit

class HealthConnectWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try {
        HealthConnectSync.run(applicationContext)
        Result.success()
    } catch (e: CancellationException) {
        throw e
    } catch (e: HttpException) {
        // 401: token revoked or never set up — wait for the app to store a new one.
        if (e.status == 401 || runAttemptCount >= MAX_ATTEMPTS) Result.failure() else Result.retry()
    } catch (e: Exception) {
        if (runAttemptCount >= MAX_ATTEMPTS) Result.failure() else Result.retry()
    }

    private companion object {
        const val MAX_ATTEMPTS = 3
    }
}

object HealthConnectScheduler {
    private const val PERIODIC = "hellocal-healthconnect-sync"
    private const val ONE_TIME = "hellocal-healthconnect-sync-now"

    private val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    /** Call once after login (and on app start); KEEP leaves an existing schedule alone. */
    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<HealthConnectWorker>(1, TimeUnit.HOURS)
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun now(context: Context) {
        val request = OneTimeWorkRequestBuilder<HealthConnectWorker>().setConstraints(constraints).build()
        WorkManager.getInstance(context).enqueueUniqueWork(ONE_TIME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
        WorkManager.getInstance(context).cancelUniqueWork(ONE_TIME)
    }
}
