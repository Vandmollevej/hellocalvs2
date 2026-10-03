package dk.packroff.hellocal.healthconnect

object HealthConnectConfig {
    const val BASE_URL = "https://hellocal.packroff.dk"
    const val PRIVACY_URL = "$BASE_URL/privatlivspolitik"

    /** `source` sent to the companion endpoints (docs/HEALTHKIT_COMPANION.md). */
    const val SOURCE = "HEALTH_CONNECT"
}
