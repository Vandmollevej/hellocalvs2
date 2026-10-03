// Writes what the user logged in Hello Cal (the export response) to Health
// Connect. The Hello Cal id is the record's clientRecordId, so a repeated
// write updates the same record instead of adding a duplicate.
package dk.packroff.hellocal.healthconnect

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Volume
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

class HealthConnectWriter(
    private val client: HealthConnectClient,
    private val granted: Set<String>,
    private val zone: ZoneId = ZoneId.systemDefault(),
) {
    /**
     * Types the user switched off or did not grant are skipped. Any insert
     * error is thrown, so the caller keeps the old cursor and retries.
     */
    suspend fun write(export: ExportResponse) {
        val settings = export.settings
        val records = buildList<Record> {
            if (allowed(settings, "nutrition")) export.nutrition.mapTo(this, ::nutrition)
            if (allowed(settings, "water")) export.water.mapTo(this, ::water)
            if (allowed(settings, "weight")) export.weights.mapTo(this, ::weight)
            if (allowed(settings, "activities")) export.activities.mapTo(this, ::activity)
        }
        records.chunked(INSERT_BATCH).forEach { client.insertRecords(it) }
    }

    private fun allowed(settings: SyncSettings, key: String): Boolean {
        val type = HealthConnectPermissions.WRITE_TYPES[key] ?: return false
        return settings.writes(key) && HealthConnectPermissions.canWrite(granted, type)
    }

    private fun nutrition(item: ExportNutrition): NutritionRecord {
        val start = Instant.parse(item.loggedAt)
        val end = start.plus(ENTRY_LENGTH)
        return NutritionRecord(
            startTime = start,
            startZoneOffset = offset(start),
            endTime = end,
            endZoneOffset = offset(end),
            metadata = Metadata.manualEntry(clientRecordId = item.id),
            name = item.title,
            energy = Energy.kilocalories(item.kcal),
            protein = Mass.grams(item.proteinG),
            totalCarbohydrate = Mass.grams(item.carbsG),
            totalFat = Mass.grams(item.fatG),
        )
    }

    private fun water(item: ExportWater): HydrationRecord {
        val start = Instant.parse(item.loggedAt)
        val end = start.plus(ENTRY_LENGTH)
        return HydrationRecord(
            startTime = start,
            startZoneOffset = offset(start),
            endTime = end,
            endZoneOffset = offset(end),
            volume = Volume.milliliters(item.ml),
            metadata = Metadata.manualEntry(clientRecordId = item.id),
        )
    }

    private fun weight(item: ExportWeight): WeightRecord {
        val time = Instant.parse(item.weighedAt)
        return WeightRecord(
            time = time,
            zoneOffset = offset(time),
            weight = Mass.kilograms(item.weightKg),
            metadata = Metadata.manualEntry(clientRecordId = item.id),
        )
    }

    private fun activity(item: ExportActivity): ExerciseSessionRecord {
        val start = Instant.parse(item.startedAt)
        val end = start.plus(Duration.ofMinutes(item.durationMinutes.coerceAtLeast(1).toLong()))
        return ExerciseSessionRecord(
            startTime = start,
            startZoneOffset = offset(start),
            endTime = end,
            endZoneOffset = offset(end),
            metadata = Metadata.manualEntry(clientRecordId = item.id),
            exerciseType = ExerciseTypes.typeOf(item.sportType),
        )
    }

    private fun offset(instant: Instant): ZoneOffset = zone.rules.getOffset(instant)

    private companion object {
        const val INSERT_BATCH = 100

        /** Interval records need end > start; a meal or a drink is logged as one minute. */
        val ENTRY_LENGTH: Duration = Duration.ofMinutes(1)
    }
}
