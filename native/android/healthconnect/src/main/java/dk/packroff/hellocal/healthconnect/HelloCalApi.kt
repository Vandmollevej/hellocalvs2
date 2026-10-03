// The two companion endpoints (docs/HEALTHKIT_COMPANION.md):
// GET  /api/integrations/healthkit/export — the user's choices + data to write.
// POST /api/integrations/healthkit/ingest — data read from Health Connect.
package dk.packroff.hellocal.healthconnect

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

@Serializable
data class SyncSettings(
    val read: Map<String, Boolean> = emptyMap(),
    val write: Map<String, Boolean> = emptyMap(),
) {
    fun reads(key: String) = read[key] == true
    fun writes(key: String) = write[key] == true
}

@Serializable
data class ExportNutrition(
    val id: String,
    val title: String,
    val loggedAt: String,
    val kcal: Double,
    val proteinG: Double,
    val carbsG: Double,
    val fatG: Double,
)

@Serializable
data class ExportWater(val id: String, val ml: Double, val loggedAt: String)

@Serializable
data class ExportWeight(val id: String, val weightKg: Double, val weighedAt: String)

@Serializable
data class ExportActivity(
    val id: String,
    val sportType: String,
    val startedAt: String,
    val durationMinutes: Int,
    val caloriesBurned: Double,
)

@Serializable
data class ExportResponse(
    val settings: SyncSettings = SyncSettings(),
    val cursor: String? = null,
    val nutrition: List<ExportNutrition> = emptyList(),
    val water: List<ExportWater> = emptyList(),
    val weights: List<ExportWeight> = emptyList(),
    val activities: List<ExportActivity> = emptyList(),
)

/** `origin` = Health Connect dataOrigin package name (which brand app wrote it). */
@Serializable
data class IngestMetric(val type: String, val value: Double, val recordedAt: String, val origin: String? = null)

@Serializable
data class IngestWeight(val weightKg: Double, val weighedAt: String, val origin: String? = null)

@Serializable
data class IngestActivity(
    val sportType: String,
    val startedAt: String,
    val durationMinutes: Int,
    val caloriesBurned: Double,
    val origin: String? = null,
)

@Serializable
data class IngestRequest(
    val source: String = HealthConnectConfig.SOURCE,
    val metrics: List<IngestMetric> = emptyList(),
    val weights: List<IngestWeight> = emptyList(),
    val activities: List<IngestActivity> = emptyList(),
)

class HttpException(val status: Int) : Exception("HTTP $status")

object HelloCalApi {
    private const val MAX_ITEMS_PER_REQUEST = 500
    // encodeDefaults: `source` has a default value but must always be sent.
    @OptIn(ExperimentalSerializationApi::class)
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; explicitNulls = false }

    suspend fun export(context: Context, since: String?): ExportResponse {
        val query = buildString {
            append("source=${HealthConnectConfig.SOURCE}")
            if (since != null) append("&since=${URLEncoder.encode(since, "UTF-8")}")
        }
        val body = request(context, "GET", "/api/integrations/healthkit/export?$query", null)
        return json.decodeFromString(body)
    }

    /** Sends everything in requests of at most [MAX_ITEMS_PER_REQUEST] items. */
    suspend fun ingest(context: Context, data: IngestRequest) {
        val batches = data.metrics.chunked(MAX_ITEMS_PER_REQUEST).map { IngestRequest(metrics = it) } +
            data.weights.chunked(MAX_ITEMS_PER_REQUEST).map { IngestRequest(weights = it) } +
            data.activities.chunked(MAX_ITEMS_PER_REQUEST).map { IngestRequest(activities = it) }
        for (batch in batches) {
            request(context, "POST", "/api/integrations/healthkit/ingest", json.encodeToString(batch))
        }
    }

    private suspend fun request(context: Context, method: String, path: String, body: String?): String =
        withContext(Dispatchers.IO) {
            val token = DeviceTokenStore.read(context) ?: error("No device token")
            val connection = (URL("${HealthConnectConfig.BASE_URL}$path").openConnection() as HttpURLConnection).apply {
                requestMethod = method
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Accept", "application/json")
                connectTimeout = 15_000
                readTimeout = 30_000
            }
            try {
                if (body != null) {
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                }
                val status = connection.responseCode
                if (status !in 200..299) throw HttpException(status)
                connection.inputStream.bufferedReader().use { it.readText() }
            } finally {
                connection.disconnect()
            }
        }
}
