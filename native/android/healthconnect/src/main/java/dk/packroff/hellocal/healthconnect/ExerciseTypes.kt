// Health Connect exercise types ↔ Hello Cal sportType. Reading sends the
// readable constant name ("running", "biking", "swimming_pool" …); the server
// normalizes it (normalizeSportType in src/lib/sport-icons.ts). Writing maps
// Hello Cal's own sport keys back to the closest exercise type.
package dk.packroff.hellocal.healthconnect

import androidx.health.connect.client.records.ExerciseSessionRecord as E

object ExerciseTypes {
    private val NAMES: Map<Int, String> = mapOf(
        E.EXERCISE_TYPE_OTHER_WORKOUT to "workout",
        E.EXERCISE_TYPE_BADMINTON to "badminton",
        E.EXERCISE_TYPE_BASEBALL to "baseball",
        E.EXERCISE_TYPE_BASKETBALL to "basketball",
        E.EXERCISE_TYPE_BIKING to "biking",
        E.EXERCISE_TYPE_BIKING_STATIONARY to "biking_stationary",
        E.EXERCISE_TYPE_BOOT_CAMP to "boot_camp",
        E.EXERCISE_TYPE_BOXING to "boxing",
        E.EXERCISE_TYPE_CALISTHENICS to "calisthenics",
        E.EXERCISE_TYPE_CRICKET to "cricket",
        E.EXERCISE_TYPE_DANCING to "dancing",
        E.EXERCISE_TYPE_ELLIPTICAL to "elliptical",
        E.EXERCISE_TYPE_EXERCISE_CLASS to "exercise_class",
        E.EXERCISE_TYPE_FENCING to "fencing",
        E.EXERCISE_TYPE_FOOTBALL_AMERICAN to "football_american",
        E.EXERCISE_TYPE_FOOTBALL_AUSTRALIAN to "football_australian",
        E.EXERCISE_TYPE_FRISBEE_DISC to "frisbee_disc",
        E.EXERCISE_TYPE_GOLF to "golf",
        E.EXERCISE_TYPE_GUIDED_BREATHING to "guided_breathing",
        E.EXERCISE_TYPE_GYMNASTICS to "gymnastics",
        E.EXERCISE_TYPE_HANDBALL to "handball",
        E.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING to "high_intensity_interval_training",
        E.EXERCISE_TYPE_HIKING to "hiking",
        E.EXERCISE_TYPE_ICE_HOCKEY to "ice_hockey",
        E.EXERCISE_TYPE_ICE_SKATING to "ice_skating",
        E.EXERCISE_TYPE_MARTIAL_ARTS to "martial_arts",
        E.EXERCISE_TYPE_PADDLING to "paddling",
        E.EXERCISE_TYPE_PARAGLIDING to "paragliding",
        E.EXERCISE_TYPE_PILATES to "pilates",
        E.EXERCISE_TYPE_RACQUETBALL to "racquetball",
        E.EXERCISE_TYPE_ROCK_CLIMBING to "rock_climbing",
        E.EXERCISE_TYPE_ROLLER_HOCKEY to "roller_hockey",
        E.EXERCISE_TYPE_ROWING to "rowing",
        E.EXERCISE_TYPE_ROWING_MACHINE to "rowing_machine",
        E.EXERCISE_TYPE_RUGBY to "rugby",
        E.EXERCISE_TYPE_RUNNING to "running",
        E.EXERCISE_TYPE_RUNNING_TREADMILL to "running_treadmill",
        E.EXERCISE_TYPE_SAILING to "sailing",
        E.EXERCISE_TYPE_SCUBA_DIVING to "scuba_diving",
        E.EXERCISE_TYPE_SKATING to "skating",
        E.EXERCISE_TYPE_SKIING to "skiing",
        E.EXERCISE_TYPE_SNOWBOARDING to "snowboarding",
        E.EXERCISE_TYPE_SNOWSHOEING to "snowshoeing",
        E.EXERCISE_TYPE_SOCCER to "soccer",
        E.EXERCISE_TYPE_SOFTBALL to "softball",
        E.EXERCISE_TYPE_SQUASH to "squash",
        E.EXERCISE_TYPE_STAIR_CLIMBING to "stair_climbing",
        E.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE to "stair_climbing_machine",
        E.EXERCISE_TYPE_STRENGTH_TRAINING to "strength_training",
        E.EXERCISE_TYPE_STRETCHING to "stretching",
        E.EXERCISE_TYPE_SURFING to "surfing",
        E.EXERCISE_TYPE_SWIMMING_OPEN_WATER to "swimming_open_water",
        E.EXERCISE_TYPE_SWIMMING_POOL to "swimming_pool",
        E.EXERCISE_TYPE_TABLE_TENNIS to "table_tennis",
        E.EXERCISE_TYPE_TENNIS to "tennis",
        E.EXERCISE_TYPE_VOLLEYBALL to "volleyball",
        E.EXERCISE_TYPE_WALKING to "walking",
        E.EXERCISE_TYPE_WATER_POLO to "water_polo",
        E.EXERCISE_TYPE_WEIGHTLIFTING to "weightlifting",
        E.EXERCISE_TYPE_WHEELCHAIR to "wheelchair",
        E.EXERCISE_TYPE_YOGA to "yoga",
    )

    private val HELLO_CAL_KEYS: Map<String, Int> = mapOf(
        "running" to E.EXERCISE_TYPE_RUNNING,
        "cycling" to E.EXERCISE_TYPE_BIKING,
        "walking" to E.EXERCISE_TYPE_WALKING,
        "swimming" to E.EXERCISE_TYPE_SWIMMING_POOL,
        "cardio" to E.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING,
        "ski" to E.EXERCISE_TYPE_SKIING,
        "strength" to E.EXERCISE_TYPE_STRENGTH_TRAINING,
        "yoga" to E.EXERCISE_TYPE_YOGA,
        "football" to E.EXERCISE_TYPE_SOCCER,
        "other" to E.EXERCISE_TYPE_OTHER_WORKOUT,
    )

    private val BY_NAME: Map<String, Int> = NAMES.entries.associate { (type, name) -> name to type }

    fun nameOf(exerciseType: Int): String = NAMES[exerciseType] ?: "workout"

    fun typeOf(sportType: String): Int {
        val key = sportType.trim().lowercase()
        return HELLO_CAL_KEYS[key] ?: BY_NAME[key] ?: E.EXERCISE_TYPE_OTHER_WORKOUT
    }
}
