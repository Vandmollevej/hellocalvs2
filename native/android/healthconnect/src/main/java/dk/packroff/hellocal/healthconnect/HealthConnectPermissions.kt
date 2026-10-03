// Which Health Connect permissions belong to each read/write choice on the
// Health Connect page (ReadType/WriteType in src/lib/integrations/sync-settings.ts).
//
// In the app's UI:
//   val launcher = registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { … }
//   launcher.launch(HealthConnectPermissions.forSettings(settings, client))
package dk.packroff.hellocal.healthconnect

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.BodyWaterMassRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import kotlin.reflect.KClass

object HealthConnectPermissions {
    val READ_TYPES: Map<String, List<KClass<out Record>>> = mapOf(
        "weight" to listOf(WeightRecord::class),
        // Weight is needed to turn body water mass into a percentage.
        "bodyFat" to listOf(BodyFatRecord::class, BodyWaterMassRecord::class, WeightRecord::class),
        "activities" to listOf(ExerciseSessionRecord::class, ActiveCaloriesBurnedRecord::class),
        "steps" to listOf(StepsRecord::class, DistanceRecord::class, FloorsClimbedRecord::class),
        "energy" to listOf(ActiveCaloriesBurnedRecord::class, BasalMetabolicRateRecord::class),
        "heart" to listOf(
            HeartRateRecord::class,
            RestingHeartRateRecord::class,
            HeartRateVariabilityRmssdRecord::class,
            OxygenSaturationRecord::class,
            RespiratoryRateRecord::class,
            Vo2MaxRecord::class,
        ),
        "sleep" to listOf(SleepSessionRecord::class),
        "water" to listOf(HydrationRecord::class),
        "body" to listOf(HeightRecord::class),
    )

    val WRITE_TYPES: Map<String, KClass<out Record>> = mapOf(
        "nutrition" to NutritionRecord::class,
        "water" to HydrationRecord::class,
        "weight" to WeightRecord::class,
        "activities" to ExerciseSessionRecord::class,
    )

    /**
     * Permissions for the types the user has switched on. Pass [client] to also
     * ask for background reads where the device supports them; without that
     * permission Health Connect only allows reads while the app is in front.
     */
    fun forSettings(settings: SyncSettings, client: HealthConnectClient? = null): Set<String> {
        val read = READ_TYPES.filterKeys(settings::reads).values.flatten().map { HealthPermission.getReadPermission(it) }
        val write = WRITE_TYPES.filterKeys(settings::writes).values.map { HealthPermission.getWritePermission(it) }
        val background = if (read.isNotEmpty() && client != null && supportsBackgroundReads(client)) {
            listOf(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
        } else {
            emptyList()
        }
        return (read + write + background).toSet()
    }

    fun supportsBackgroundReads(client: HealthConnectClient): Boolean =
        client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    fun canRead(granted: Set<String>, type: KClass<out Record>) = HealthPermission.getReadPermission(type) in granted

    fun canWrite(granted: Set<String>, type: KClass<out Record>) = HealthPermission.getWritePermission(type) in granted
}
