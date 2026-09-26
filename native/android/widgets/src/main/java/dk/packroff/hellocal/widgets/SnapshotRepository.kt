// Fetches /api/widgets/snapshot with the personal device token and caches the
// last good copy, so widgets still render offline. The main app stores the
// token (DeviceTokenStore.write) at login and calls WidgetRefresh.now() after
// every registration.
package dk.packroff.hellocal.widgets

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.TimeZone

object HelloCalConfig {
    const val BASE_URL = "https://hellocal.packroff.dk"
}

object DeviceTokenStore {
    private fun prefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        "hellocal_secure",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun read(context: Context): String? = prefs(context).getString("deviceToken", null)

    fun write(context: Context, token: String) = prefs(context).edit().putString("deviceToken", token).apply()
}

object SnapshotRepository {
    private val json = Json { ignoreUnknownKeys = true }
    private const val CACHE_PREFS = "hellocal_widget_cache"
    private const val CACHE_KEY = "snapshot"

    fun cached(context: Context): WidgetSnapshot? =
        context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE)
            .getString(CACHE_KEY, null)
            ?.let { runCatching { json.decodeFromString<WidgetSnapshot>(it) }.getOrNull() }

    /** Network first, cached copy on any failure. */
    suspend fun load(context: Context): WidgetSnapshot? = runCatching { fetch(context) }.getOrNull() ?: cached(context)

    suspend fun fetch(context: Context): WidgetSnapshot = withContext(Dispatchers.IO) {
        val token = DeviceTokenStore.read(context) ?: error("No device token")
        val offsetMinutes = TimeZone.getDefault().getOffset(System.currentTimeMillis()) / 60_000
        val locale = if (Locale.getDefault().language == "en") "en" else "da"
        val url = URL("${HelloCalConfig.BASE_URL}/api/widgets/snapshot?tzOffsetMinutes=$offsetMinutes&locale=$locale")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            setRequestProperty("Authorization", "Bearer $token")
            connectTimeout = 15_000
            readTimeout = 15_000
        }
        try {
            check(connection.responseCode == 200) { "HTTP ${connection.responseCode}" }
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val snapshot = json.decodeFromString<WidgetSnapshot>(body)
            context.getSharedPreferences(CACHE_PREFS, Context.MODE_PRIVATE).edit().putString(CACHE_KEY, body).apply()
            snapshot
        } finally {
            connection.disconnect()
        }
    }
}

/** Per-widget choices made in WidgetConfigActivity (keyed by appWidgetId). */
object WidgetChoices {
    private fun prefs(context: Context) = context.getSharedPreferences("hellocal_widget_choices", Context.MODE_PRIVATE)

    fun addRowKeys(context: Context, appWidgetId: Int): List<String> =
        prefs(context).getString("addRow_$appWidgetId", null)?.split(",")?.filter { it.isNotBlank() }
            ?.takeIf { it.isNotEmpty() } ?: DEFAULT_ADD_ROW_KEYS

    fun setAddRowKeys(context: Context, appWidgetId: Int, keys: List<String>) =
        prefs(context).edit().putString("addRow_$appWidgetId", keys.take(MAX_ADD_ROW_ACTIONS).joinToString(",")).apply()

    fun statBoxKey(context: Context, appWidgetId: Int): String =
        prefs(context).getString("statBox_$appWidgetId", null) ?: DEFAULT_STAT_BOX_KEY

    fun setStatBoxKey(context: Context, appWidgetId: Int, key: String) =
        prefs(context).edit().putString("statBox_$appWidgetId", key).apply()
}
