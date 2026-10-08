package dk.packroff.hellocal.screens.settings

import dk.packroff.hellocal.i18n.Locale
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable

// JSON shapes of GET /api/integrations (IntegrationCardStatus in
// src/lib/integrations.ts), the device-token routes and the tester offer
// (src/lib/integration-testers.ts), plus the small helpers the integration
// pages share (src/app/settings/integrations/status-badge.tsx).

@Serializable
data class SettingsIntegrationCapabilities(val read: List<String> = emptyList(), val write: List<String> = emptyList())

@Serializable
data class SettingsIntegrationSyncSettings(val read: Map<String, Boolean> = emptyMap(), val write: Map<String, Boolean> = emptyMap())

@Serializable
data class SettingsIntegrationStatus(
    val provider: String,
    val label: String = "",
    val icon: String? = null,
    /** "oauth" | "companion" | "via" | "unavailable" */
    val kind: String = "oauth",
    val description: String = "",
    val connectable: Boolean = false,
    val ingestOnly: Boolean = false,
    val issuesDeviceTokens: Boolean = false,
    val legacy: Boolean = false,
    val via: List<String>? = null,
    val viaApp: String? = null,
    val partnerPending: Boolean = false,
    val slug: String? = null,
    val pageSlug: String = "",
    val capabilities: SettingsIntegrationCapabilities = SettingsIntegrationCapabilities(),
    val settings: SettingsIntegrationSyncSettings = SettingsIntegrationSyncSettings(),
    val needsReconnect: List<String> = emptyList(),
    val lastPushedAt: String? = null,
    val configured: Boolean = false,
    /** "DISCONNECTED" | "CONNECTED" | "ERROR" */
    val status: String = "DISCONNECTED",
    val connectedAt: String? = null,
    val lastSyncedAt: String? = null,
    val lastError: String? = null,
)

@Serializable
data class SettingsIntegrationList(val integrations: List<SettingsIntegrationStatus> = emptyList())

@Serializable
data class SettingsIntegrationSettingsSaved(
    val settings: SettingsIntegrationSyncSettings = SettingsIntegrationSyncSettings(),
    val needsReconnect: List<String> = emptyList(),
)

@Serializable
data class SettingsIntegrationDeviceToken(val id: String, val label: String = "", val createdAt: String = "", val lastUsedAt: String? = null)

@Serializable
data class SettingsIntegrationDeviceTokenList(val tokens: List<SettingsIntegrationDeviceToken> = emptyList())

@Serializable
data class SettingsIntegrationTesterOffer(val available: Boolean = false, val mine: String? = null, val points: Int = 0)

/** status-badge.tsx integrationStatusKey(): key under integrations.status. */
internal fun settingsIntegrationStatusKey(integration: SettingsIntegrationStatus): String = when {
    integration.kind == "unavailable" -> "pending"
    integration.status == "CONNECTED" -> "connected"
    integration.status == "ERROR" -> "error"
    integration.kind == "companion" -> "needsApp"
    else -> "disconnected"
}

private val SETTINGS_SHORT_MONTHS: Map<Locale, List<String>> = mapOf(
    Locale.Da to listOf("jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."),
    Locale.En to listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"),
    Locale.De to listOf("Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."),
    Locale.Fr to listOf("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."),
    Locale.Nl to listOf("jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"),
    Locale.Sv to listOf("jan.", "feb.", "mars", "apr.", "maj", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "dec."),
    Locale.No to listOf("jan.", "feb.", "mar.", "apr.", "mai", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "des."),
)

/** Europe/Copenhagen, falling back to the device zone. */
internal fun settingsCopenhagenZone(): TimeZone = runCatching { TimeZone.of("Europe/Copenhagen") }.getOrElse { TimeZone.currentSystemDefault() }

/**
 * Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit",
 * minute: "2-digit" }) — "8. okt. 14.05" in Danish. Returns the raw value if it
 * is not an ISO timestamp.
 */
internal fun settingsFormatShortDateTime(iso: String, locale: Locale = Locale.Da, zone: TimeZone = TimeZone.currentSystemDefault()): String {
    val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return iso
    val local = instant.toLocalDateTime(zone)
    val month = (SETTINGS_SHORT_MONTHS[locale] ?: SETTINGS_SHORT_MONTHS.getValue(Locale.Da))[local.monthNumber - 1]
    val day = local.dayOfMonth
    val hh = local.hour.toString().padStart(2, '0')
    val mm = local.minute.toString().padStart(2, '0')
    return when (locale) {
        Locale.Da -> "$day. $month $hh.$mm"
        Locale.De, Locale.No -> "$day. $month, $hh:$mm"
        Locale.Sv -> "$day $month $hh:$mm"
        else -> "$day $month, $hh:$mm"
    }
}

/** status-badge.tsx formatDateTime(): always da-DK in the device's zone. */
internal fun settingsIntegrationFormatDateTime(iso: String): String = settingsFormatShortDateTime(iso, Locale.Da)

// src/lib/terms-hints.ts integrationTerms(provider) — hard-coded Danish on the web too.
private const val SETTINGS_INTEGRATION_TERMS_COMMON =
    "Du vælger selv pr. datatype, hvad der hentes og sendes, og du kan afbryde forbindelsen når som helst. Data fra andre tjenester kan være forkerte eller mangle, og Hello Cal kan ikke stå inde for dem."

private val SETTINGS_INTEGRATION_TERMS_INTRO: Map<String, String> = mapOf(
    "APPLE_HEALTH" to "Apple Sundhed forbindes via Hello Cal-appen på din iPhone med en enhedskode. Data bliver på din telefon, indtil appen sender de datatyper, du har slået til, til din Hello Cal-konto.",
    "HEALTH_CONNECT" to "Health Connect forbindes via Hello Cal-appen på din Android-telefon. Appen læser og skriver kun de datatyper, du har slået til her og givet lov til i Health Connect.",
    "GOOGLE_HEALTH" to "Google Health forbindes med dit Google-login. Hello Cal får kun adgang til de datatyper, du giver lov til hos Google og slår til på denne side.",
    "SAMSUNG_HEALTH" to "Samsung Health deler data med Hello Cal gennem Health Connect på din telefon. Det er derfor Health Connects tilladelser, der styrer, hvad Hello Cal kan se.",
    "FITBIT" to "Fitbit forbindes med dit Fitbit-login. Hello Cal henter kun vægt og aktiviteter, og kun dem, du har slået til. Vi sender ikke data tilbage til Fitbit.",
    "WITHINGS" to "Withings forbindes med dit Withings-login. Hello Cal henter vægt og fedtprocent fra din vægt, når du har slået det til. Vi sender ikke data tilbage til Withings.",
    "GARMIN" to "Garmin forbindes med dit Garmin Connect-login. Hello Cal henter kun de datatyper, du har slået til, og sender ingen data om dig til Garmin. Fjerner du forbindelsen, får Garmin besked om at stoppe delingen.",
    "WHOOP" to "WHOOP forbindes med dit WHOOP-login. Hello Cal henter træning, søvn og restitution, når du har slået det til, og beder ikke om dit navn eller din e-mail. Vi sender ingen data om dig til WHOOP.",
    "HUAWEI_HEALTH" to "Huawei Health forbindes med dit HUAWEI ID. Hello Cal får kun læseadgang til de datatyper, du giver lov til hos Huawei og slår til her. Vi sender ingen data om dig til Huawei.",
    "EUFY" to "eufy-vægten deler med Hello Cal gennem Health Connect eller Apple Health på din telefon. Hello Cal har ingen forbindelse til eufy og sender ingen data om dig dertil.",
    "RENPHO" to "Renpho-vægten deler med Hello Cal gennem Health Connect eller Apple Health på din telefon. Hello Cal har ingen forbindelse til Renpho og sender ingen data om dig dertil.",
    "XIAOMI" to "Xiaomi-udstyr deler med Hello Cal gennem Health Connect eller Apple Health på din telefon (fra Mi Fitness eller Zepp Life). Hello Cal har ingen forbindelse til Xiaomi og sender ingen data om dig dertil.",
    "TUYA" to "Tuya-vægte deler med Hello Cal gennem Health Connect eller Apple Health, hvis din vægt-app kan det. Hello Cal har ingen forbindelse til Tuya og sender ingen data om dig dertil.",
    "POLAR" to "Polar forbindes med dit Polar-login. Hello Cal henter dine træninger, når du har slået det til. Vi sender ikke data tilbage til Polar.",
    "STRAVA" to "Strava forbindes med dit Strava-login. Hello Cal kan hente dine aktiviteter og, hvis du slår det til, sende aktiviteter fra Hello Cal til Strava. Det, der sendes til Strava, følger dine privatlivsindstillinger dér.",
)

/** Paragraphs of the "Vilkår og betingelser" sheet on an integration page. */
internal fun settingsIntegrationTermsParagraphs(provider: String): List<String> = listOfNotNull(
    SETTINGS_INTEGRATION_TERMS_INTRO[provider],
    SETTINGS_INTEGRATION_TERMS_COMMON,
    "Den anden tjeneste har sine egne vilkår og sin egen privatlivspolitik, som gælder for din brug af den.",
)

/** termsHref("integrationer") */
internal const val SETTINGS_INTEGRATION_TERMS_HREF = "/betingelser#integrationer"
