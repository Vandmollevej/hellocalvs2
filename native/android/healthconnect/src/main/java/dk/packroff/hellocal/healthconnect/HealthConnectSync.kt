// One sync run: fetch the user's choices + data to write (export), read Health
// Connect, send it to Hello Cal (ingest), write Hello Cal's data to Health
// Connect, then remember how far we got.
package dk.packroff.hellocal.healthconnect

import android.app.ActivityManager
import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Duration
import java.time.Instant

enum class SyncOutcome { DONE, PARTIAL, NO_TOKEN, HEALTH_CONNECT_UNAVAILABLE }

object HealthConnectSync {
    private val FIRST_READ = Duration.ofDays(30)

    /** Day sums for yesterday can still grow (late watch sync), so each run re-reads one extra day. */
    private val OVERLAP = Duration.ofDays(1)

    private val running = Mutex()

    /** Runs never overlap (periodic and on-demand work can fire together). */
    suspend fun run(context: Context): SyncOutcome = running.withLock { sync(context) }

    private suspend fun sync(context: Context): SyncOutcome {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            return SyncOutcome.HEALTH_CONNECT_UNAVAILABLE
        }
        if (DeviceTokenStore.read(context) == null) return SyncOutcome.NO_TOKEN

        val client = HealthConnectClient.getOrCreate(context)
        val state = SyncState(context)
        val export = HelloCalApi.export(context, state.cursor)
        val granted = client.permissionController.getGrantedPermissions()
        val now = Instant.now()

        var complete = true
        if (canReadNow(granted)) {
            val since = state.lastReadAt?.minus(OVERLAP) ?: now.minus(FIRST_READ)
            val result = HealthConnectReader(client, context.packageName, granted).read(export.settings, since, now)
            HelloCalApi.ingest(context, result.data)
            if (result.complete) state.lastReadAt = now else complete = false
        } else {
            complete = false
        }

        HealthConnectWriter(client, granted).write(export)
        export.cursor?.let { state.cursor = it }
        return if (complete) SyncOutcome.DONE else SyncOutcome.PARTIAL
    }

    /**
     * Health Connect only allows reads from the background with
     * READ_HEALTH_DATA_IN_BACKGROUND; without it we read only while the app
     * is in front and leave lastReadAt untouched, so nothing is skipped.
     */
    private fun canReadNow(granted: Set<String>): Boolean {
        if (HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND in granted) return true
        val info = ActivityManager.RunningAppProcessInfo().also { ActivityManager.getMyMemoryState(it) }
        return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }
}

/** Plain prefs: only timestamps, nothing sensitive. */
private class SyncState(context: Context) {
    private val prefs = context.getSharedPreferences("hellocal_healthconnect", Context.MODE_PRIVATE)

    var cursor: String?
        get() = prefs.getString("cursor", null)
        set(value) = prefs.edit().putString("cursor", value).apply()

    var lastReadAt: Instant?
        get() = prefs.getLong("lastReadAt", 0L).takeIf { it > 0 }?.let(Instant::ofEpochMilli)
        set(value) = prefs.edit().putLong("lastReadAt", value?.toEpochMilli() ?: 0L).apply()
}
